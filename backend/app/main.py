from __future__ import annotations

import os
import re
from pathlib import Path
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .agent import generate_plan
from .models import AnalyzeRequest, ProjectPlan, TeamMember
from .pdf_loader import extract_text_from_pdf_bytes, extract_text_from_pdf_path
from .team_loader import default_team, parse_team_members

load_dotenv()

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
PROJECTS_DIR = DATA_DIR / "projects"
TEAM_FILE = DATA_DIR / "team_members.txt"

app = FastAPI(
    title="Scrum Agent API",
    version="0.1.0",
    description="AI-powered Scrum Master that turns project briefs into sprint plans.",
)

origins = [o.strip() for o in os.environ.get(
    "SCRUM_AGENT_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "llm_mode": "claude" if os.environ.get("ANTHROPIC_API_KEY") else "mock",
        "model": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
    }


@app.get("/api/team", response_model=List[TeamMember])
def get_team() -> List[TeamMember]:
    if TEAM_FILE.exists():
        members = parse_team_members(TEAM_FILE.read_text(encoding="utf-8"))
        if members:
            return members
    return default_team()


@app.post("/api/team/parse", response_model=List[TeamMember])
async def parse_team_upload(file: UploadFile = File(...)) -> List[TeamMember]:
    text = (await file.read()).decode("utf-8", errors="ignore")
    members = parse_team_members(text)
    if not members:
        raise HTTPException(400, "Could not parse any team members from the file.")
    return members


@app.post("/api/projects/extract")
async def extract_project_pdf(file: UploadFile = File(...)) -> dict:
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported.")
    data = await file.read()
    try:
        text = extract_text_from_pdf_bytes(data)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(400, f"Failed to read PDF: {exc}") from exc
    return {"filename": file.filename, "text": text, "chars": len(text)}


@app.post("/api/plan", response_model=ProjectPlan)
def create_plan(req: AnalyzeRequest) -> ProjectPlan:
    if not req.project_text or not req.project_text.strip():
        raise HTTPException(400, "project_text is required.")
    if not req.team:
        req.team = default_team()
    return generate_plan(req)


# ---------------------------------------------------------------------------
# Sample data endpoints — expose the EY challenge artefacts shipped in data/
# ---------------------------------------------------------------------------

_SAFE_KEY = re.compile(r"^[A-Za-z0-9_-]+$")


def _sample_pdf_path(key: str) -> Path:
    if not _SAFE_KEY.match(key):
        raise HTTPException(400, "Invalid sample key.")
    path = PROJECTS_DIR / f"{key}.pdf"
    if not path.exists():
        raise HTTPException(404, f"Sample '{key}' not found.")
    # Defence in depth: ensure the resolved path stays inside PROJECTS_DIR.
    if PROJECTS_DIR.resolve() not in path.resolve().parents:
        raise HTTPException(400, "Invalid sample path.")
    return path


@app.get("/api/samples")
def list_samples() -> List[dict]:
    if not PROJECTS_DIR.exists():
        return []
    items = []
    for pdf in sorted(PROJECTS_DIR.glob("*.pdf")):
        items.append({
            "key": pdf.stem,
            "filename": pdf.name,
            "size_bytes": pdf.stat().st_size,
            "pdf_url": f"/api/samples/{pdf.stem}/pdf",
            "text_url": f"/api/samples/{pdf.stem}/text",
        })
    return items


@app.get("/api/samples/{key}/pdf")
def get_sample_pdf(key: str) -> FileResponse:
    path = _sample_pdf_path(key)
    return FileResponse(path, media_type="application/pdf", filename=path.name)


@app.get("/api/samples/{key}/text")
def get_sample_text(key: str) -> dict:
    path = _sample_pdf_path(key)
    text = extract_text_from_pdf_path(path)
    return {"key": key, "filename": path.name, "text": text, "chars": len(text)}


@app.get("/api/team/raw")
def get_team_raw() -> dict:
    if not TEAM_FILE.exists():
        return {"text": "", "exists": False, "filename": TEAM_FILE.name}
    return {
        "text": TEAM_FILE.read_text(encoding="utf-8"),
        "exists": True,
        "filename": TEAM_FILE.name,
    }
