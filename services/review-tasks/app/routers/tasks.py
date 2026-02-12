from datetime import datetime
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, select

from ..core.db import get_session

router = APIRouter(prefix="/tasks", tags=["tasks"])


class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    label: str
    confidence: float
    image_name: Optional[str] = None
    status: str = Field(default="pending")


class TaskRead(SQLModel):
    id: int
    created_at: datetime
    label: str
    confidence: float
    image_name: Optional[str] = None
    status: str


class TaskCreate(BaseModel):
    label: str
    confidence: float
    image_name: Optional[str] = None


@router.get("", response_model=List[TaskRead])
async def list_tasks(
    session: Annotated[Session, Depends(get_session)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> List[TaskRead]:
    stmt = select(Task).offset(offset).limit(limit).order_by(Task.created_at.desc())
    return session.exec(stmt).all()


@router.post("", response_model=TaskRead)
async def create_task(
    body: TaskCreate,
    session: Annotated[Session, Depends(get_session)],
) -> TaskRead:
    task = Task(
        label=body.label,
        confidence=body.confidence,
        image_name=body.image_name,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task
