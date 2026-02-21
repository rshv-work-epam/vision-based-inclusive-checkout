#!/usr/bin/env python3
"""Evaluate inference quality on local manifests.

This script runs three checks against a local inference endpoint:
1) Top-1 accuracy on positive store samples.
2) False-positive rate on negative/non-product samples.
3) Confidence margin diagnostics (top1 - top2) for debugging threshold tuning.
"""

from __future__ import annotations

import argparse
import csv
import json
import mimetypes
import sys
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Sample:
    kind: str  # "positive" or "negative"
    slug: str
    local_path: Path
    expected_label: str
    source_manifest: Path


def _build_multipart_form(file_name: str, file_bytes: bytes) -> tuple[bytes, str]:
    boundary = f"----vbic-{uuid.uuid4().hex}"
    content_type = mimetypes.guess_type(file_name)[0] or "application/octet-stream"
    head = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{file_name}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8")
    tail = f"\r\n--{boundary}--\r\n".encode("utf-8")
    return head + file_bytes + tail, boundary


def _predict(endpoint: str, image_path: Path, timeout_s: float) -> list[dict[str, Any]]:
    body, boundary = _build_multipart_form(image_path.name, image_path.read_bytes())
    req = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    with urllib.request.urlopen(req, timeout=timeout_s) as response:
        payload = json.loads(response.read().decode("utf-8"))
    predictions = payload.get("predictions", [])
    if not isinstance(predictions, list):
        return []
    result: list[dict[str, Any]] = []
    for item in predictions:
        if isinstance(item, dict):
            result.append(item)
    return result


