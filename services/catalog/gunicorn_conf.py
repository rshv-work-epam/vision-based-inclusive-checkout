import multiprocessing
import os

bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8080")
workers = (multiprocessing.cpu_count() * 2) + 1
worker_class = "uvicorn.workers.UvicornWorker"
threads = 2
accesslog = "-"
errorlog = "-"
loglevel = "info"
