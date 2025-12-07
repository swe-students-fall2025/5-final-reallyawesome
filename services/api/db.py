import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pymongo import MongoClient
from bson.objectid import ObjectId

try:
    import mongomock  # type: ignore
except ImportError:  # pragma: no cover
    mongomock = None


class _InMemoryInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _InMemoryCursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, key, direction):
        reverse = direction == -1
        return _InMemoryCursor(sorted(self.docs, key=lambda d: d.get(key, ""), reverse=reverse))

    def __iter__(self):
        return iter(self.docs)


class _InMemoryCollection:
    def __init__(self):
        self._docs = []

    def create_index(self, *_args, **_kwargs):
        return None

    def insert_one(self, doc):
        new_doc = dict(doc)
        new_doc["_id"] = ObjectId()
        self._docs.append(new_doc)
        return _InMemoryInsertResult(new_doc["_id"])

    def insert_many(self, docs):
        for doc in docs:
            self.insert_one(doc)

    def find(self, query=None):
        query = query or {}
        matched = [doc for doc in self._docs if self._matches(doc, query)]
        return _InMemoryCursor(matched)

    def delete_one(self, query=None):
        query = query or {}
        for i, doc in enumerate(self._docs):
            if self._matches(doc, query):
                self._docs.pop(i)
                class _Res:
                    def __init__(self):
                        self.deleted_count = 1
                return _Res()
        class _ResZero:
            def __init__(self):
                self.deleted_count = 0
        return _ResZero()

    def find_one(self, query=None):
        query = query or {}
        for doc in self._docs:
            if self._matches(doc, query):
                return doc
        return None

    def estimated_document_count(self):
        return len(self._docs)

    def _matches(self, doc, query):
        if "$or" in query:
            or_conditions = query["$or"]
            or_match = False
            for condition in or_conditions:
                if self._matches(doc, condition):
                    or_match = True
                    break
            if not or_match:
                return False
            remaining_query = {k: v for k, v in query.items() if k != "$or"}
            if remaining_query and not self._matches(doc, remaining_query):
                return False
            return True

        for key, value in query.items():
            if isinstance(value, dict) and "$regex" in value:
                pattern = value["$regex"]
                options = value.get("$options", "")
                doc_val = str(doc.get(key, ""))
                if "i" in options.lower():
                    if pattern.lower() not in doc_val.lower():
                        return False
                else:
                    if pattern not in doc_val:
                        return False
            else:
                if doc.get(key) != value:
                    return False
        return True


class _InMemoryDB:
    def __init__(self):
        self.items = _InMemoryCollection()
        self.threads = _InMemoryCollection()
        self.messages = _InMemoryCollection()
        self.favorites = _InMemoryCollection()

    def __getitem__(self, _name):
        return self


