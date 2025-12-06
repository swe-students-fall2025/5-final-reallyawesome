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

    def sort(self, key, direction):  # direction ignored other than sign
        reverse = direction == -1
        return _InMemoryCursor(sorted(self.docs, key=lambda d: d.get(key), reverse=reverse))

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

    def find_one(self, query=None):
        query = query or {}
        for doc in self._docs:
            if self._matches(doc, query):
                return doc
        return None

    def estimated_document_count(self):
        return len(self._docs)

    def _matches(self, doc, query):
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
        # Collections used by the app when running with an in-memory mock
        self.items = _InMemoryCollection()
        self.threads = _InMemoryCollection()
        self.messages = _InMemoryCollection()

    def __getitem__(self, _name):
        # Database name is ignored for the in-memory mock
        return self


class Database:
    def __init__(self, uri: str, db_name: str, use_mock: bool = False):
        self._use_mock = use_mock or os.getenv("USE_MOCK_DB") == "1"
        if self._use_mock:
            if mongomock:
                self._client = mongomock.MongoClient()
            else:
                # Fallback to lightweight in-memory collections for CI/dev
                self._client = _InMemoryDB()
        else:
            self._client = MongoClient(uri)
        self._db = self._client[db_name]
        self._ensure_indexes()

    def _ensure_indexes(self):
        # Basic index on items name for simple search
        self._db.items.create_index("name")
        # These can be no-ops for the in-memory implementation
        if hasattr(self._db, "threads"):
            self._db.threads.create_index("buyer_id")
            self._db.threads.create_index("seller_id")
        if hasattr(self._db, "messages"):
            self._db.messages.create_index("thread_id")

    # ---------- Listings ----------

    def list_items(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Return items sorted by newest first, applying optional filters."""
        filters = filters or {}
        query: Dict[str, Any] = {}

        if "community_id" in filters and filters["community_id"]:
            query["community_id"] = filters["community_id"]
        if "category" in filters and filters["category"]:
            query["category"] = filters["category"]
        if "user_id" in filters and filters["user_id"]:
            query["user_id"] = filters["user_id"]
        if "q" in filters and filters["q"]:
            # Simple text search on title
            query["title"] = {"$regex": filters["q"], "$options": "i"}

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
        # Remove internal Mongo _id and expose a string id instead
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

     # ---------- Threads ----------

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

    def get_thread(self, thread_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single thread by its id."""
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
        """Return all threads where the user is buyer or seller, newest first."""
        # Keep the query simple so it works with both MongoDB and the in-memory mock
        docs = list(self._db.threads.find())
        filtered = [
            dict(doc)
            for doc in docs
            if doc.get("buyer_id") == user_id or doc.get("seller_id") == user_id
        ]
        # Normalize id and sort by created_at descending
        for doc in filtered:
            doc["id"] = str(doc.pop("_id", ""))
        filtered.sort(key=lambda d: d.get("created_at", ""), reverse=True)
        return filtered


    # ---------- Messages ----------

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
        """Return all messages for a thread, oldest first."""
        messages: List[Dict[str, Any]] = []
        for doc in self._db.messages.find({"thread_id": thread_id}).sort("created_at", 1):
            doc = dict(doc)
            doc["id"] = str(doc.pop("_id", ""))
            messages.append(doc)
        return messages
