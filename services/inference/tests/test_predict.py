import io

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.product_matcher import get_product_matcher
from app.main import app


def _encode_jpeg(image: np.ndarray) -> bytes:
    ok, buffer = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    assert ok
    return buffer.tobytes()


def _make_reference_image(text: str) -> np.ndarray:
    image = np.full((480, 640, 3), 255, dtype=np.uint8)
    cv2.rectangle(image, (20, 20), (620, 460), (0, 0, 0), 3)
    cv2.putText(
        image,
        text,
        (60, 280),
        cv2.FONT_HERSHEY_SIMPLEX,
        2.5,
        (0, 0, 0),
        6,
        cv2.LINE_AA,
    )
    return image


def test_predict_matches_reference(monkeypatch, tmp_path):
    catalog = tmp_path / "catalog.csv"
    catalog.write_text(
        "sku,name,price_cents\n1001,Apple,50\n1002,Banana,30\n", encoding="utf-8"
    )

    images = tmp_path / "images"
    apple_dir = images / "1001"
    banana_dir = images / "1002"
    apple_dir.mkdir(parents=True)
    banana_dir.mkdir(parents=True)

    apple_ref = apple_dir / "ref.jpg"
    banana_ref = banana_dir / "ref.jpg"
    apple_ref.write_bytes(_encode_jpeg(_make_reference_image("APPLE")))
    banana_ref.write_bytes(_encode_jpeg(_make_reference_image("BANANA")))

    monkeypatch.setenv("VBIC_CATALOG_CSV_PATH", str(catalog))
    monkeypatch.setenv("VBIC_REFERENCE_IMAGES_DIR", str(images))
    monkeypatch.setenv("VBIC_MIN_REF_DESCRIPTORS", "0")

    get_settings.cache_clear()
    get_product_matcher.cache_clear()

    client = TestClient(app)
    query_bytes = apple_ref.read_bytes()
    r = client.post(
        "/predict",
        files={"file": ("query.jpg", io.BytesIO(query_bytes), "image/jpeg")},
    )
    assert r.status_code == 200
    payload = r.json()
    assert payload["predictions"]
    assert payload["predictions"][0]["label"] == "Apple"
    assert payload["predictions"][0]["confidence"] > 0.0


def test_predict_no_confident_match(monkeypatch, tmp_path):
    catalog = tmp_path / "catalog.csv"
    catalog.write_text(
        "sku,name,price_cents\n1001,Apple,50\n1002,Banana,30\n", encoding="utf-8"
    )

    images = tmp_path / "images"
    apple_dir = images / "1001"
    apple_dir.mkdir(parents=True)
    (apple_dir / "ref.jpg").write_bytes(_encode_jpeg(_make_reference_image("APPLE")))

    monkeypatch.setenv("VBIC_CATALOG_CSV_PATH", str(catalog))
    monkeypatch.setenv("VBIC_REFERENCE_IMAGES_DIR", str(images))
    monkeypatch.setenv("VBIC_MIN_REF_DESCRIPTORS", "0")

    get_settings.cache_clear()
    get_product_matcher.cache_clear()

    client = TestClient(app)
    blank = np.full((480, 640, 3), 255, dtype=np.uint8)
    r = client.post(
        "/predict",
        files={"file": ("blank.jpg", io.BytesIO(_encode_jpeg(blank)), "image/jpeg")},
    )
    assert r.status_code == 200
    payload = r.json()
    assert payload["predictions"] == []


def test_predict_rejects_ambiguous_top_match_with_margin_gate(monkeypatch, tmp_path):
    catalog = tmp_path / "catalog.csv"
    catalog.write_text(
        "sku,name,price_cents\n1001,Apple,50\n1002,Banana,30\n", encoding="utf-8"
    )

    images = tmp_path / "images"
    apple_dir = images / "1001"
    banana_dir = images / "1002"
    apple_dir.mkdir(parents=True)
    banana_dir.mkdir(parents=True)

    # Use the exact same reference image for two labels so the confidence margin is ~0.
    shared_reference = _encode_jpeg(_make_reference_image("FRUIT"))
    (apple_dir / "ref.jpg").write_bytes(shared_reference)
    (banana_dir / "ref.jpg").write_bytes(shared_reference)

    monkeypatch.setenv("VBIC_CATALOG_CSV_PATH", str(catalog))
    monkeypatch.setenv("VBIC_REFERENCE_IMAGES_DIR", str(images))
    monkeypatch.setenv("VBIC_MIN_REF_DESCRIPTORS", "0")
    monkeypatch.setenv("VBIC_MIN_CONFIDENCE", "0.05")
    monkeypatch.setenv("VBIC_MIN_TOP_ORB_CONFIDENCE", "0.0")
    monkeypatch.setenv("VBIC_MIN_SCORE_MARGIN", "0.05")

    get_settings.cache_clear()
    get_product_matcher.cache_clear()

    client = TestClient(app)
    r = client.post(
        "/predict",
        files={"file": ("query.jpg", io.BytesIO(shared_reference), "image/jpeg")},
    )
    assert r.status_code == 200
    payload = r.json()
    assert payload["predictions"] == []
