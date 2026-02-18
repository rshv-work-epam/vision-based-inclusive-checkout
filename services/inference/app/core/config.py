from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    log_level: str = "INFO"
    otlp_endpoint: str = "http://otel-collector:4317"
    otel_service_name: str = "inference"

    # Optional: use OpenAI (or another mainstream hosted model) as a fallback when
    # reference-image matching returns no confident predictions.
    openai_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices("VBIC_OPENAI_ENABLED", "OPENAI_ENABLED"),
    )
    openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("VBIC_OPENAI_API_KEY", "OPENAI_API_KEY"),
    )
    openai_model: str = Field(
        default="gpt-4.1-mini",
        validation_alias=AliasChoices("VBIC_OPENAI_MODEL", "OPENAI_MODEL"),
    )
    openai_timeout_s: float = Field(
        default=10.0,
        validation_alias=AliasChoices("VBIC_OPENAI_TIMEOUT_S", "OPENAI_TIMEOUT_S"),
    )
    openai_min_confidence: float = Field(
        default=0.35,
        validation_alias=AliasChoices("VBIC_OPENAI_MIN_CONFIDENCE", "OPENAI_MIN_CONFIDENCE"),
    )

    catalog_csv_path: str = Field(
        default="/app/data/catalog.csv",
        validation_alias=AliasChoices("VBIC_CATALOG_CSV_PATH", "CATALOG_CSV_PATH"),
    )
    reference_images_dir: str = Field(
        default="/app/data/images",
        validation_alias=AliasChoices("VBIC_REFERENCE_IMAGES_DIR", "REFERENCE_IMAGES_DIR"),
    )
    max_query_side_px: int = Field(
        default=640,
        validation_alias=AliasChoices("VBIC_MAX_QUERY_SIDE_PX", "MAX_QUERY_SIDE_PX"),
    )
    top_k: int = Field(
        default=3,
        validation_alias=AliasChoices("VBIC_TOP_K", "TOP_K"),
    )
    min_confidence: float = Field(
        default=0.15,
        validation_alias=AliasChoices("VBIC_MIN_CONFIDENCE", "MIN_CONFIDENCE"),
    )
    orb_nfeatures: int = Field(
        default=800,
        validation_alias=AliasChoices("VBIC_ORB_NFEATURES", "ORB_NFEATURES"),
    )
    orb_ratio_test: float = Field(
        default=0.8,
        validation_alias=AliasChoices("VBIC_ORB_RATIO_TEST", "ORB_RATIO_TEST"),
    )
    min_ref_descriptors: int = Field(
        default=100,
        validation_alias=AliasChoices("VBIC_MIN_REF_DESCRIPTORS", "MIN_REF_DESCRIPTORS"),
    )
    hue_hist_bins: int = Field(
        default=60,
        validation_alias=AliasChoices("VBIC_HUE_HIST_BINS", "HUE_HIST_BINS"),
    )
    hue_sat_min: int = Field(
        default=50,
        validation_alias=AliasChoices("VBIC_HUE_SAT_MIN", "HUE_SAT_MIN"),
    )
    hue_val_min: int = Field(
        default=50,
        validation_alias=AliasChoices("VBIC_HUE_VAL_MIN", "HUE_VAL_MIN"),
    )
    hue_scale: float = Field(
        default=0.23,
        validation_alias=AliasChoices("VBIC_HUE_SCALE", "HUE_SCALE"),
    )
    # Center-crop fraction applied before feature extraction (ORB + color hist).
    # Helps reduce background-driven misclassifications in live webcam frames.
    center_crop_frac: float = Field(
        default=0.7,
        validation_alias=AliasChoices("VBIC_CENTER_CROP_FRAC", "CENTER_CROP_FRAC"),
    )

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    # Cached so we only parse environment once per process.
    return Settings()
