from fastapi.testclient import TestClient
from app.main import app


def test_tasks_crud(tmp_path, monkeypatch):
    # Use a temp sqlite file for isolation
    monkeypatch.setenv("REVIEW_TASKS_DB_URL", f"sqlite:///{tmp_path}/test.db")
    client = TestClient(app)
    # trigger startup to (re)create db
    with client:
        # list empty
        r = client.get("/tasks")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        count0 = len(r.json())

        # create one
        payload = {"label": "apple", "confidence": 0.91, "image_name": "apple.jpg"}
        r = client.post("/tasks", json=payload)
        assert r.status_code == 200
        created = r.json()
        assert created["label"] == "apple"

        # list non-empty
        r = client.get("/tasks")
        assert r.status_code == 200
        assert len(r.json()) == count0 + 1
