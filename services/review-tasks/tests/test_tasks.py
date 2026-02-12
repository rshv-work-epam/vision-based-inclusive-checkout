from app.main import app
from fastapi.testclient import TestClient


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


def test_tasks_pagination_and_order(tmp_path, monkeypatch):
    monkeypatch.setenv(
        "REVIEW_TASKS_DB_URL", f"sqlite:///{tmp_path}/test-pagination.db"
    )
    client = TestClient(app)

    with client:
        for idx in range(3):
            payload = {
                "label": f"item-{idx}",
                "confidence": 0.5 + idx / 10,
                "image_name": f"item-{idx}.jpg",
            }
            response = client.post("/tasks", json=payload)
            assert response.status_code == 200

        response = client.get("/tasks", params={"limit": 2, "offset": 0})
        assert response.status_code == 200
        first_page = response.json()
        assert len(first_page) == 2
        assert first_page[0]["id"] > first_page[1]["id"]

        response = client.get("/tasks", params={"limit": 2, "offset": 2})
        assert response.status_code == 200
        second_page = response.json()
        assert len(second_page) == 1
