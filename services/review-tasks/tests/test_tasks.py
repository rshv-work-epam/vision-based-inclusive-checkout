from fastapi.testclient import TestClient
from app.main import app


def test_tasks_crud():
    client = TestClient(app)
    # list empty
    r = client.get("/tasks")
    assert r.status_code == 200
    assert r.json() == []

    # create one
    payload = {"label": "apple", "confidence": 0.91, "image_name": "apple.jpg"}
    r = client.post("/tasks", json=payload)
    assert r.status_code == 200
    created = r.json()
    assert created["label"] == "apple"

    # list non-empty
    r = client.get("/tasks")
    assert r.status_code == 200
    assert isinstance(r.json(), list) and len(r.json()) >= 1
