from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/tasks", tags=["tasks"])

class Task(BaseModel):
    id: int
    created_at: datetime
    label: str
    confidence: float
    image_name: Optional[str] = None
    status: str = "pending"

_TASKS: List[Task] = []
_COUNTER = 1

@router.get("", response_model=List[Task])
async def list_tasks() -> List[Task]:
    return _TASKS

class CreateTask(BaseModel):
    label: str
    confidence: float
    image_name: Optional[str] = None

@router.post("", response_model=Task)
async def create_task(body: CreateTask) -> Task:
    global _COUNTER
    task = Task(
        id=_COUNTER,
        created_at=datetime.utcnow(),
        label=body.label,
        confidence=body.confidence,
        image_name=body.image_name,
    )
    _COUNTER += 1
    _TASKS.append(task)
    return task
