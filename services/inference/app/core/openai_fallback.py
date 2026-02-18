import base64
import csv
import json
import logging
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from openai import OpenAI

from .config import get_settings
from .product_matcher import _center_crop, _resize_max_side

logger = logging.getLogger(__name__)


def _load_catalog_labels(catalog_csv_path: Path) -> list[str]:
    labels: list[str] = []
    try:
        with catalog_csv_path.open("r", newline="", encoding="utf-8") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                sku = (row.get("sku") or "").strip()
                name = (row.get("name") or "").strip()
                if not sku and not name:
                    continue
                labels.append(name or sku)
    except FileNotFoundError:
        logger.warning("Catalog CSV not found (OpenAI fallback): %s", catalog_csv_path)
        return []
    except Exception:
        logger.exception(
            "Failed to read catalog CSV for OpenAI fallback: %s", catalog_csv_path
        )
        return []

    # De-dupe while preserving order.
    seen: set[str] = set()
    unique: list[str] = []
    for label in labels:
        if label in seen:
            continue
        seen.add(label)
        unique.append(label)
    return unique


class OpenAIFallbackClassifier:
    def __init__(
        self,
        *,
        enabled: bool,
        api_key: str | None,
        model: str,
        timeout_s: float,
        min_confidence: float,
        catalog_csv_path: str,
        max_query_side_px: int,
        center_crop_frac: float,
        top_k: int,
    ) -> None:
        self._enabled = bool(enabled)
        self._api_key = api_key
        self._model = model
        self._timeout_s = float(max(1.0, timeout_s))
        self._min_confidence = float(max(0.0, min(1.0, min_confidence)))
        self._catalog_csv_path = Path(catalog_csv_path)
        self._max_query_side_px = int(max(64, max_query_side_px))
        self._center_crop_frac = float(max(0.0, min(1.0, center_crop_frac)))
        self._top_k = int(max(1, top_k))

        self._labels = _load_catalog_labels(self._catalog_csv_path)

        self._client: OpenAI | None = None
        if self._enabled and self._api_key:
            # openai-python uses httpx; `timeout` is in seconds.
            self._client = OpenAI(api_key=self._api_key, timeout=self._timeout_s)

    def predict(self, bgr: np.ndarray) -> list[dict]:
        if not self._client:
            return []
        if not self._labels:
            return []

        # Keep payloads small and focus on the main object.
        bgr = _resize_max_side(bgr, self._max_query_side_px)
        bgr = _center_crop(bgr, self._center_crop_frac)

        ok, buffer = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        if not ok:
            return []

        b64 = base64.b64encode(buffer.tobytes()).decode("ascii")

        # Avoid huge prompts if a user loads a very large catalog.
        labels = self._labels[:200]

        schema = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "predictions": {
                    "type": "array",
                    "maxItems": self._top_k,
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "label": {"type": "string", "enum": labels + ["unknown"]},
                            "confidence": {"type": "number"},
                        },
                        "required": ["label", "confidence"],
                    },
                }
            },
            "required": ["predictions"],
        }

        prompt = (
            "You are a product recognition system for a self-checkout.\n"
            "Choose up to the top "
            f"{self._top_k} labels from the allowed list that best match the image.\n"
            "If none of the labels fit, return an empty predictions list.\n\n"
            "Allowed labels:\n- "
            + "\n- ".join(labels)
        )

        try:
            resp = self._client.responses.create(
                model=self._model,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_text", "text": prompt},
                            {
                                "type": "input_image",
                                "image_url": f"data:image/jpeg;base64,{b64}",
                            },
                        ],
                    }
                ],
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "vbic_product_predictions",
                        "schema": schema,
                        "strict": True,
                    }
                },
            )
        except Exception:
            logger.exception("OpenAI fallback failed.")
            return []

        try:
            payload = json.loads(resp.output_text or "{}")
        except Exception:
            logger.warning("OpenAI fallback returned non-JSON output.")
            return []

        raw = payload.get("predictions") or []
        if not isinstance(raw, list):
            return []

        predictions: list[dict] = []
        for item in raw:
            if not isinstance(item, dict):
                continue

            label = item.get("label")
            if not isinstance(label, str):
                continue
            if label == "unknown":
                continue

            try:
                conf = float(item.get("confidence", 0.0))
            except Exception:
                conf = 0.0
            conf = max(0.0, min(1.0, conf))
            if conf < self._min_confidence:
                continue

            predictions.append({"label": label, "confidence": conf, "box": None})

        predictions.sort(key=lambda p: p["confidence"], reverse=True)
        return predictions[: self._top_k]


@lru_cache(maxsize=1)
def get_openai_fallback_classifier() -> OpenAIFallbackClassifier:
    s = get_settings()
    return OpenAIFallbackClassifier(
        enabled=s.openai_enabled,
        api_key=s.openai_api_key,
        model=s.openai_model,
        timeout_s=s.openai_timeout_s,
        min_confidence=s.openai_min_confidence,
        catalog_csv_path=s.catalog_csv_path,
        max_query_side_px=s.max_query_side_px,
        center_crop_frac=s.center_crop_frac,
        top_k=s.top_k,
    )

