from typing import Annotated, List

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from ..core.product_matcher import get_product_matcher
from ..core.openai_fallback import get_openai_fallback_classifier

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
    contents = await file.read()
    array = np.frombuffer(contents, dtype=np.uint8)
    bgr = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode uploaded image.")

    matcher = get_product_matcher()
    predictions = matcher.predict(bgr)
    if not predictions:
        fallback = get_openai_fallback_classifier()
        predictions = fallback.predict(bgr)
    return {"predictions": predictions}
