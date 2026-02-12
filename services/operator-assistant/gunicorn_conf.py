import multiprocessing
import os

bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8080")
workers = int(os.getenv("GUNICORN_WORKERS", str(multiprocessing.cpu_count() * 2 + 1)))
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "uvicorn.workers.UvicornWorker")
threads = int(os.getenv("GUNICORN_THREADS", "1"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "30"))
accesslog = os.getenv("GUNICORN_ACCESSLOG", "-")
errorlog = os.getenv("GUNICORN_ERRORLOG", "-")
loglevel = os.getenv("GUNICORN_LOGLEVEL", "info")
request_timeout = int(os.getenv("GUNICORN_TIMEOUT", "60"))
