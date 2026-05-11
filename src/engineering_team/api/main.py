"""FastAPI application: REST + SSE for live CrewAI execution."""

from __future__ import annotations

import asyncio
import os
import json
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from engineering_team.api.io_encoding import ensure_utf8_stdio
from engineering_team.api.output_routes import router as output_router
from engineering_team.api.runner import get_run, snapshot_events, start_crew_run
from engineering_team.api.schemas import HealthResponse, RunCreate, RunCreated
from engineering_team.env_load import load_project_env

load_project_env()


@asynccontextmanager
async def _lifespan(app: FastAPI):
    ensure_utf8_stdio()
    yield


app = FastAPI(
    title="Curosity Engineering API",
    version="0.2.0",
    description="SSE stream for live EngineeringTeam (CrewAI) execution.",
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # Vite tries 5173, 5174, 5175… if ports are busy — match localhost dev range.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):(517[3-9]|4173)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(output_router)


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    key = os.getenv("OPENAI_API_KEY", "").strip()
    return HealthResponse(
        status="ok",
        openai_configured=bool(key),
    )


@app.post("/api/runs", response_model=RunCreated)
async def create_run(body: RunCreate) -> RunCreated:
    inputs = {
        "requirements": body.requirements,
        "module_name": body.module_name,
        "class_name": body.class_name,
    }
    run_id = start_crew_run(inputs)
    return RunCreated(run_id=run_id)


def _format_sse(event: dict) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@app.get("/api/runs/{run_id}/stream")
async def stream_run(run_id: str) -> StreamingResponse:
    if get_run(run_id) is None:
        raise HTTPException(status_code=404, detail="Unknown run_id")

    async def event_generator() -> AsyncIterator[str]:
        idx = 0
        while True:
            state = get_run(run_id)
            if state is None:
                break
            with state.lock:
                events = list(state.events)
                finished = state.finished
            while idx < len(events):
                yield _format_sse(events[idx])
                idx += 1
            if finished and idx >= len(events):
                break
            await asyncio.sleep(0.12)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/runs/{run_id}/events")
async def list_events(run_id: str) -> dict:
    """Debug: full event log snapshot."""
    if get_run(run_id) is None:
        raise HTTPException(status_code=404, detail="Unknown run_id")
    return {"events": snapshot_events(run_id)}


def main() -> None:
    import uvicorn

    uvicorn.run(
        "engineering_team.api.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )


if __name__ == "__main__":
    main()
