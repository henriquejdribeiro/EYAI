# Launches backend (FastAPI on :8001) and frontend (Vite on :5173) in parallel.
# Usage:  .\scripts\dev.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Starting Scrum Agent dev stack..." -ForegroundColor Yellow
Write-Host "  backend:  http://127.0.0.1:8001"
Write-Host "  frontend: http://127.0.0.1:5173"
Write-Host ""

# Backend
$backendCmd = "cd `"$root\backend`"; if (-not (Test-Path .venv)) { python -m venv .venv }; .\.venv\Scripts\Activate.ps1; pip install -q -r requirements.txt; uvicorn app.main:app --reload --host 127.0.0.1 --port 8001"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# Frontend
$frontendCmd = "cd `"$root\frontend`"; if (-not (Test-Path node_modules)) { npm install }; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host "Two PowerShell windows opened. Close them to stop the stack." -ForegroundColor Green
