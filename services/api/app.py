import os
import uuid
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename

try:
    # When imported as a package (tests, normal usage)
    from .db import Database
except ImportError:  # pragma: no cover
    # When executed as a standalone script (e.g., Docker CMD)
    from db import Database  # type: ignore


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
UPLOAD_DIR = STATIC_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "marketplace")


def create_app(testing: bool = False):
    app = Flask(__name__, static_folder=str(STATIC_DIR), template_folder=str(TEMPLATES_DIR))
    app.wsgi_app = ProxyFix(app.wsgi_app)

    db = Database(MONGO_URI, MONGO_DB, use_mock=testing)
    if not testing:
        db.seed_if_empty()

    # ---- In-memory stores for lightweight demo behaviors ----
    users = {}
    auth_tokens = {}
    favorites = {}
    reports = []
    communities = [
        {"id": 1, "name": "NYU Tandon", "type": "university"},
        {"id": 2, "name": "NYU Washington Square", "type": "university"},
        {"id": 3, "name": "Nearby 3km", "type": "nearby"},
    ]

    def _next_id(collection):
        return str(len(collection) + 1)

    def _normalize_optional(value):
        """Normalize optional values; treat None-like strings as missing."""
        if value in (None, "", "None", "null", "undefined"):
            return None
        return value

    @app.route("/api/health")
    @app.route("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    # ---- Communities ----
    @app.route("/api/communities", methods=["GET"])
    def get_communities():
        return jsonify(communities), 200

    @app.route("/api/communities/<int:community_id>", methods=["GET"])
    def get_community(community_id):
        for c in communities:
            if c["id"] == community_id:
                return jsonify(c), 200
        return jsonify({"error": "Not found"}), 404

    # ---- Listings ----
    @app.route("/api/listings", methods=["GET", "POST"])
    def listings():
        if request.method == "GET":
            filters = {
                "category": request.args.get("category"),
                "community_id": request.args.get("community_id"),
                "q": request.args.get("q"),
            }
            items = db.list_items(filters)
            return jsonify(items), 200

        # POST create listing (JSON or multipart)
        images = []
        if request.form:
            form = request.form
            title = form.get("title", "").strip()
            price = form.get("price")
            category = form.get("category") or "other"
            description = form.get("description", "")
            meetup_point = form.get("meetup_point", "")
            user_id = form.get("user_id") or "1"
            course_code = form.get("course_code")
            community_id = form.get("community_id")
            # Handle uploaded images if present
            if request.files:
                for f in request.files.getlist("images"):
                    if not f or f.filename == "":
                        continue
                    filename = secure_filename(f.filename)
                    unique_name = f"{uuid.uuid4().hex}_{filename}"
                    dest = UPLOAD_DIR / unique_name
                    f.save(dest)
                    images.append(f"/static/uploads/{unique_name}")
        else:
            payload = request.get_json(force=True, silent=True) or {}
            title = (payload.get("title") or payload.get("name") or "").strip()
            price = payload.get("price")
            category = payload.get("category") or "other"
            description = payload.get("description", "")
            meetup_point = payload.get("meetup_point", "")
            user_id = payload.get("user_id") or "1"
            course_code = payload.get("course_code")
            community_id = payload.get("community_id")

        if not title or price is None:
            return jsonify({"error": "title and price are required"}), 400
        try:
            price_val = float(price)
        except (TypeError, ValueError):
            return jsonify({"error": "price must be a number"}), 400

        user_info = users.get(user_id) or {"id": user_id, "nickname": "Seller", "verify_status": "email_verified"}
        listing = db.create_item(
            title=title,
            price=price_val,
            description=description,
            category=category,
            meetup_point=meetup_point,
            user_id=user_id,
            user=user_info,
            course_code=course_code,
            community_id=community_id,
            images=images if images else None,
        )
        return jsonify(listing), 201

    @app.route("/api/listings/<item_id>", methods=["GET"])
    def get_listing(item_id):
        item = db.get_item(item_id)
        if not item:
            return jsonify({"error": "Not found"}), 404
        return jsonify(item), 200

    @app.route("/api/listings/search", methods=["GET"])
    def search_listings():
        q = request.args.get("q")
        items = db.list_items({"q": q})
        return jsonify(items), 200

    @app.route("/api/users/<user_id>/listings", methods=["GET"])
    def get_user_listings(user_id):
        items = db.list_items({"user_id": user_id})
        return jsonify(items), 200

    # ---- Auth (demo-grade) ----
    @app.route("/api/auth/register", methods=["POST"])
    def register():
        payload = request.get_json(force=True, silent=True) or {}
        email = (payload.get("email") or "").lower().strip()
        password = payload.get("password") or ""
        nickname = payload.get("nickname") or "User"
        community_id = payload.get("community_id")
        if not email or not password:
            return jsonify({"error": "email and password required"}), 400

        user_id = _next_id(users)
        user = {
            "id": user_id,
            "email": email,
            "nickname": nickname,
            "community_id": community_id,
            "verify_status": "email_verified",
            "avatar": None,
        }
        users[user_id] = {**user, "password": password}
        token = f"token-{user_id}"
        auth_tokens[token] = user_id
        return jsonify({"token": token, "user": user}), 201

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        payload = request.get_json(force=True, silent=True) or {}
        email = (payload.get("email") or "").lower().strip()
        password = payload.get("password") or ""
        for user_id, info in users.items():
            if info.get("email") == email and info.get("password") == password:
                user = {k: v for k, v in info.items() if k != "password"}
                token = f"token-{user_id}"
                auth_tokens[token] = user_id
                return jsonify({"token": token, "user": user}), 200
        return jsonify({"error": "Invalid credentials"}), 401

    @app.route("/api/users/<user_id>", methods=["GET"])
    def get_user(user_id):
        user = users.get(user_id)
        if not user:
            return jsonify({"error": "Not found"}), 404
        return jsonify({k: v for k, v in user.items() if k != "password"}), 200

    @app.route("/api/users/<user_id>/avatar", methods=["POST"])
    def upload_avatar(user_id):
        user = users.get(user_id)
        if not user:
            return jsonify({"error": "Not found"}), 404
        upload = request.files.get("avatar")
        if upload and upload.filename:
            filename = secure_filename(upload.filename)
            unique_name = f"{uuid.uuid4().hex}_{filename}"
            dest = UPLOAD_DIR / unique_name
            upload.save(dest)
            user["avatar"] = f"/static/uploads/{unique_name}"
        else:
            # Fallback placeholder
            user["avatar"] = f"https://placehold.co/120x120?text={user.get('nickname','User')}"
        return jsonify({"user": {k: v for k, v in user.items() if k != "password"}}), 200

    # ---- Favorites (in-memory) ----
    @app.route("/api/favorites", methods=["POST"])
    def add_favorite():
        payload = request.get_json(force=True, silent=True) or {}
        user_id = payload.get("user_id")
        listing_id = payload.get("listing_id")
        if not user_id or not listing_id or user_id == "None" or listing_id == "None":
            return jsonify({"error": "user_id and listing_id required"}), 400
        user_id = str(user_id)
        listing_id = str(listing_id)
        favorites.setdefault(user_id, set()).add(listing_id)
        return jsonify({"ok": True}), 201

    @app.route("/api/favorites/<listing_id>", methods=["DELETE"])
    def remove_favorite(listing_id):
        user_id = request.args.get("user_id")
        if not user_id:
            return jsonify({"error": "user_id required"}), 400
        if user_id in favorites:
            favorites[user_id].discard(str(listing_id))
        return jsonify({"ok": True}), 200

    @app.route("/api/users/<user_id>/favorites", methods=["GET"])
    def get_user_favorites(user_id):
        fav_ids = list(favorites.get(user_id, []))
        items = [db.get_item(fid) for fid in fav_ids]
        items = [i for i in items if i]
        return jsonify({"favorites": items, "favorite_ids": fav_ids}), 200

    # ---- Threads & messages (Mongo-backed) ----
    @app.route("/api/threads", methods=["POST"])
    def create_thread():
        payload = request.get_json(force=True, silent=True) or {}
        raw_buyer_id = payload.get("buyer_id")
        raw_seller_id = payload.get("seller_id")
        raw_listing_id = payload.get("listing_id")

        buyer_id = _normalize_optional(raw_buyer_id)
        seller_id = _normalize_optional(raw_seller_id)
        listing_id = _normalize_optional(raw_listing_id)

        if not buyer_id or not seller_id or not listing_id:
            return jsonify({"error": "buyer_id, seller_id, listing_id required"}), 400

        buyer_id = str(buyer_id)
        seller_id = str(seller_id)
        listing_id = str(listing_id)

        # Ensure listing exists
        listing = db.get_item(listing_id)
        if not listing:
            return jsonify({"error": "listing not found"}), 404

        # Optional: ensure seller matches listing owner if present
        listing_seller_id = str(listing.get("user_id") or "")
        if listing_seller_id and listing_seller_id != seller_id:
            return jsonify({"error": "seller_id does not match listing owner"}), 400

        if buyer_id == seller_id:
            return jsonify({"error": "buyer and seller cannot be the same user"}), 400

        thread = db.create_thread(buyer_id=buyer_id, seller_id=seller_id, listing_id=listing_id)
        return jsonify(thread), 201

    @app.route("/api/threads/<user_id>", methods=["GET"])
    def get_threads(user_id):
        user_threads = db.list_threads_for_user(user_id)
        return jsonify(user_threads), 200

    @app.route("/api/threads/<thread_id>/messages", methods=["GET"])
    def get_thread_messages(thread_id):
        thread = db.get_thread(thread_id)
        if not thread:
            return jsonify({"error": "thread not found"}), 404
        thread_messages = db.list_messages_for_thread(thread_id)
        return jsonify(thread_messages), 200

    @app.route("/api/messages", methods=["POST"])
    def send_message():
        payload = request.get_json(force=True, silent=True) or {}
        raw_thread_id = payload.get("thread_id")
        raw_sender_id = payload.get("sender_id")
        content = (payload.get("content") or "").strip()

        thread_id = _normalize_optional(raw_thread_id)
        sender_id = _normalize_optional(raw_sender_id)

        if not thread_id or not sender_id or not content:
            return jsonify({"error": "thread_id, sender_id and content required"}), 400

        thread_id = str(thread_id)
        sender_id = str(sender_id)

        thread = db.get_thread(thread_id)
        if not thread:
            return jsonify({"error": "thread not found"}), 404

        # Sender must be part of the thread
        if sender_id not in (thread["buyer_id"], thread["seller_id"]):
            return jsonify({"error": "sender is not part of this thread"}), 403

        message = db.create_message(thread_id=thread_id, sender_id=sender_id, content=content)
        return jsonify(message), 201

    @app.route("/api/messages/<user_id>/unread-count", methods=["GET"])
    def unread_count(user_id):
        # Demo: no unread tracking
        return jsonify({"unread": 0}), 200

    # ---- Reports & stats (placeholders) ----
    @app.route("/api/reports", methods=["POST", "GET"])
    def handle_reports():
        if request.method == "POST":
            payload = request.get_json(force=True, silent=True) or {}
            reports.append(payload)
            return jsonify({"ok": True}), 201
        return jsonify(reports), 200

    @app.route("/api/stats/dashboard", methods=["GET"])
    def dashboard_stats():
        return jsonify(
            {
                "listings": len(db.list_items()),
                "users": len(users),
                "favorites": sum(len(v) for v in favorites.values()),
            }
        ), 200

    @app.route("/api/stats/categories", methods=["GET"])
    def category_stats():
        items = db.list_items()
        counts = {}
        for item in items:
            cat = item.get("category") or "other"
            counts[cat] = counts.get(cat, 0) + 1
        return jsonify(counts), 200

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
