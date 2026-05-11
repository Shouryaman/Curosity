# Runs the engineering_team crew using only this project's virtualenv (no global crewai on PATH).
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$crewai = Join-Path $PSScriptRoot '.venv\Scripts\crewai.exe'
if (-not (Test-Path $crewai)) {
    Write-Error "Missing .venv\Scripts\crewai.exe. Run 'uv sync' in this folder first."
}
& $crewai run @args
