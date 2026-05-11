import ast
import os
import re
from typing import Any, List, Tuple

from crewai import Agent, Crew, LLM, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.tasks.task_output import TaskOutput


_META_PHRASE = re.compile(
    r"^\s*(i have|here is|the file|this module|this design|created a|provided a)",
    re.IGNORECASE,
)


def _raw_python_guardrail(output: TaskOutput) -> Tuple[bool, Any]:
    """Ensure task output is directly writable Python source."""
    raw = (output.raw or "").strip()
    if len(raw) < 40:
        return (False, "Output is too short. Return full Python source code only.")
    if "```" in raw:
        return (False, "Do not use markdown fences. Return raw Python code only.")
    if _META_PHRASE.match(raw):
        return (False, "Do not describe the file. Return only Python code.")
    try:
        ast.parse(raw)
    except SyntaxError as exc:
        return (False, f"Output is not valid Python code: {exc}")
    return (True, raw)


def _backend_module_guardrail(output: TaskOutput) -> Tuple[bool, Any]:
    """Like raw Python guardrail but reject UI/demo frameworks in the backend module."""
    ok, message = _raw_python_guardrail(output)
    if not ok:
        return (ok, message)
    raw = (output.raw or "").strip()
    lowered = raw.lower()
    if any(x in lowered for x in ("gradio", "streamlit", "nicegui")):
        return (
            False,
            "Output must be ONLY the backend Python module — no Gradio, Streamlit, or other UI code.",
        )
    return (True, raw)


def _design_markdown_guardrail(output: TaskOutput) -> Tuple[bool, Any]:
    """Ensure design output is markdown design, not implementation code."""
    raw = (output.raw or "").strip()
    lowered = raw.lower()
    if len(raw) < 120:
        return (False, "Design is too short. Provide a detailed markdown design.")
    if "```python" in lowered:
        return (
            False,
            "Design output must not include Python implementation blocks.",
        )
    if _META_PHRASE.match(raw):
        return (False, "Do not add preambles. Return markdown design directly.")
    if "#" not in raw and "##" not in raw and "- " not in raw:
        return (
            False,
            "Design must be markdown with headings/lists for classes and methods.",
        )
    impl_tokens = ("\nclass ", "\ndef ", "return ", "import ")
    # Require stronger evidence of pasted code (fewer false retries).
    if sum(token in raw for token in impl_tokens) >= 3:
        return (
            False,
            "Design looks like implementation code. Describe classes/methods in markdown.",
        )
    return (True, raw)


def _test_python_guardrail(output: TaskOutput) -> Tuple[bool, Any]:
    """Ensure test output is a real test module."""
    ok, message = _raw_python_guardrail(output)
    if not ok:
        return (ok, message)
    raw = (output.raw or "").strip()
    lowered = raw.lower()
    if "unittest" not in lowered and "pytest" not in lowered:
        return (
            False,
            "Test module must use unittest or pytest and include actual test cases.",
        )
    if "def test_" not in raw and "TestCase" not in raw:
        return (
            False,
            "Test module must include at least one test function/class.",
        )
    return (True, raw)


def _team_llm() -> LLM:
    """Shared LLM with per-call timeout so hung API requests fail fast."""
    model = os.environ.get("ENGINEERING_TEAM_MODEL", "openai/gpt-4o-mini").strip()
    timeout = float(os.environ.get("ENGINEERING_TEAM_LLM_TIMEOUT_SEC", "180"))
    max_tokens = int(os.environ.get("ENGINEERING_TEAM_LLM_MAX_TOKENS", "4096"))
    return LLM(model=model, timeout=timeout, max_tokens=max_tokens)


def _filter_tasks_for_pipeline(tasks: List[Task]) -> List[Task]:
    """Pipeline modes via ENGINEERING_TEAM_PIPELINE (default: artifacts).

    - minimal: design + backend module only
    - artifacts (default): design + backend + Gradio app.py (files only; no test agent)
    - full: all tasks including unit tests
    """
    mode = os.environ.get("ENGINEERING_TEAM_PIPELINE", "artifacts").strip().lower()
    if mode in ("minimal", "fast", "core"):
        keep = {"design_task", "code_task"}
        return [t for t in tasks if getattr(t, "name", "") in keep]
    if mode in ("artifacts", "files", "codegen", "design_code_ui"):
        keep = {"design_task", "code_task", "frontend_task"}
        return [t for t in tasks if getattr(t, "name", "") in keep]
    return list(tasks)


def _agents_for_tasks(tasks: List[Task]) -> List[Any]:
    seen: set[int] = set()
    out: List[Any] = []
    for t in tasks:
        a = getattr(t, "agent", None)
        if a is None:
            continue
        i = id(a)
        if i not in seen:
            seen.add(i)
            out.append(a)
    return out


_AGENT_ITER_CAP = int(os.environ.get("ENGINEERING_TEAM_AGENT_MAX_ITER", "10"))


@CrewBase
class EngineeringTeam():
    """EngineeringTeam crew"""

    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def engineering_lead(self) -> Agent:
        return Agent(
            config=self.agents_config['engineering_lead'],
            llm=_team_llm(),
            verbose=True,
            allow_code_execution=False,
            max_iter=_AGENT_ITER_CAP,
        )

    @agent
    def backend_engineer(self) -> Agent:
        # Code generation only — guardrails validate AST. Docker "safe" execution
        # often looks hung on Windows (slow/no Docker); disable for responsive runs.
        return Agent(
            config=self.agents_config['backend_engineer'],
            llm=_team_llm(),
            verbose=True,
            allow_code_execution=False,
            max_retry_limit=2,
            max_iter=_AGENT_ITER_CAP,
        )

    @agent
    def frontend_engineer(self) -> Agent:
        return Agent(
            config=self.agents_config['frontend_engineer'],
            llm=_team_llm(),
            verbose=True,
            allow_code_execution=False,
            max_retry_limit=2,
            max_iter=_AGENT_ITER_CAP,
        )

    @agent
    def test_engineer(self) -> Agent:
        return Agent(
            config=self.agents_config['test_engineer'],
            llm=_team_llm(),
            verbose=True,
            allow_code_execution=False,
            max_retry_limit=2,
            max_iter=_AGENT_ITER_CAP,
        )

    @task
    def design_task(self) -> Task:
        return Task(
            config=self.tasks_config['design_task'],
            guardrail=_design_markdown_guardrail,
            max_retries=2,
        )

    @task
    def code_task(self) -> Task:
        return Task(
            config=self.tasks_config['code_task'],
            guardrail=_backend_module_guardrail,
            max_retries=2,
        )

    @task
    def frontend_task(self) -> Task:
        return Task(
            config=self.tasks_config['frontend_task'],
            guardrail=_raw_python_guardrail,
            max_retries=2,
        )

    @task
    def test_task(self) -> Task:
        return Task(
            config=self.tasks_config['test_task'],
            guardrail=_test_python_guardrail,
            max_retries=2,
        )

    @crew
    def crew(self) -> Crew:
        """Creates the research crew"""
        tasks = _filter_tasks_for_pipeline(self.tasks)
        agents = _agents_for_tasks(tasks)
        return Crew(
            agents=agents,
            tasks=tasks,
            process=Process.sequential,
            verbose=True,
            memory=False,
        )