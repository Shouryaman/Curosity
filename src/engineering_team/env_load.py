"""Load repo-root `.env` so OPENAI_API_KEY and similar vars are available."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

_loaded = False


def get_repo_root() -> Path:
    """Project root (contains `frontend/dist`, `output/`, `pyproject.toml`).

    When the package is installed with ``pip install .`` (e.g. Docker), code lives under
    ``site-packages/`` and ``Path(__file__).parents[2]`` is not the deploy root. Set
    ``ENGINEERING_TEAM_REPO_ROOT`` (the Dockerfile sets it to ``/app``).
    """
    override = os.environ.get("ENGINEERING_TEAM_REPO_ROOT", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return Path(__file__).resolve().parents[2]


def load_project_env() -> None:
    """Idempotent: load ``<repo_root>/.env`` (see :func:`get_repo_root`)."""
    global _loaded
    if _loaded:
        return
    try:
        from dotenv import load_dotenv
    except ImportError:
        _loaded = True
        return
    repo_root = get_repo_root()
    load_dotenv(repo_root / ".env")
    _loaded = True


def ensure_output_on_pythonpath() -> Path:
    """Put `<repo>/output` on PYTHONPATH so `import <module_name>` works from repo root.

    CrewAI's Code Interpreter (Docker) mounts the process cwd as `/workspace`; generated
    modules live under `output/`, not the repo root, so imports fail without this.
    """
    out = get_repo_root() / "output"
    out.mkdir(parents=True, exist_ok=True)
    extra = str(out.resolve())
    cur = os.environ.get("PYTHONPATH", "").strip()
    if not cur:
        os.environ["PYTHONPATH"] = extra
        return out
    parts = [p for p in cur.split(os.pathsep) if p]
    if extra not in parts:
        os.environ["PYTHONPATH"] = os.pathsep.join([extra] + parts)
    return out


def should_clear_output_before_run() -> bool:
    """Default True: empty output/ before each crew kickoff so artifacts match only the current run."""
    v = os.environ.get("ENGINEERING_TEAM_CLEAR_OUTPUT_BEFORE_RUN", "1").strip().lower()
    return v not in ("0", "false", "no", "off")


def clear_run_output_dir() -> None:
    """Delete every file and subdirectory under <repo>/output/."""
    out = get_repo_root() / "output"
    out.mkdir(parents=True, exist_ok=True)
    for child in out.iterdir():
        try:
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
        except OSError:
            continue
