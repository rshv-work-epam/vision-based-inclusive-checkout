from app.main import app
from fastapi.testclient import TestClient


def test_health_endpoints():
    client = TestClient(app)
    for path in ("/healthz", "/readyz", "/livez"):
        r = client.get(path)
        assert r.status_code == 200
        assert isinstance(r.json(), dict)
