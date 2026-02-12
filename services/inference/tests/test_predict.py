from app.main import app
from fastapi.testclient import TestClient


def test_predict_stub_apple_label(tmp_path):
    client = TestClient(app)
    f = tmp_path / "apple.jpg"
    f.write_bytes(b"fakejpeg")
    with f.open("rb") as fh:
        r = client.post("/predict", files={"file": (f.name, fh, "image/jpeg")})
    assert r.status_code == 200
    data = r.json()
    assert "predictions" in data and isinstance(data["predictions"], list)
    assert data["predictions"][0]["label"] == "apple"


def test_predict_stub_generic_label(tmp_path):
    client = TestClient(app)
    f = tmp_path / "mystery-item.jpg"
    f.write_bytes(b"fakejpeg")
    with f.open("rb") as fh:
        r = client.post("/predict", files={"file": (f.name, fh, "image/jpeg")})
    assert r.status_code == 200
    payload = r.json()
    prediction = payload["predictions"][0]
    assert prediction["label"] == "product"
    assert prediction["confidence"] == 0.91
    assert {"x", "y", "w", "h"}.issubset(set(prediction["box"].keys()))
