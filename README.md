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

## Production / deployment

### Option A — same URL for UI + API (recommended)

The repo includes a **multi-stage `Dockerfile`**: it builds `frontend/` with `VITE_API_URL` empty (browser calls `/api` on the same host), installs the Python package, copies `frontend/dist` under the deploy root, and starts Uvicorn. FastAPI mounts the SPA at `/` when `frontend/dist/index.html` exists, so **one public link** serves the React app and the API.

The image sets **`ENGINEERING_TEAM_REPO_ROOT=/app`** so `output/`, static `dist/`, and `.env` (if you mount one) resolve correctly after `pip install .` (installed code no longer lives next to `pyproject.toml`).

```bash
docker build -t curosity .
docker run --rm -p 8000:8000 -e OPENAI_API_KEY=sk-... curosity
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) and check [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health). Platforms that set `PORT` (e.g. Render, Railway) are supported by the image `CMD`.

### Deploy on Render (step by step)

1. **Push this repo** to GitHub (or GitLab / Bitbucket) if it is not already there.
2. In [Render](https://dashboard.render.com), click **New +** → **Blueprint**.
3. Connect the repository that contains this `render.yaml`, then **Apply** the blueprint.
4. When Render asks for a secret value, set **`OPENAI_API_KEY`** to your OpenAI (or compatible) API key.
5. Wait for the **first build** (Docker multi-stage: frontend build + Python install can take several minutes).
6. Open the service URL Render shows (e.g. `https://curosity.onrender.com`). That single link loads the UI; the API is at `/api/...` on the same host.

**Without a blueprint:** **New +** → **Web Service** → select the repo → **Runtime: Docker** → root directory `.` → Dockerfile path `Dockerfile` → add environment variable **`OPENAI_API_KEY`** (secret) → **Create Web Service**.

**Notes**

- Pick an instance type with **enough RAM** for the Docker build and runtime (`pip install` of CrewAI-related deps is heavy). If the build fails with “out of memory,” upgrade the plan or add `plan: standard` (or higher) under the web service in `render.yaml`.
- Free/starter instances may **spin down** when idle; the first request after sleep can take ~30–60s.
- Optional env vars from `.env.example` (pipeline, timeouts, model) can be added in the service **Environment** tab.

### Platform blueprints (optional)

- **`render.yaml`** — Web service from this Dockerfile; `OPENAI_API_KEY` is prompted at blueprint apply (`sync: false`).
- **`fly.toml`** — Example Fly.io app name and region; run `fly launch` / `fly secrets set OPENAI_API_KEY=...` as needed.

### Split hosting (UI and API on different origins)

1. Build the frontend with **`VITE_API_URL`** set to your public API base URL (e.g. `https://api.example.com`).
2. On the API host, set **`CORS_ALLOW_ORIGINS`** to a comma-separated list of allowed web origins, or `*` for public APIs that do not need cookies (credentials are off when using `*`).

If `CORS_ALLOW_ORIGINS` is unset, the API keeps the localhost Vite dev regex only.

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
├── Dockerfile          # Production image (Vite build + FastAPI)
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
