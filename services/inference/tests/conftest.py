import os

# Avoid OTLP exporter retries keeping `pytest` alive when no collector is running.
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

