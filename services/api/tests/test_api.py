import os
import pytest
from services.api.app import create_app


@pytest.fixture()
def client():
    os.environ["USE_MOCK_DB"] = "1"
    app = create_app(testing=True)
    app.config.update({"TESTING": True})
    with app.test_client() as client:
        yield client
    os.environ.pop("USE_MOCK_DB", None)


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ok"


def test_create_and_list_items(client):
    payload = {"name": "Book", "price": 10.5, "description": "CS"}
    resp = client.post("/api/items", json=payload)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["name"] == payload["name"]
    assert data["price"] == payload["price"]

    list_resp = client.get("/api/items")
    assert list_resp.status_code == 200
    items = list_resp.get_json()
    assert any(it["name"] == "Book" for it in items)


def test_create_item_validation(client):
    resp = client.post("/api/items", json={"price": 1})
    assert resp.status_code == 400
    resp = client.post("/api/items", json={"name": "", "price": "abc"})
    assert resp.status_code == 400
