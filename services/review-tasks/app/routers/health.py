from fastapi import APIRouter
import time

router = APIRouter()

@router.get("/healthz")
def healthz():
    return {"status": "ok"}

@router.get("/readyz")
def readyz():
    return {"status": "ready"}

@router.get("/livez")
def livez():
    return {"status": "alive", "ts": time.time()}