class Database:
    def __init__(self, uri: str, db_name: str, use_mock: bool = False):
        self._use_mock = use_mock or os.getenv("USE_MOCK_DB") == "1"
        if self._use_mock:
            if mongomock:
                self._client = mongomock.MongoClient()
            else:
                self._client = _InMemoryDB()
        else:
            self._client = MongoClient(uri)
        self._db = self._client[db_name]
        self._ensure_indexes()

    def _ensure_indexes(self):
        self._db.items.create_index("name")
        if hasattr(self._db, "threads"):
            self._db.threads.create_index("buyer_id")
            self._db.threads.create_index("seller_id")
        if hasattr(self._db, "messages"):
            self._db.messages.create_index("thread_id")
        if hasattr(self._db, "favorites"):
            try:
                self._db.favorites.create_index("user_id")
                self._db.favorites.create_index("listing_id")
            except Exception:
                pass

    def list_items(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        filters = filters or {}
        query: Dict[str, Any] = {}

        if "community_id" in filters and filters["community_id"]:
            query["community_id"] = filters["community_id"]
        if "category" in filters and filters["category"]:
            query["category"] = filters["category"]
        if "user_id" in filters and filters["user_id"]:
            query["user_id"] = filters["user_id"]
        if "q" in filters and filters["q"]:
            search_term = filters["q"]
            query["$or"] = [
                {"title": {"$regex": search_term, "$options": "i"}},
                {"description": {"$regex": search_term, "$options": "i"}},
                {"course_code": {"$regex": search_term, "$options": "i"}}
            ]

        items: List[Dict[str, Any]] = []
        for doc in self._db.items.find(query).sort("created_at", -1):
            doc = dict(doc)
            doc["id"] = str(doc.pop("_id", ""))
            if "name" not in doc and "title" in doc:
                doc["name"] = doc["title"]
            items.append(doc)
        return items

    def get_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        try:
            doc = self._db.items.find_one({"_id": ObjectId(item_id)})
        except Exception:
            return None
        if not doc:
            return None
        doc = dict(doc)
        doc["id"] = str(doc.pop("_id", ""))
        if "name" not in doc and "title" in doc:
            doc["name"] = doc["title"]
        return doc

    def create_item(
        self,
        title: str,
        price: float,
        description: str = "",
        name: Optional[str] = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        now = datetime.utcnow()
        item: Dict[str, Any] = {
            "title": title,
            "name": name or title,
            "price": price,
            "description": description,
            "created_at": now.isoformat(),
        }
        item.update(extra)
        result = self._db.items.insert_one(item)
        item.pop("_id", None)
        item["id"] = str(result.inserted_id)
        return item

    def seed_if_empty(self):
        if self._db.items.estimated_document_count() == 0:
            self._db.items.insert_many(
                [
                    {
                        "title": "Welcome",
                        "name": "Welcome",
                        "price": 0,
                        "description": "Sample item",
                        "created_at": datetime.utcnow().isoformat(),
                        "category": "other",
                        "meetup_point": "Campus Center",
                        "user_id": "1",
                        "user": {"id": "1", "nickname": "Demo Seller", "verify_status": "email_verified"},
                    },
                    {
                        "title": "Notebook",
                        "name": "Notebook",
                        "price": 5.5,
                        "description": "Stationery",
                        "created_at": datetime.utcnow().isoformat(),
                        "category": "textbook",
                        "meetup_point": "Library",
                        "user_id": "2",
                        "user": {"id": "2", "nickname": "Student B", "verify_status": "phone_verified"},
                    },
                ]
            )

    def create_thread(self, buyer_id: str, seller_id: str, listing_id: str) -> Dict[str, Any]:
        now = datetime.utcnow()
        doc: Dict[str, Any] = {
            "buyer_id": buyer_id,
            "seller_id": seller_id,
            "listing_id": listing_id,
            "created_at": now.isoformat(),
        }
        result = self._db.threads.insert_one(doc)
        doc.pop("_id", None)
        doc["id"] = str(result.inserted_id)
        return doc

    def add_favorite(self, user_id: str, listing_id: str) -> bool:
        # Prevent duplicates
        existing = self._db.favorites.find_one({"user_id": user_id, "listing_id": listing_id})
        if existing:
            return False
        now = datetime.utcnow()
        doc = {"user_id": user_id, "listing_id": listing_id, "created_at": now.isoformat()}
        self._db.favorites.insert_one(doc)
        return True

    def remove_favorite(self, user_id: str, listing_id: str) -> bool:
        res = None
        try:
            res = self._db.favorites.delete_one({"user_id": user_id, "listing_id": listing_id})
            return getattr(res, 'deleted_count', 0) > 0
        except Exception:
            # best-effort for simple in-memory stores
            docs = list(self._db.favorites.find({"user_id": user_id, "listing_id": listing_id}))
            if not docs:
                return False
            # remove first matching
            try:
                self._db.favorites.delete_one({"user_id": user_id, "listing_id": listing_id})
            except Exception:
                pass
            return True

    def list_favorites_for_user(self, user_id: str) -> List[str]:
        docs = list(self._db.favorites.find({"user_id": user_id}))
        ids = [d.get("listing_id") for d in docs]
        return ids

    def list_favorite_items_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        ids = self.list_favorites_for_user(user_id)
        items = [self.get_item(i) for i in ids]
        return [i for i in items if i]

    def count_favorites(self) -> int:
        try:
            return sum(1 for _ in self._db.favorites.find())
        except Exception:
            # fallback
            try:
                return self._db.favorites.estimated_document_count()
            except Exception:
                return 0

    def get_thread(self, thread_id: str) -> Optional[Dict[str, Any]]:
        try:
            doc = self._db.threads.find_one({"_id": ObjectId(thread_id)})
        except Exception:
            return None
        if not doc:
            return None
        doc = dict(doc)
        doc["id"] = str(doc.pop("_id", ""))
        return doc

    def list_threads_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        docs = list(self._db.threads.find())
        filtered = [
            dict(doc)
            for doc in docs
            if doc.get("buyer_id") == user_id or doc.get("seller_id") == user_id
        ]
        for doc in filtered:
            doc["id"] = str(doc.pop("_id", ""))
        filtered.sort(key=lambda d: d.get("created_at", ""), reverse=True)
        return filtered

    def create_message(self, thread_id: str, sender_id: str, content: str) -> Dict[str, Any]:
        now = datetime.utcnow()
        doc: Dict[str, Any] = {
            "thread_id": thread_id,
            "sender_id": sender_id,
            "content": content,
            "created_at": now.isoformat(),
        }
        result = self._db.messages.insert_one(doc)
        doc.pop("_id", None)
        doc["id"] = str(result.inserted_id)
        return doc

    def list_messages_for_thread(self, thread_id: str) -> List[Dict[str, Any]]:
        messages: List[Dict[str, Any]] = []
        for doc in self._db.messages.find({"thread_id": thread_id}).sort("created_at", 1):
            doc = dict(doc)
            doc["id"] = str(doc.pop("_id", ""))
            messages.append(doc)
        return messages