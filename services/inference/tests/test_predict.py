from fastapi.testclient import TestClient
from app.main import app


def test_predict_stub(tmp_path):
    client = TestClient(app)
    f = tmp_path / "apple.jpg"
    f.write_bytes(b"fakejpeg")
    with f.open("rb") as fh:
        r = client.post("/predict", files={"file": (f.name, fh, "image/jpeg")})
    assert r.status_code == 200
    data = r.json()
    assert "predictions" in data and isinstance(data["predictions"], list)
