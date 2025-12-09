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

    def update_many(self, filter_query, update):
        """Simple in-memory update_many with $set only."""
        matched = 0
        for doc in self._docs:
            if self._matches(doc, filter_query):
                if "$set" in update:
                    for k, v in update["$set"].items():
                        doc[k] = v
                matched += 1
        return type("UpdateResult", (), {"matched_count": matched, "modified_count": matched})

    def update_one(self, filter_query, update):
        """Simplified update_one supporting $set."""
        modified = 0
        for doc in self._docs:
            if self._matches(doc, filter_query):
                if "$set" in update:
                    for k, v in update["$set"].items():
                        doc[k] = v
                modified = 1
                break
        return type("UpdateResult", (), {"matched_count": modified, "modified_count": modified})

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
        self.items = _InMemoryCollection()
        self.threads = _InMemoryCollection()
        self.messages = _InMemoryCollection()

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
            self._db.messages.create_index("receiver_id")
            self._db.messages.create_index("is_read")

    # ---------- Listings ----------

    def list_items(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        filters = filters or {}
        query: Dict[str, Any] = {}

        if filters.get("community_id"):
            query["community_id"] = filters["community_id"]
        if filters.get("category"):
            query["category"] = filters["category"]
        if filters.get("user_id"):
            query["user_id"] = filters["user_id"]
        if filters.get("q"):
            query["title"] = {"$regex": filters["q"], "$options": "i"}

        status_filter = filters.get("status")
        # Avoid filtering for "active" so items without status still show up.
        if status_filter and status_filter not in ("all", "active"):
            query["status"] = status_filter

        items: List[Dict[str, Any]] = []
        for doc in self._db.items.find(query).sort("created_at", -1):
            doc = dict(doc)
            doc["id"] = str(doc.pop("_id", ""))
            doc["status"] = doc.get("status") or "active"
            if status_filter == "active" and doc["status"] != "active":
                continue
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
            "status": "active",
        }
        item.update(extra)
        result = self._db.items.insert_one(item)
        item.pop("_id", None)
        item["id"] = str(result.inserted_id)
        return item

    def update_item(self, item_id: str, updates: Dict[str, Any]) -> bool:
        """Update a listing by id with provided fields."""
        try:
            oid = ObjectId(item_id)
        except Exception:
            return False

        result = self._db.items.update_one({"_id": oid}, {"$set": updates})
        return bool(getattr(result, "matched_count", 0))

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
                        "status": "active",
                        "user": {
                            "id": "1",
                            "nickname": "Demo Seller",
                            "verify_status": "email_verified",
                        },
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
                        "status": "active",
                        "user": {
                            "id": "2",
                            "nickname": "Student B",
                            "verify_status": "phone_verified",
                        },
                    },
                ]
            )

    # ---------- Threads ----------

    def create_thread(
        self,
        buyer_id: str,
        seller_id: str,
        listing_id: str,
        buyer_name: Optional[str] = None,
        seller_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        now = datetime.utcnow()
        doc: Dict[str, Any] = {
            "buyer_id": buyer_id,
            "seller_id": seller_id,
            "listing_id": listing_id,
            "buyer_name": buyer_name,
            "seller_name": seller_name,
            "created_at": now.isoformat(),
        }
        result = self._db.threads.insert_one(doc)
        doc.pop("_id", None)
        doc["id"] = str(result.inserted_id)
        return doc

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
            # Ensure names are present for UI display
            doc["buyer_name"] = doc.get("buyer_name") or f"User {doc.get('buyer_id')}"
            doc["seller_name"] = doc.get("seller_name") or f"User {doc.get('seller_id')}"
        filtered.sort(key=lambda d: d.get("created_at", ""), reverse=True)
        return filtered

    # ---------- Messages ----------

    def create_message(self, thread_id: str, sender_id: str, receiver_id: str, content: str) -> Dict[str, Any]:
        now = datetime.utcnow()
        doc: Dict[str, Any] = {
            "thread_id": thread_id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "content": content,
            "created_at": now.isoformat(),
            "is_read": False,
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
            if "is_read" not in doc:
                doc["is_read"] = False
            messages.append(doc)
        return messages

    def count_unread_messages(self, user_id: str) -> int:
        query = {"receiver_id": user_id, "is_read": False}
        count = 0
        for _ in self._db.messages.find(query):
            count += 1
        return count

    def mark_thread_messages_read(self, thread_id: str, user_id: str) -> None:
        query = {"thread_id": thread_id, "receiver_id": user_id, "is_read": False}
        self._db.messages.update_many(query, {"$set": {"is_read": True}})
