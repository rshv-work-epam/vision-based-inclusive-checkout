from typing import Annotated, List

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

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
async def predict(file: Annotated[UploadFile, File()]):
    # Dummy prediction stub; in real life, run model inference here
    name = (file.filename or "").lower()
    label = "apple" if "apple" in name else "product"
    return {
        "predictions": [
            {
                "label": label,
                "confidence": 0.91,
                "box": {"x": 10, "y": 20, "w": 100, "h": 80},
            }
        ]
    }
