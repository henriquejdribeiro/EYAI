from __future__ import annotations

import os
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

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
    # `inline` lets the browser embed the PDF in an iframe; passing `filename=`
    # to FileResponse would default to `attachment` and force a download.
    # `no-cache` invalidates any stale earlier response that was served with
    # the wrong Content-Disposition (which would force a download instead).
    return FileResponse(
        path,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{path.name}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


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


# ---------------------------------------------------------------------------
# Team allocator — recommend the best team for one project (Modo 1) or
# distribute the full roster across multiple projects simultaneously (Modo 2).
# ---------------------------------------------------------------------------

# Stopwords drop generic words that would otherwise dominate keyword overlap.
_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "have", "has", "are",
    "was", "were", "will", "would", "should", "could", "must", "into", "their",
    "they", "them", "our", "out", "his", "her", "him", "she", "any", "all",
    "more", "than", "also", "such", "but", "not", "yet", "use", "uses", "using",
    "well", "make", "made", "across", "between", "ensuring", "ensure", "ensures",
    "able", "experience", "years", "year", "work", "works", "working", "team",
    "teams", "project", "projects", "system", "systems", "based", "strong",
    "high", "highly", "good", "great", "include", "includes", "including",
    "approach", "develop", "developing", "developed", "particularly", "very",
    "what", "who", "whom", "how", "why", "when", "where",
}


def _tokenize(text: str) -> set[str]:
    raw = re.findall(r"[a-zA-Z][a-zA-Z+\-./]{2,}", text.lower())
    # Strip trailing punctuation (so "gdpr." -> "gdpr", "backend." -> "backend").
    cleaned = (tok.rstrip(".-/") for tok in raw)
    return {tok for tok in cleaned if len(tok) >= 3 and tok not in _STOPWORDS}


def _member_tokens(member: TeamMember) -> set[str]:
    tokens: set[str] = set()
    tokens.update(_tokenize(member.role))
    if member.seniority:
        tokens.update(_tokenize(member.seniority))
    for skill in member.skills:
        tokens.update(_tokenize(skill))
    return tokens


def _score(member: TeamMember, project_tokens: set[str]) -> tuple[float, list[str]]:
    """Return (score, matched_terms). Skill matches weighted higher than role-only."""
    role_tokens = _tokenize(member.role) | _tokenize(member.seniority or "")
    skill_tokens: set[str] = set()
    for s in member.skills:
        skill_tokens.update(_tokenize(s))

    skill_hits = skill_tokens & project_tokens
    role_hits = (role_tokens & project_tokens) - skill_hits
    score = 2.0 * len(skill_hits) + 1.0 * len(role_hits)

    matched = sorted(skill_hits) + sorted(role_hits)
    return score, matched[:8]


def _resolve_team(provided: List[TeamMember]) -> List[TeamMember]:
    if provided:
        return provided
    if TEAM_FILE.exists():
        parsed = parse_team_members(TEAM_FILE.read_text(encoding="utf-8"))
        if parsed:
            return parsed
    return default_team()


class RecommendRequest(BaseModel):
    project_text: str
    project_name: str = ""
    team: List[TeamMember] = Field(default_factory=list)
    top_n: int = 6


class ProjectInput(BaseModel):
    key: str
    name: str = ""
    text: str


class AllocateRequest(BaseModel):
    projects: List[ProjectInput]
    team: List[TeamMember] = Field(default_factory=list)
    min_per_project: int = 3


