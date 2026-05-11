"""Run EngineeringTeam in a background thread and publish execution events."""

from __future__ import annotations

import logging
import os
import threading
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List
from uuid import uuid4

from crewai.tasks.task_output import TaskOutput

from engineering_team.api.io_encoding import ensure_utf8_stdio
from engineering_team.crew import EngineeringTeam
from engineering_team.env_load import (
    clear_run_output_dir,
    ensure_output_on_pythonpath,
    get_repo_root,
    load_project_env,
    should_clear_output_before_run,
)


def _infer_phase(agent_role: str) -> Dict[str, Any] | None:
    """Map completed task agent role to UI phase indices (0..4)."""
    a = (agent_role or "").lower()
    if "engineering lead" in a or ("lead" in a and "directing" in a):
        return {
            "completed_up_to": 1,
            "current": 2,
            "operation": "Backend engineer implementing module...",
        }
    if "python engineer" in a or ("backend" in a and "engineer" in a):
        return {
            "completed_up_to": 2,
            "current": 3,
            "operation": "Frontend engineer building Gradio demo...",
        }
    if "gradio" in a or "frontend engineer" in a:
        return {
            "completed_up_to": 3,
            "current": 4,
            "operation": "Test engineer writing unit tests...",
        }
    if "test" in a:
        return {
            "completed_up_to": 4,
            "current": None,
            "operation": "Crew finished",
        }
    return None


def _truncate(text: str, max_len: int = 800) -> str:
    text = text.strip()
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."


@dataclass
class RunState:
    """Thread-safe event log for one crew run (SSE subscribers replay from here)."""

    events: Deque[Dict[str, Any]] = field(default_factory=lambda: deque(maxlen=4000))
    finished: bool = False
    error: str | None = None
    lock: threading.Lock = field(default_factory=threading.Lock)


_RUNS: Dict[str, RunState] = {}


def get_run(run_id: str) -> RunState | None:
    return _RUNS.get(run_id)


def _publish(run_id: str, event: Dict[str, Any]) -> None:
    state = _RUNS.get(run_id)
    if not state:
        return
    with state.lock:
        state.events.append(event)


