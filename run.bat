@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\crewai.exe" (
    echo Missing .venv\Scripts\crewai.exe - run uv sync in this folder first.
    exit /b 1
)
".venv\Scripts\crewai.exe" run %*
