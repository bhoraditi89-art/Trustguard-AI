"""TrustGuard AI FastAPI service.

Run locally with:
    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

from typing import Annotated

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import Field
from pydantic.functional_validators import BeforeValidator

try:
    from .classifier import analyze_items
except ImportError:
    from classifier import analyze_items

app = FastAPI(
    title="TrustGuard AI",
    version="0.1.0",
    description="Explainable detection of deceptive web copy.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"chrome-extension://.*",
    allow_origins=["http://localhost:8501", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _strip_text(value: object) -> object:
    if isinstance(value, str):
        return value.strip()
    return value


TextItem = Annotated[str, BeforeValidator(_strip_text), Field(min_length=1, max_length=2000)]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze")
def analyze(items: list[TextItem]) -> list[dict[str, object]]:
    if not items:
        raise HTTPException(status_code=400, detail="items must contain at least one string")
    if len(items) > 500:
        raise HTTPException(status_code=400, detail="items cannot contain more than 500 strings")
    return analyze_items(items)