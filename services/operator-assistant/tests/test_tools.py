from fastapi.testclient import TestClient
from app.main import app


def test_list_tools():
    client = TestClient(app)
    r = client.get("/tools")
    assert r.status_code == 200
    tools = r.json()
    names = {t["name"] for t in tools}
    assert {"echo", "summarize"}.issubset(names)


def test_echo_tool():
    client = TestClient(app)
    payload = {"a": 1}
    r = client.post("/tools/echo", json=payload)
    assert r.status_code == 200
    assert r.json()["payload"] == payload


def test_summarize_tool():
    client = TestClient(app)
    text = "one two three four five six seven eight nine ten eleven twelve"
    r = client.post("/tools/summarize", json={"text": text})
    assert r.status_code == 200
    assert "summary" in r.json()


def test_summarize_truncates_long_text():
    client = TestClient(app)
    text = " ".join(f"word{i}" for i in range(35))
    r = client.post("/tools/summarize", json={"text": text})
    assert r.status_code == 200
    payload = r.json()
    assert payload["summary"].endswith("…")
    assert payload["length"] == len(text)