def start_crew_run(inputs: Dict[str, Any]) -> str:
    """Spawn crew kickoff in a daemon thread; returns run_id."""
    run_id = str(uuid4())
    state = RunState()
    _RUNS[run_id] = state

    def worker() -> None:
        load_project_env()
        os.chdir(get_repo_root())
        ensure_output_on_pythonpath()
        if should_clear_output_before_run():
            clear_run_output_dir()
            mod = str(inputs.get("module_name", "")).strip()
            cls = str(inputs.get("class_name", "")).strip()
            _publish(
                run_id,
                {
                    "type": "log",
                    "text": f"Cleared output/ for this run only (module={mod!r}, class={cls!r}).",
                    "level": "INFO",
                },
            )
        ensure_utf8_stdio()
        log_handlers: List[logging.Handler] = []
        last_step_emit = 0.0

        class SSELoggingHandler(logging.Handler):
            def emit(self, record: logging.LogRecord) -> None:
                try:
                    msg = self.format(record)
                    if not msg.strip():
                        return
                    _publish(
                        run_id,
                        {
                            "type": "log",
                            "text": _truncate(msg, 1200),
                            "level": record.levelname,
                        },
                    )
                except Exception:
                    pass

        def attach_logging() -> None:
            fmt = logging.Formatter("%(name)s — %(message)s")
            h = SSELoggingHandler()
            h.setFormatter(fmt)
            h.setLevel(logging.INFO)
            log_handlers.append(h)
            logging.getLogger("crewai").addHandler(h)
            logging.getLogger("LiteLLM").addHandler(h)
            # By default API logs go to the browser via SSE only. Set
            # ENGINEERING_TEAM_CREW_LOG_TERMINAL=1 to also print crew/LiteLLM
            # lines to this terminal (useful when debugging next to uvicorn).
            flag = os.environ.get("ENGINEERING_TEAM_CREW_LOG_TERMINAL", "").strip().lower()
            if flag in ("1", "true", "yes", "on"):
                sh = logging.StreamHandler()
                sh.setFormatter(fmt)
                sh.setLevel(logging.INFO)
                log_handlers.append(sh)
                logging.getLogger("crewai").addHandler(sh)
                logging.getLogger("LiteLLM").addHandler(sh)

        def detach_logging() -> None:
            for h in log_handlers:
                logging.getLogger("crewai").removeHandler(h)
                logging.getLogger("LiteLLM").removeHandler(h)
            log_handlers.clear()

        try:
            pipeline_mode = os.environ.get("ENGINEERING_TEAM_PIPELINE", "artifacts").strip().lower()

            _publish(
                run_id,
                {
                    "type": "phase",
                    "completed_up_to": -1,
                    "current": 0,
                    "operation": "Requirement analysis & design (Engineering Lead)...",
                },
            )
            _publish(
                run_id,
                {"type": "log", "text": "Starting EngineeringTeam crew...", "level": "INFO"},
            )

            team = EngineeringTeam()
            crew = team.crew()

            def on_task(output: TaskOutput) -> None:
                agent = output.agent or ""
                task_name = getattr(output, "name", "") or ""
                phase = _infer_phase(agent)
                # Minimal pipeline ends after code_task; don't advertise later steps that won't run.
                if (
                    phase
                    and pipeline_mode in ("minimal", "fast", "core")
                    and task_name == "code_task"
                ):
                    phase = {
                        "completed_up_to": 4,
                        "current": None,
                        "operation": "Crew finished (minimal pipeline)",
                    }
                # Artifacts pipeline skips tests — mark all UI steps done after app.py is written.
                if (
                    phase
                    and pipeline_mode
                    in ("artifacts", "files", "codegen", "design_code_ui")
                    and task_name == "frontend_task"
                ):
                    phase = {
                        "completed_up_to": 4,
                        "current": None,
                        "operation": "Artifacts ready (design, module, app.py) — see output/",
                    }
                summary = _truncate(output.raw or "", 400)
                _publish(
                    run_id,
                    {
                        "type": "task",
                        "agent": agent,
                        "task_name": output.name,
                        "summary": summary,
                    },
                )
                if phase:
                    _publish(run_id, {"type": "phase", **phase})

            def on_step(step_result: Any) -> None:
                nonlocal last_step_emit
                now = time.monotonic()
                if now - last_step_emit < 0.12:
                    return
                last_step_emit = now
                text = str(step_result)
                if "AgentFinish object at" in text or text.startswith("<crewai."):
                    return
                if len(text) > 1200:
                    text = text[:1197] + "..."
                _publish(run_id, {"type": "step", "detail": text})

            crew.task_callback = on_task
            crew.step_callback = on_step

            attach_logging()

            if pipeline_mode in ("minimal", "fast", "core"):
                _publish(
                    run_id,
                    {
                        "type": "log",
                        "text": "Pipeline: minimal (design + backend module only). "
                        "Use ENGINEERING_TEAM_PIPELINE=artifacts for design+code+Gradio app.py, "
                        "or full for tests too.",
                        "level": "INFO",
                    },
                )
            elif pipeline_mode in ("artifacts", "files", "codegen", "design_code_ui"):
                _publish(
                    run_id,
                    {
                        "type": "log",
                        "text": "Pipeline: artifacts (markdown design + backend module + output/app.py). "
                        "No test/deploy step — files only. Set ENGINEERING_TEAM_PIPELINE=full to add tests.",
                        "level": "INFO",
                    },
                )

            max_sec = float(os.environ.get("ENGINEERING_TEAM_CREW_MAX_SEC", "180"))

            def run_kickoff():
                return crew.kickoff(inputs=inputs)

            _publish(
                run_id,
                {
                    "type": "log",
                    "text": f"Crew kickoff (wall-clock limit {max_sec:.0f}s)...",
                    "level": "INFO",
                },
            )

            with ThreadPoolExecutor(max_workers=1) as pool:
                fut = pool.submit(run_kickoff)
                try:
                    result = fut.result(timeout=max_sec)
                except FuturesTimeout:
                    raise TimeoutError(
                        f"Crew exceeded wall-clock limit ({max_sec:.0f}s). "
                        "Raise ENGINEERING_TEAM_CREW_MAX_SEC or set "
                        "ENGINEERING_TEAM_PIPELINE=minimal for a shorter pipeline."
                    ) from None

            _publish(
                run_id,
                {
                    "type": "log",
                    "text": _truncate(str(result), 2000),
                    "level": "INFO",
                },
            )
            _publish(
                run_id,
                {
                    "type": "done",
                    "result_preview": _truncate(str(result), 1500),
                },
            )
        except Exception as exc:  # noqa: BLE001 — surface errors to UI
            logging.getLogger("curosity.crew").exception("Crew run failed")
            _publish(run_id, {"type": "error", "message": str(exc)})
            with state.lock:
                state.error = str(exc)
        finally:
            detach_logging()
            with state.lock:
                state.finished = True
            _publish(run_id, {"type": "end"})

    thread = threading.Thread(target=worker, daemon=True, name=f"crew-{run_id[:8]}")
    thread.start()
    return run_id


def snapshot_events(run_id: str) -> List[Dict[str, Any]]:
    state = _RUNS.get(run_id)
    if not state:
        return []
    with state.lock:
        return list(state.events)