@app.post("/api/team/recommend")
def recommend_team(req: RecommendRequest) -> dict:
    if not req.project_text or not req.project_text.strip():
        raise HTTPException(400, "project_text is required.")
    team = _resolve_team(req.team)
    project_tokens = _tokenize(req.project_text)
    ranked = []
    for m in team:
        score, matched = _score(m, project_tokens)
        ranked.append({
            "member": m.model_dump(mode="json"),
            "score": score,
            "matched_terms": matched,
        })
    ranked.sort(key=lambda r: r["score"], reverse=True)
    max_score = max((r["score"] for r in ranked), default=1.0) or 1.0
    for r in ranked:
        r["normalized"] = r["score"] / max_score

    recommended = ranked[: max(1, req.top_n)]
    total_capacity = sum(r["member"]["capacity_hours_per_sprint"] for r in recommended)
    return {
        "project_name": req.project_name,
        "ranked": ranked,
        "recommended": recommended,
        "recommended_team_capacity": total_capacity,
        "project_keywords": sorted(project_tokens)[:25],
    }


@app.post("/api/team/allocate")
def allocate_team(req: AllocateRequest) -> dict:
    if len(req.projects) < 2:
        raise HTTPException(400, "At least two projects are required to allocate.")
    team = _resolve_team(req.team)

    project_tokens = {p.key: _tokenize(p.text) for p in req.projects}
    score_matrix: Dict[str, Dict[str, float]] = {}
    matched_matrix: Dict[str, Dict[str, list[str]]] = {}
    for m in team:
        score_matrix[m.id] = {}
        matched_matrix[m.id] = {}
        for p in req.projects:
            score, matched = _score(m, project_tokens[p.key])
            score_matrix[m.id][p.key] = score
            matched_matrix[m.id][p.key] = matched

    # Step 1: greedy — assign each member to the project where they fit best.
    assignments: Dict[str, list] = defaultdict(list)
    member_assignment: Dict[str, str] = {}
    for m in team:
        scores = score_matrix[m.id]
        # Tie-breaker: project with fewer members so far gets priority.
        best_key = max(
            scores.keys(),
            key=lambda k: (scores[k], -len(assignments[k])),
        )
        assignments[best_key].append(m)
        member_assignment[m.id] = best_key

    # Step 2: rebalance — if any project is below min_per_project, pull from
    # surplus projects starting with the member whose score-loss is smallest.
    def project_size(k: str) -> int:
        return len(assignments[k])

    project_keys = [p.key for p in req.projects]
    changed = True
    while changed:
        changed = False
        understaffed = [k for k in project_keys if project_size(k) < req.min_per_project]
        if not understaffed:
            break
        for under_k in understaffed:
            # Find the surplus project with the best candidate to give away.
            best_swap: tuple[float, str, str] | None = None  # (loss, member_id, donor_key)
            for donor_k in project_keys:
                if donor_k == under_k or project_size(donor_k) <= req.min_per_project:
                    continue
                for m in assignments[donor_k]:
                    loss = score_matrix[m.id][donor_k] - score_matrix[m.id][under_k]
                    if best_swap is None or loss < best_swap[0]:
                        best_swap = (loss, m.id, donor_k)
            if best_swap is None:
                break  # can't satisfy this one without dropping another below min
            _loss, mid, donor_k = best_swap
            moved = next(x for x in assignments[donor_k] if x.id == mid)
            assignments[donor_k].remove(moved)
            assignments[under_k].append(moved)
            member_assignment[mid] = under_k
            changed = True

    out: Dict[str, dict] = {}
    for p in req.projects:
        members = assignments[p.key]
        rows = []
        for m in members:
            rows.append({
                "member": m.model_dump(mode="json"),
                "score": score_matrix[m.id][p.key],
                "matched_terms": matched_matrix[m.id][p.key],
                "alternates": {
                    k: score_matrix[m.id][k] for k in project_keys if k != p.key
                },
            })
        rows.sort(key=lambda r: r["score"], reverse=True)
        out[p.key] = {
            "name": p.name or p.key,
            "members": rows,
            "total_capacity_hours": sum(r["member"]["capacity_hours_per_sprint"] for r in rows),
            "avg_score": (sum(r["score"] for r in rows) / len(rows)) if rows else 0.0,
        }

    return {
        "assignments": out,
        "total_members": len(team),
        "min_per_project": req.min_per_project,
        "algorithm": "greedy best-fit, then rebalance to satisfy min-per-project by smallest score loss",
    }
