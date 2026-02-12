from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from typing import List

router = APIRouter()

class Box(BaseModel):
    x: int
    y: int
    w: int
    h: int

class Prediction(BaseModel):
    label: str
    confidence: float
    box: Box | None = None

class PredictResponse(BaseModel):
    predictions: List[Prediction]

@router.post("/predict", response_model=PredictResponse)
async def predict(file: UploadFile = File(...)):
    # Dummy prediction stub; in real life, run model inference here
    name = (file.filename or "").lower()
    label = "apple" if "apple" in name else "product"
    return {
        "predictions": [
            {"label": label, "confidence": 0.91, "box": {"x": 10, "y": 20, "w": 100, "h": 80}}
        ]
    }
