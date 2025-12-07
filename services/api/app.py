import os
from pathlib import Path
from datetime import datetime

from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import generate_password_hash, check_password_hash

try:
    from .db import Database
except ImportError:
    from db import Database


def _find_root() -> Path:
    """Locate a directory containing static/ and templates/."""
    here = Path(__file__).resolve()
    for cand in [
        here.parent,
        here.parent.parent,
        here.parent.parent.parent,
    ]:
        if (cand / "static").exists() and (cand / "templates").exists():
            return cand
    return here.parent


ROOT_DIR = _find_root()
STATIC_DIR = ROOT_DIR / "static"
TEMPLATES_DIR = ROOT_DIR / "templates"

MONGO_URI = os.getenv("MONGO_URI", "mongodb://mongo:27017")
MONGO_DB = os.getenv("MONGO_DB", "marketplace")


def create_app(testing: bool = False):
    app = Flask(__name__, static_folder=str(STATIC_DIR), template_folder=str(TEMPLATES_DIR))
    app.wsgi_app = ProxyFix(app.wsgi_app)
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

    db = Database(MONGO_URI, MONGO_DB, use_mock=testing)
    if not testing:
        db.seed_if_empty()

    # ---- In-memory stores for demo purposes ----
    users_store = {}  # {user_id: {id, email, password_hash, nickname, community_id, verify_status, avatar}}
    auth_tokens = {}  # {token: user_id}
    threads_store = []
    messages_store = []
    reports_store = []
    
    communities = [
        {"id": 1, "name": "NYU Tandon", "type": "university"},
        {"id": 2, "name": "NYU Washington Square", "type": "university"},
        {"id": 3, "name": "Nearby 3km", "type": "nearby"},
    ]

    def _next_id(collection):
        return str(len(collection) + 1)

    # ===== Health Check =====
    @app.route("/api/health")
    @app.route("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    # ===== Communities =====
    @app.route("/api/communities", methods=["GET"])
    def get_communities():
        return jsonify(communities), 200

    @app.route("/api/communities/<int:community_id>", methods=["GET"])
    def get_community(community_id):
        for c in communities:
            if c["id"] == community_id:
                return jsonify(c), 200
        return jsonify({"error": "Not found"}), 404

    # ===== Authentication =====
    @app.route("/api/auth/register", methods=["POST"])
    def register():
        payload = request.get_json(force=True, silent=True) or {}
        email = (payload.get("email") or "").lower().strip()
        password = payload.get("password") or ""
        nickname = (payload.get("nickname") or "").strip()
        community_id = payload.get("community_id", 1)
        
        # Validation
        if not email or not password or not nickname:
            return jsonify({"error": "Email, password, and nickname are required"}), 400
        
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        
        # Check if email already exists
        for existing_user in users_store.values():
            if existing_user.get("email") == email:
                return jsonify({"error": "Email already registered"}), 400
        
        # Create user
        user_id = _next_id(users_store)
        password_hash = generate_password_hash(password)
        
        user_data = {
            "id": user_id,
            "email": email,
            "password_hash": password_hash,
            "nickname": nickname,
            "community_id": int(community_id),
            "verify_status": "email_verified",
            "avatar": None,
            "created_at": datetime.utcnow().isoformat()
        }
        
        users_store[user_id] = user_data
        
        # Create auth token
        token = f"token-{user_id}-{datetime.utcnow().timestamp()}"
        auth_tokens[token] = user_id
        
        # Return user info (without password)
        user_response = {k: v for k, v in user_data.items() if k != "password_hash"}
        
        return jsonify({
            "token": token,
            "user": user_response
        }), 201

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        payload = request.get_json(force=True, silent=True) or {}
        email = (payload.get("email") or "").lower().strip()
        password = payload.get("password") or ""
        
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400
        
        # Find user by email
        found_user = None
        for user_id, user_data in users_store.items():
            if user_data.get("email") == email:
                found_user = user_data
                break
        
        if not found_user:
            return jsonify({"error": "Invalid email or password"}), 401
        
        # Check password
        if not check_password_hash(found_user["password_hash"], password):
            return jsonify({"error": "Invalid email or password"}), 401
        
        # Create auth token
        token = f"token-{found_user['id']}-{datetime.utcnow().timestamp()}"
        auth_tokens[token] = found_user["id"]
        
        # Return user info (without password)
        user_response = {k: v for k, v in found_user.items() if k != "password_hash"}
        
        return jsonify({
            "token": token,
            "user": user_response
        }), 200

    # ===== Listings =====
    @app.route("/api/listings", methods=["GET", "POST"])
    def listings():
        if request.method == "GET":
            filters = {
                "category": request.args.get("category"),
                "community_id": request.args.get("community_id"),
                "q": request.args.get("q"),
                "user_id": request.args.get("user_id")
            }
            items = db.list_items(filters)
            return jsonify(items), 200

        # POST - create listing
        try:
            # Handle both JSON and FormData
            if request.content_type and 'application/json' in request.content_type:
                payload = request.get_json(force=True, silent=True) or {}
                title = payload.get("title", "").strip()
                price = payload.get("price")
                category = payload.get("category") or "other"
                description = payload.get("description", "")
                meetup_point = payload.get("meetup_point", "")
                user_id = payload.get("user_id", "system")
                course_code = payload.get("course_code")
                community_id = payload.get("community_id")
            else:
                # FormData
                form = request.form
                title = form.get("title", "").strip()
                price = form.get("price")
                category = form.get("category") or "other"
                description = form.get("description", "")
                meetup_point = form.get("meetup_point", "")
                user_id = form.get("user_id", "system")
                course_code = form.get("course_code")
                community_id = form.get("community_id")
            
            # Validation
            if not title or not price:
                return jsonify({"error": "Title and price are required"}), 400
            
            try:
                price_val = float(price)
            except (TypeError, ValueError):
                return jsonify({"error": "Price must be a number"}), 400
            
            # Get user info (optional for listing creation)
            user_info = users_store.get(user_id)
            if user_info:
                user_data = {
                    "id": user_info["id"],
                    "nickname": user_info["nickname"],
                    "verify_status": user_info["verify_status"]
                }
            else:
                user_data = {
                    "id": user_id,
                    "nickname": "Anonymous",
                    "verify_status": "unknown"
                }
            
            # Create listing
            listing = db.create_item(
                title=title,
                price=price_val,
                description=description,
                category=category,
                meetup_point=meetup_point,
                user_id=user_id,
                user=user_data,
                course_code=course_code,
                community_id=community_id,
            )
            
            return jsonify(listing), 201
            
        except Exception as e:
            print(f"Error creating listing: {e}")
            return jsonify({"error": "Failed to create listing"}), 500

    @app.route("/api/listings/<item_id>", methods=["GET"])
    def get_listing(item_id):
        item = db.get_item(item_id)
        if not item:
            return jsonify({"error": "Not found"}), 404
        return jsonify(item), 200

    @app.route("/api/listings/search", methods=["GET"])
    def search_listings():
        q = request.args.get("q", "").strip()
        category = request.args.get("category")
        community_id = request.args.get("community_id")
        
        filters = {"q": q}
        if category:
            filters["category"] = category
        if community_id:
            filters["community_id"] = community_id
        
        items = db.list_items(filters)
        return jsonify(items), 200

    @app.route("/api/users/<user_id>/listings", methods=["GET"])
    def get_user_listings(user_id):
        items = db.list_items({"user_id": user_id})
        return jsonify(items), 200

    # ===== Users =====
    @app.route("/api/users/<user_id>", methods=["GET"])
    def get_user(user_id):
        user = users_store.get(user_id)
        if not user:
            return jsonify({"error": "Not found"}), 404
        return jsonify({k: v for k, v in user.items() if k != "password_hash"}), 200

    @app.route("/api/users/<user_id>/avatar", methods=["POST"])
    def upload_avatar(user_id):
        user = users_store.get(user_id)
        if not user:
            return jsonify({"error": "Not found"}), 404
        
        # For demo, just echo a placeholder URL
        user["avatar"] = f"https://ui-avatars.com/api/?name={user.get('nickname','User')}&background=667eea&color=fff&size=200"
        
        return jsonify({"user": {k: v for k, v in user.items() if k != "password_hash"}}), 200

    # ===== Favorites =====
    @app.route("/api/favorites", methods=["POST"])
    def add_favorite():
        payload = request.get_json(force=True, silent=True) or {}
        user_id = payload.get("user_id")
        listing_id = payload.get("listing_id")
        
        if not user_id or not listing_id:
            return jsonify({"error": "user_id and listing_id required"}), 400
        
        user_id = str(user_id)
        listing_id = str(listing_id)
        added = db.add_favorite(user_id, listing_id)
        if added:
            return jsonify({"ok": True}), 201
        # already existed
        return jsonify({"ok": True, "note": "already favorited"}), 200

    @app.route("/api/favorites/<listing_id>", methods=["DELETE"])
    def remove_favorite(listing_id):
        user_id = request.args.get("user_id")
        if not user_id:
            return jsonify({"error": "user_id required"}), 400
        user_id = str(user_id)
        listing_id = str(listing_id)
        db.remove_favorite(user_id, listing_id)
        return jsonify({"ok": True}), 200

    @app.route("/api/users/<user_id>/favorites", methods=["GET"])
    def get_user_favorites(user_id):
        fav_ids = db.list_favorites_for_user(user_id)
        items = [db.get_item(fid) for fid in fav_ids]
        items = [i for i in items if i]
        return jsonify({"favorites": items, "favorite_ids": fav_ids}), 200

    # ===== Threads & Messages (Basic Implementation) =====
    @app.route("/api/threads", methods=["POST"])
    def create_thread():
        payload = request.get_json(force=True, silent=True) or {}
        buyer_id = payload.get("buyer_id")
        seller_id = payload.get("seller_id")
        listing_id = payload.get("listing_id")
        
        if not buyer_id or not seller_id or not listing_id:
            return jsonify({"error": "buyer_id, seller_id, listing_id required"}), 400
        
        buyer_id = str(buyer_id)
        seller_id = str(seller_id)
        listing_id = str(listing_id)
        
        # Check if thread already exists
        for thread in threads_store:
            if (thread["buyer_id"] == buyer_id and 
                thread["seller_id"] == seller_id and 
                thread["listing_id"] == listing_id):
                return jsonify(thread), 200
        
        # Get listing info
        listing = db.get_item(listing_id)
        buyer = users_store.get(buyer_id, {})
        seller = users_store.get(seller_id, {})
        
        thread_id = _next_id(threads_store)
        thread = {
            "id": thread_id,
            "buyer_id": buyer_id,
            "seller_id": seller_id,
            "listing_id": listing_id,
            "listing_title": listing.get("title", "") if listing else "",
            "listing_price": listing.get("price", 0) if listing else 0,
            "listing_meetup_point": listing.get("meetup_point", "") if listing else "",
            "listing_category": listing.get("category", "other") if listing else "other",
            "buyer_nickname": buyer.get("nickname", "Buyer"),
            "seller_nickname": seller.get("nickname", "Seller"),
            "created_at": datetime.utcnow().isoformat(),
            "last_message_at": datetime.utcnow().isoformat()
        }
        threads_store.append(thread)
        return jsonify(thread), 201

    @app.route("/api/threads/<user_id>", methods=["GET"])
    def get_threads(user_id):
        user_threads = [t for t in threads_store if t["buyer_id"] == user_id or t["seller_id"] == user_id]
        return jsonify(user_threads), 200

    @app.route("/api/threads/<thread_id>", methods=["GET"])
    def get_thread(thread_id):
        for thread in threads_store:
            if thread["id"] == thread_id:
                return jsonify(thread), 200
        return jsonify({"error": "Thread not found"}), 404

    @app.route("/api/threads/<thread_id>/messages", methods=["GET"])
    def get_thread_messages(thread_id):
        thread_messages = [m for m in messages_store if m["thread_id"] == thread_id]
        return jsonify(thread_messages), 200

    @app.route("/api/messages", methods=["POST"])
    def send_message():
        payload = request.get_json(force=True, silent=True) or {}
        thread_id = str(payload.get("thread_id"))
        from_user_id = str(payload.get("from_user_id"))
        to_user_id = str(payload.get("to_user_id"))
        content = (payload.get("content") or "").strip()
        
        if not thread_id or not from_user_id or not content:
            return jsonify({"error": "thread_id, from_user_id and content required"}), 400
        
        message_id = _next_id(messages_store)
        message = {
            "id": message_id,
            "thread_id": thread_id,
            "from_user_id": from_user_id,
            "to_user_id": to_user_id,
            "content": content,
            "created_at": datetime.utcnow().isoformat()
        }
        messages_store.append(message)
        
        # Update thread last_message_at
        for thread in threads_store:
            if thread["id"] == thread_id:
                thread["last_message_at"] = datetime.utcnow().isoformat()
                break
        
        return jsonify(message), 201

    @app.route("/api/messages/<user_id>/unread-count", methods=["GET"])
    def unread_count(user_id):
        return jsonify({"unread": 0}), 200

    # ===== Reports =====
    @app.route("/api/reports", methods=["POST", "GET"])
    def handle_reports():
        if request.method == "POST":
            payload = request.get_json(force=True, silent=True) or {}
            reports_store.append(payload)
            return jsonify({"ok": True}), 201
        return jsonify(reports_store), 200

    # ===== Stats =====
    @app.route("/api/stats/dashboard", methods=["GET"])
    def dashboard_stats():
        return jsonify({
            "listings": len(db.list_items()),
            "users": len(users_store),
            "favorites": db.count_favorites()
        }), 200

    @app.route("/api/stats/categories", methods=["GET"])
    def category_stats():
        items = db.list_items()
        counts = {}
        for item in items:
            cat = item.get("category") or "other"
            counts[cat] = counts.get(cat, 0) + 1
        return jsonify(counts), 200

    # ===== Legacy /api/items endpoint =====
    @app.route("/api/items", methods=["GET", "POST"])
    def items():
        if request.method == "GET":
            return jsonify(db.list_items()), 200

        payload = request.get_json(force=True, silent=True) or {}
        name = (payload.get("name") or "").strip()
        price = payload.get("price")
        if not name or price is None:
            return jsonify({"error": "name and price are required"}), 400
        try:
            price_val = float(price)
        except (TypeError, ValueError):
            return jsonify({"error": "price must be a number"}), 400

        item = db.create_item(title=name, name=name, price=price_val, description=payload.get("description", ""))
        return jsonify(item), 201

    # ===== Frontend Pages =====
    @app.route("/")
    def index():
        if (TEMPLATES_DIR / "index.html").exists():
            return render_template("index.html")
        return send_from_directory(app.static_folder, "index.html")

    @app.route("/login")
    def login_page():
        return render_template("login.html")

    @app.route("/register")
    def register_page():
        return render_template("register.html")

    @app.route("/static/<path:filename>")
    def static_files(filename):
        return send_from_directory(app.static_folder, filename)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)