def _load_samples(
    manifests: list[Path],
    kind: str,
    status_field: str,
    path_field: str,
    slug_field: str,
    expected_field: str | None = None,
) -> list[Sample]:
    samples: list[Sample] = []
    for manifest in manifests:
        with manifest.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                if (row.get(status_field) or "").strip().lower() != "ok":
                    continue
                local_path_str = (row.get(path_field) or "").strip()
                if not local_path_str:
                    continue
                local_path = Path(local_path_str)
                if not local_path.exists():
                    continue
                slug = (row.get(slug_field) or "").strip()
                if not slug:
                    slug = local_path.stem
                expected = ""
                if expected_field:
                    expected = (row.get(expected_field) or "").strip()
                samples.append(
                    Sample(
                        kind=kind,
                        slug=slug,
                        local_path=local_path,
                        expected_label=expected,
                        source_manifest=manifest,
                    )
                )
    return samples


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--endpoint",
        default="http://localhost:8002/predict",
        help="Inference endpoint URL.",
    )
    parser.add_argument(
        "--positive-manifest",
        action="append",
        default=[],
        help=(
            "CSV with positive samples. Needs columns: status, local_path, slug, "
            "expected_label. Can be passed multiple times."
        ),
    )
    parser.add_argument(
        "--negative-manifest",
        action="append",
        default=[],
        help=(
            "CSV with negative samples. Needs columns: status, local_path, slug. "
            "Can be passed multiple times."
        ),
    )
    parser.add_argument(
        "--output-csv",
        default="data/new_store_images/eval_predictions.csv",
        help="Where to write per-sample results.",
    )
    parser.add_argument(
        "--summary-json",
        default="data/new_store_images/eval_summary.json",
        help="Where to write summary metrics JSON.",
    )
    parser.add_argument(
        "--timeout-s",
        type=float,
        default=20.0,
        help="Per-request timeout in seconds.",
    )
    parser.add_argument(
        "--min-positive-accuracy",
        type=float,
        default=0.95,
        help="Fail if positive top-1 accuracy is below this value.",
    )
    parser.add_argument(
        "--max-negative-fp-rate",
        type=float,
        default=0.10,
        help="Fail if negative false-positive rate is above this value.",
    )
    parser.add_argument(
        "--no-enforce-gates",
        action="store_true",
        help="Do not fail the process when quality gates are violated.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    positive_manifests = [Path(item) for item in args.positive_manifest]
    negative_manifests = [Path(item) for item in args.negative_manifest]

    if not positive_manifests:
        positive_manifests = [
            Path("data/new_store_images/manifest.csv"),
            Path("data/new_store_images/holdout/manifest.csv"),
        ]
    if not negative_manifests:
        negative_manifests = [Path("data/new_store_images/negatives_v2/manifest.csv")]

    for manifest in [*positive_manifests, *negative_manifests]:
        if not manifest.exists():
            print(f"Missing manifest: {manifest}", file=sys.stderr)
            return 2

    positives = _load_samples(
        manifests=positive_manifests,
        kind="positive",
        status_field="status",
        path_field="local_path",
        slug_field="slug",
        expected_field="expected_label",
    )
    negatives = _load_samples(
        manifests=negative_manifests,
        kind="negative",
        status_field="status",
        path_field="local_path",
        slug_field="slug",
    )
    samples = [*positives, *negatives]
    if not samples:
        print("No valid samples found in manifests.", file=sys.stderr)
        return 2

    rows: list[dict[str, Any]] = []
    positives_total = 0
    positives_correct = 0
    positives_with_predictions = 0
    negatives_total = 0
    negatives_false_positives = 0
    request_errors = 0

    for idx, sample in enumerate(samples, start=1):
        try:
            predictions = _predict(args.endpoint, sample.local_path, timeout_s=args.timeout_s)
            error_text = ""
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
            predictions = []
            error_text = str(exc)
            request_errors += 1

        top1 = predictions[0] if predictions else {}
        top2 = predictions[1] if len(predictions) > 1 else {}
        top1_label = str(top1.get("label") or "")
        top2_label = str(top2.get("label") or "")
        top1_conf = _to_float(top1.get("confidence"))
        top2_conf = _to_float(top2.get("confidence"))
        margin = max(0.0, top1_conf - top2_conf)

        is_expected_match = sample.kind == "positive" and top1_label == sample.expected_label
        is_false_positive = sample.kind == "negative" and bool(predictions)

        if sample.kind == "positive":
            positives_total += 1
            if predictions:
                positives_with_predictions += 1
            if is_expected_match:
                positives_correct += 1
        else:
            negatives_total += 1
            if is_false_positive:
                negatives_false_positives += 1

        row = {
            "kind": sample.kind,
            "slug": sample.slug,
            "source_manifest": str(sample.source_manifest),
            "local_path": str(sample.local_path),
            "expected_label": sample.expected_label,
            "top1_label": top1_label,
            "top1_confidence": f"{top1_conf:.6f}",
            "top2_label": top2_label,
            "top2_confidence": f"{top2_conf:.6f}",
            "margin_top1_minus_top2": f"{margin:.6f}",
            "prediction_count": len(predictions),
            "is_expected_match": is_expected_match,
            "is_false_positive": is_false_positive,
            "error": error_text,
            "raw_predictions_json": json.dumps(predictions, ensure_ascii=False),
        }
        rows.append(row)

        print(
            f"[{idx:03d}/{len(samples):03d}] {sample.kind} {sample.slug} "
            f"top1={top1_label or '-'} c1={top1_conf:.4f} margin={margin:.4f} "
            f"predictions={len(predictions)}"
        )

    positive_accuracy = (
        float(positives_correct) / float(positives_total) if positives_total else 0.0
    )
    negative_fp_rate = (
        float(negatives_false_positives) / float(negatives_total) if negatives_total else 0.0
    )
    positive_coverage = (
        float(positives_with_predictions) / float(positives_total) if positives_total else 0.0
    )

    summary = {
        "endpoint": args.endpoint,
        "positives_total": positives_total,
        "positives_with_predictions": positives_with_predictions,
        "positives_correct_top1": positives_correct,
        "positive_accuracy": positive_accuracy,
        "positive_coverage": positive_coverage,
        "negatives_total": negatives_total,
        "negative_false_positives": negatives_false_positives,
        "negative_false_positive_rate": negative_fp_rate,
        "request_errors": request_errors,
        "min_positive_accuracy_gate": args.min_positive_accuracy,
        "max_negative_fp_rate_gate": args.max_negative_fp_rate,
        "pass_positive_gate": positive_accuracy >= args.min_positive_accuracy,
        "pass_negative_gate": negative_fp_rate <= args.max_negative_fp_rate,
    }

    output_csv = Path(args.output_csv)
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    summary_json = Path(args.summary_json)
    summary_json.parent.mkdir(parents=True, exist_ok=True)
    summary_json.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    print("")
    print("Summary")
    print(f"- Positive accuracy: {positive_accuracy:.3%} ({positives_correct}/{positives_total})")
    print(
        f"- Positive coverage: {positive_coverage:.3%} "
        f"({positives_with_predictions}/{positives_total})"
    )
    print(
        f"- Negative false-positive rate: {negative_fp_rate:.3%} "
        f"({negatives_false_positives}/{negatives_total})"
    )
    print(f"- Request errors: {request_errors}")
    print(f"- Results CSV: {output_csv}")
    print(f"- Summary JSON: {summary_json}")

    if args.no_enforce_gates:
        return 0
    if summary["pass_positive_gate"] and summary["pass_negative_gate"]:
        return 0

    print("")
    print("Quality gates failed.", file=sys.stderr)
    if not summary["pass_positive_gate"]:
        print(
            f"- positive_accuracy {positive_accuracy:.3%} < {args.min_positive_accuracy:.3%}",
            file=sys.stderr,
        )
    if not summary["pass_negative_gate"]:
        print(
            f"- negative_false_positive_rate {negative_fp_rate:.3%} > {args.max_negative_fp_rate:.3%}",
            file=sys.stderr,
        )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
