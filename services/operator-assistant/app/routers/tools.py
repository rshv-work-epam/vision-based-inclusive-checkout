from typing import Annotated, Any, Dict, List

from fastapi import APIRouter, Body
from pydantic import BaseModel

router = APIRouter(prefix="/tools", tags=["tools"])


class ToolCall(BaseModel):
    name: str
    args: Dict[str, Any] | None = None


class SummarizeRequest(BaseModel):
    text: str = ""


@router.get("")
async def list_tools() -> List[Dict[str, Any]]:
    return [
        {"name": "echo", "description": "Echo back provided payload"},
        {"name": "summarize", "description": "Return a short summary (stub)"},
    ]


@router.post("/echo")
async def tool_echo(
    payload: Annotated[Dict[str, Any], Body()],
) -> Dict[str, Any]:
    return {"ok": True, "payload": payload}


@router.post("/summarize")
async def tool_summarize(body: Annotated[SummarizeRequest, Body()]) -> Dict[str, Any]:
    text = body.text
    snippet = (text or "").strip().split()
    summary = " ".join(snippet[:20]) + ("…" if len(snippet) > 20 else "")
    return {"summary": summary, "length": len(text or "")}
