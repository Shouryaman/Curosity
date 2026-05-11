"""List and download files under `<repo>/output/`."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response

from engineering_team.env_load import get_repo_root

router = APIRouter(prefix="/api/output", tags=["output"])


def _output_dir() -> Path:
    return get_repo_root() / "output"


def _safe_file(filename: str) -> Path:
    """Resolve a single basename under output/ (no path traversal)."""
    name = Path(filename).name
    if name != filename or not name or name in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = (_output_dir() / name).resolve()
    root = _output_dir().resolve()
    if not str(path).startswith(str(root)) or path.is_dir():
        raise HTTPException(status_code=404, detail="Not found")
    return path


@router.get("/list")
async def list_output_files() -> dict:
    root = _output_dir()
    if not root.is_dir():
        return {"files": []}
    files = []
    for p in sorted(root.iterdir()):
        if p.is_file():
            try:
                sz = p.stat().st_size
            except OSError:
                sz = 0
            files.append({"name": p.name, "size": sz})
    return {"files": files}


@router.get("/content/{filename}")
async def read_output_text(filename: str) -> dict:
    path = _safe_file(filename)
    text = path.read_text(encoding="utf-8", errors="replace")
    return {"name": path.name, "content": text}


@router.get("/file/{filename}")
async def download_file(filename: str) -> FileResponse:
    path = _safe_file(filename)
    return FileResponse(
        path,
        filename=path.name,
        media_type="application/octet-stream",
    )


@router.get("/download-all")
async def download_all_zip() -> StreamingResponse:
    root = _output_dir()
    if not root.is_dir():
        raise HTTPException(status_code=404, detail="No output folder yet")

    buf = io.BytesIO()
    files_added = 0
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(root.iterdir()):
            if p.is_file():
                zf.write(p, arcname=p.name)
                files_added += 1

    if files_added == 0:
        raise HTTPException(status_code=404, detail="No generated files yet")

    data = buf.getvalue()
    return Response(
        content=data,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="curosity-output.zip"',
        },
    )
