import csv
import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np

from .config import get_settings

logger = logging.getLogger(__name__)

_ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
_VARIANT_SUFFIX_RE = re.compile(
    r"(?:\s+Dataset|\s+Variant\s+\d+)\s*$", re.IGNORECASE
)


def _decode_image_bytes_to_bgr(data: bytes) -> np.ndarray | None:
    array = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    return image


def _ensure_gray(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return image
    return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)


def _resize_max_side(image: np.ndarray, max_side_px: int) -> np.ndarray:
    if max_side_px <= 0:
        return image
    h, w = image.shape[:2]
    max_side = max(h, w)
    if max_side <= max_side_px:
        return image
    scale = max_side_px / max_side
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)

def _center_crop(image: np.ndarray, frac: float) -> np.ndarray:
    if frac <= 0.0 or frac >= 1.0:
        return image

    h, w = image.shape[:2]
    new_w = max(1, int(round(w * frac)))
    new_h = max(1, int(round(h * frac)))
    if new_w >= w and new_h >= h:
        return image

    x0 = max(0, (w - new_w) // 2)
    y0 = max(0, (h - new_h) // 2)
    cropped = image[y0 : y0 + new_h, x0 : x0 + new_w]
    return cropped if cropped.size else image


@dataclass(frozen=True)
class _IndexedSku:
    sku: str
    label: str
    descriptors: list[np.ndarray]
    hue_hists: list[np.ndarray]

@dataclass(frozen=True)
class _ScoredLabel:
    label: str
    confidence: float
    orb_confidence: float
    hue_confidence: float


class ProductMatcher:
    def __init__(
        self,
        *,
        catalog_csv_path: str,
        reference_images_dir: str,
        max_query_side_px: int,
        top_k: int,
        min_confidence: float,
        orb_nfeatures: int,
        orb_ratio_test: float,
        min_ref_descriptors: int,
        hue_hist_bins: int,
        hue_sat_min: int,
        hue_val_min: int,
        hue_scale: float,
        min_top_orb_confidence: float,
        min_score_margin: float,
        canonicalize_variant_labels: bool,
        center_crop_frac: float,
    ) -> None:
        self._catalog_csv_path = Path(catalog_csv_path)
        self._reference_images_dir = Path(reference_images_dir)
        self._max_query_side_px = max_query_side_px
        self._top_k = max(1, top_k)
        self._min_confidence = max(0.0, min_confidence)
        self._orb_nfeatures = max(50, orb_nfeatures)
        self._orb_ratio_test = float(max(0.1, min(0.99, orb_ratio_test)))
        self._min_ref_descriptors = max(0, int(min_ref_descriptors))
        self._hue_hist_bins = max(8, int(hue_hist_bins))
        self._hue_sat_min = int(max(0, min(255, hue_sat_min)))
        self._hue_val_min = int(max(0, min(255, hue_val_min)))
        self._hue_scale = float(max(0.0, min(1.0, hue_scale)))
        self._min_top_orb_confidence = float(max(0.0, min(1.0, min_top_orb_confidence)))
        self._min_score_margin = float(max(0.0, min(1.0, min_score_margin)))
        self._canonicalize_variant_labels = bool(canonicalize_variant_labels)
        # Clamp to a sane range; too small crops can cause unstable ORB scores.
        self._center_crop_frac = float(max(0.0, min(1.0, center_crop_frac)))

        self._sku_to_label = self._load_catalog(self._catalog_csv_path)
        self._index = self._build_index(self._reference_images_dir, self._sku_to_label)

    def _compute_hue_hist(self, bgr: np.ndarray) -> np.ndarray | None:
        hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(
            hsv,
            (0, self._hue_sat_min, self._hue_val_min),
            (179, 255, 255),
        )
        if cv2.countNonZero(mask) == 0:
            return None

        hist = cv2.calcHist([hsv], [0], mask, [self._hue_hist_bins], [0, 180])
        cv2.normalize(hist, hist, norm_type=cv2.NORM_L1)
        return hist

    @staticmethod
    def _load_catalog(catalog_csv_path: Path) -> dict[str, str]:
        sku_to_label: dict[str, str] = {}
        try:
            with catalog_csv_path.open("r", newline="", encoding="utf-8") as fh:
                reader = csv.DictReader(fh)
                for row in reader:
                    sku = (row.get("sku") or "").strip()
                    name = (row.get("name") or "").strip()
                    if not sku:
                        continue
                    sku_to_label[sku] = name or sku
        except FileNotFoundError:
            logger.warning("Catalog CSV not found: %s", catalog_csv_path)
        except Exception:
            logger.exception("Failed to read catalog CSV: %s", catalog_csv_path)
        return sku_to_label

    def _build_index(
        self, reference_images_dir: Path, sku_to_label: dict[str, str]
    ) -> list[_IndexedSku]:
        if not reference_images_dir.exists():
            logger.warning("Reference images dir not found: %s", reference_images_dir)
            return []
        if not reference_images_dir.is_dir():
            logger.warning(
                "Reference images path is not a directory: %s", reference_images_dir
            )
            return []

        orb = cv2.ORB_create(nfeatures=self._orb_nfeatures)
        indexed: list[_IndexedSku] = []

        for sku_dir in sorted(p for p in reference_images_dir.iterdir() if p.is_dir()):
            sku = sku_dir.name
            label = sku_to_label.get(sku, sku)

            descriptors: list[np.ndarray] = []
            hue_hists: list[np.ndarray] = []
            for image_path in sorted(p for p in sku_dir.iterdir() if p.is_file()):
                if image_path.suffix.lower() not in _ALLOWED_IMAGE_EXTS:
                    continue
                try:
                    image_bytes = image_path.read_bytes()
                except Exception:
                    logger.warning("Could not read reference image: %s", image_path)
                    continue

                bgr = _decode_image_bytes_to_bgr(image_bytes)
                if bgr is None:
                    logger.warning("Could not decode reference image: %s", image_path)
                    continue

                bgr = _resize_max_side(bgr, self._max_query_side_px)
                bgr = _center_crop(bgr, self._center_crop_frac)

                gray = _ensure_gray(bgr)
                _, desc = orb.detectAndCompute(gray, None)
                if desc is not None and len(desc) >= self._min_ref_descriptors:
                    descriptors.append(desc)

                hue_hist = self._compute_hue_hist(bgr)
                if hue_hist is not None:
                    hue_hists.append(hue_hist)

            if descriptors or hue_hists:
                indexed.append(
                    _IndexedSku(
                        sku=sku,
                        label=label,
                        descriptors=descriptors,
                        hue_hists=hue_hists,
                    )
                )

        if not indexed:
            logger.warning("No reference images indexed from %s", reference_images_dir)
        return indexed

    @staticmethod
    def _count_good_unique_matches(
        bf: cv2.BFMatcher, query_desc: np.ndarray, ref_desc: np.ndarray, ratio: float
    ) -> int:
        try:
            matches = bf.knnMatch(query_desc, ref_desc, k=2)
        except cv2.error:
            return 0

        # Count unique train indices to avoid match inflation when a reference has fewer
        # descriptors (and multiple query descriptors map to the same train descriptor).
        good_unique: set[int] = set()
        for pair in matches:
            if len(pair) < 2:
                continue
            m, n = pair[0], pair[1]
            if m.distance < ratio * n.distance:
                good_unique.add(int(m.trainIdx))
        return len(good_unique)

    def _canonical_label(self, label: str) -> str:
        if not self._canonicalize_variant_labels:
            return label
        canonical = _VARIANT_SUFFIX_RE.sub("", label).strip()
        return canonical or label

    def predict(self, bgr: np.ndarray) -> list[dict]:
        if not self._index:
            return []

        bgr = _resize_max_side(bgr, self._max_query_side_px)
        bgr = _center_crop(bgr, self._center_crop_frac)
        gray = _ensure_gray(bgr)

        orb = cv2.ORB_create(nfeatures=self._orb_nfeatures)
        _, query_desc = orb.detectAndCompute(gray, None)
        query_hue = self._compute_hue_hist(bgr)

        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        ratio = self._orb_ratio_test

        scored: list[_ScoredLabel] = []
        for sku in self._index:
            best_orb = 0.0
            if query_desc is not None and len(query_desc) > 0 and sku.descriptors:
                for ref_desc in sku.descriptors:
                    good = self._count_good_unique_matches(bf, query_desc, ref_desc, ratio)
                    denom = max(1, min(len(query_desc), len(ref_desc)))
                    confidence = good / denom
                    if confidence > best_orb:
                        best_orb = confidence

            hue_score = 0.0
            if query_hue is not None and sku.hue_hists:
                for ref_hue in sku.hue_hists:
                    dist = cv2.compareHist(query_hue, ref_hue, cv2.HISTCMP_BHATTACHARYYA)
                    score = 1.0 - float(dist)
                    if score < 0.0:
                        score = 0.0
                    if score > 1.0:
                        score = 1.0
                    if score > hue_score:
                        hue_score = score

            confidence = max(best_orb, self._hue_scale * hue_score)
            if confidence > 0.0:
                scored.append(
                    _ScoredLabel(
                        label=self._canonical_label(sku.label),
                        confidence=float(confidence),
                        orb_confidence=float(best_orb),
                        hue_confidence=float(hue_score),
                    )
                )

        if not scored:
            logger.info("Matcher produced no candidate scores.")
            return []

        # Merge duplicate or generated variant labels to reduce ambiguity.
        merged: dict[str, _ScoredLabel] = {}
        for item in scored:
            prev = merged.get(item.label)
            if prev is None or item.confidence > prev.confidence:
                merged[item.label] = item

        ranked = sorted(merged.values(), key=lambda item: item.confidence, reverse=True)
        top = ranked[0]
        margin = (
            top.confidence - ranked[1].confidence if len(ranked) > 1 else top.confidence
        )
        preview = ", ".join(
            (
                f"{item.label}:c={item.confidence:.3f},"
                f"orb={item.orb_confidence:.3f},hue={item.hue_confidence:.3f}"
            )
            for item in ranked[:3]
        )
        logger.info("Matcher top candidates: %s | margin=%.4f", preview, margin)

        if top.confidence < self._min_confidence:
            logger.info(
                "Matcher rejected top candidate by min_confidence: top=%.4f threshold=%.4f",
                top.confidence,
                self._min_confidence,
            )
            return []
        if top.orb_confidence < self._min_top_orb_confidence:
            logger.info(
                "Matcher rejected top candidate by min_top_orb_confidence: top_orb=%.4f threshold=%.4f",
                top.orb_confidence,
                self._min_top_orb_confidence,
            )
            return []
        if len(ranked) > 1 and margin < self._min_score_margin:
            logger.info(
                "Matcher rejected top candidate by min_score_margin: margin=%.4f threshold=%.4f",
                margin,
                self._min_score_margin,
            )
            return []

        predictions: list[dict] = []
        for item in ranked[: self._top_k]:
            predictions.append(
                {
                    "label": item.label,
                    "confidence": float(item.confidence),
                    "box": None,
                }
            )
        logger.info(
            "Matcher accepted label=%s confidence=%.4f margin=%.4f",
            top.label,
            top.confidence,
            margin,
        )
        return predictions


@lru_cache(maxsize=1)
def get_product_matcher() -> ProductMatcher:
    s = get_settings()
    return ProductMatcher(
        catalog_csv_path=s.catalog_csv_path,
        reference_images_dir=s.reference_images_dir,
        max_query_side_px=s.max_query_side_px,
        top_k=s.top_k,
        min_confidence=s.min_confidence,
        orb_nfeatures=s.orb_nfeatures,
        orb_ratio_test=s.orb_ratio_test,
        min_ref_descriptors=s.min_ref_descriptors,
        hue_hist_bins=s.hue_hist_bins,
        hue_sat_min=s.hue_sat_min,
        hue_val_min=s.hue_val_min,
        hue_scale=s.hue_scale,
        min_top_orb_confidence=s.min_top_orb_confidence,
        min_score_margin=s.min_score_margin,
        canonicalize_variant_labels=s.canonicalize_variant_labels,
        center_crop_frac=s.center_crop_frac,
    )
