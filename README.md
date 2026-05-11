# Curosity (Engineering Team)

Curosity is a local-first web app that runs a **CrewAI** “engineering team” pipeline: an engineering lead produces a design, a backend engineer writes a Python module, a frontend engineer drafts a **Gradio** `app.py`, and (optionally) a test engineer adds unit tests. A **FastAPI** backend exposes REST + **SSE** so the **React (Vite)** UI can stream live logs and phases.

**Repository:** [github.com/Shouryaman/Curosity](https://github.com/Shouryaman/Curosity)

---

## Features

- **Builders** — requirements, module filename, class name; run crew with live SSE logs.
- **Deployments** — browse `output/`, preview text files, download a zip of artifacts.
- **Configurable pipelines** — design-only speed runs, default “artifacts” (design + module + Gradio), or full runs with tests (`ENGINEERING_TEAM_PIPELINE`).
- **Safety** — `output/` is cleared before each API run by default; `.env` is gitignored so secrets are not pushed.

---

## Architecture

| Layer | Tech | Notes |
|--------|------|--------|
| Frontend | Vite 8, React 19, TypeScript, Tailwind v4 | Dev proxy: `/api` → FastAPI `:8000` |
| Backend | FastAPI, Uvicorn | Crew runs in a background thread; SSE for `/api/runs/{id}/stream` |
| Agents | CrewAI + LiteLLM | YAML agents/tasks under `src/engineering_team/config/` |
| Artifacts | `output/` at repo root | Written by CrewAI task `output_file` paths |

---

## Prerequisites

- **Python 3.10, 3.11, or 3.12** (project pins `<3.13` in `pyproject.toml`).
- **Node.js 20+** (for Vite and npm scripts).
- An **OpenAI API key** (or compatible LiteLLM provider) for the LLM.

---

## Quick start (development)

### 1. Clone and enter the repo

```bash
git clone https://github.com/Shouryaman/Curosity.git
cd Curosity
```

### 2. Python environment

```bash
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -e .
```

### 3. Frontend dependencies

```bash
cd frontend && npm install && cd ..
npm install
```

(`npm install` at the root installs `concurrently` for the combined dev script.)

### 4. Environment variables

Copy the example and add your key **only on your machine** (never commit `.env`):

```bash
cp .env.example .env
# Edit .env — set OPENAI_API_KEY at minimum.
```

See **`.env.example`** for optional tuning (pipeline mode, timeouts, `ENGINEERING_TEAM_CLEAR_OUTPUT_BEFORE_RUN`, etc.).

### 5. Run API + UI together (recommended)

From the repo root:

```bash
npm run stack
```

- **UI:** [http://localhost:5173](http://localhost:5173)  
- **API:** [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)  

Or use two terminals: `npm run api` and `npm run dev`.

---

## Useful npm scripts (root)

| Script | Purpose |
|--------|---------|
| `npm run stack` | Starts FastAPI + Vite together (`concurrently`) |
| `npm run api` | Uvicorn on port **8000** (reload watches `src/` only) |
| `npm run dev` | Vite dev server for `frontend/` |
| `npm run build` | Production build of the frontend into `frontend/dist` |
| `npm run lint` | ESLint on the frontend |

---

## CLI crew (optional)

Without the web UI you can still kick off the crew from Python:

```bash
set PYTHONPATH=src   # Windows; use export on Unix
python -m engineering_team.main
```

Adjust `requirements` / `module_name` / `class_name` in `src/engineering_team/main.py` as needed.

---

## Pipeline modes (`ENGINEERING_TEAM_PIPELINE`)

| Value | Tasks |
|--------|--------|
| `minimal` | Design + backend module only |
| `artifacts` (default) | Design + backend + `output/app.py` (Gradio), **no** test agent |
| `full` | All tasks including `test_{module}` |

Set in `.env` or the shell before `npm run api`.

---

## Production / deployment (overview)

1. **Backend** — Run Uvicorn (or gunicorn workers) with `engineering_team.api.main:app`, set env vars on the host (same keys as `.env.example`, **no** `.env` in the image if you use Docker secrets).
2. **Frontend** — `npm run build` in `frontend/`, serve `frontend/dist` as static files and set **`VITE_API_URL`** at build time to your public API origin, **or** serve `dist` behind the same host and reverse-proxy `/api` to the API.
3. **CORS** — Update `allow_origin_regex` in `src/engineering_team/api/main.py` for your real frontend origin(s).

---

## Security & privacy

- **`.env` is listed in `.gitignore`** — do not remove it. Never commit API keys, tokens, or provider secrets.
- If a secret was ever committed, **rotate the key** and purge it from Git history (`git filter-repo` / GitHub support) — ignoring the file later does not remove old commits.
- Review **`git status`** before every push; only `.env.example` should document variable *names*, not real values.

---

## Project layout (short)

```
├── frontend/           # React app (Vite)
├── src/engineering_team/
│   ├── api/            # FastAPI app, SSE runner, output routes
│   ├── config/         # agents.yaml, tasks.yaml
│   ├── crew.py         # CrewAI EngineeringTeam
│   └── ...
├── output/             # Generated files (gitignored except .gitkeep)
├── pyproject.toml
├── package.json        # Root scripts (api, stack, dev)
└── README.md
```

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| **HTTP 502** on `/api/...` in the browser | API not running — use `npm run stack` or `npm run api` |
| `ModuleNotFoundError: engineering_team` | Activate venv and/or `pip install -e .` and `PYTHONPATH=src` |
| Crew hangs / very long runs | Adjust `ENGINEERING_TEAM_CREW_MAX_SEC`, `ENGINEERING_TEAM_LLM_TIMEOUT_SEC`, or use `minimal` pipeline |
| Empty **Deployments** after a run | API must stay up while listing; refresh after run completes |

---

## License

Specify your license here (e.g. MIT) if you publish this repo publicly.

---

## Contributing

Issues and PRs welcome on [Shouryaman/Curosity](https://github.com/Shouryaman/Curosity).
