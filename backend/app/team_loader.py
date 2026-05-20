from __future__ import annotations

import re
from pathlib import Path
from typing import List

from .models import TeamMember


# Tech keywords scanned in free-form descriptions to surface skills.
# Order matters slightly: more specific terms appear before generic ones.
SKILL_KEYWORDS = [
    "Python", "Java", "Spring Boot", "React", "TypeScript", "Vue.js", "Vue",
    "Node.js", "FastAPI", "Django", "Flask",
    "AWS", "Azure", "GCP", "Kubernetes", "Docker", "CI/CD", "MLOps",
    "Spark", "SQL", "NoSQL", "PostgreSQL", "MongoDB",
    "scikit-learn", "PyTorch", "TensorFlow", "machine learning",
    "natural language processing", "NLP", "time series", "risk models",
    "credit scoring", "demand forecasting", "ETL pipelines",
    "OAuth2", "encryption", "vulnerability assessments", "GDPR",
    "Figma", "BPMN", "Scrum", "Agile",
    "RESTful APIs", "REST", "responsive design", "accessibility",
    "usability testing", "stakeholder management", "roadmaps",
    "interoperability", "clinical workflows", "patient triage",
    "data analysis", "predictive modeling",
]

# Role hints — we try to pull the leading noun phrase (up to "with") from the description.
ROLE_PATTERN = re.compile(
    r"^([A-Z][\w./-]*(?:\s+[A-Z][\w./-]*){0,4}(?:\s+(?:Engineer|Developer|Designer|Manager|Specialist|Analyst|Scientist|Architect|Lead|Owner|Master))?)",
    re.MULTILINE,
)


def _looks_like_name(line: str) -> bool:
    """A name line is 2-5 short words, mostly capitalized, no trailing period."""
    s = line.strip()
    if not s or len(s) > 80 or s.endswith("."):
        return False
    words = s.split()
    if not (1 < len(words) <= 5):
        return False
    # Allow titles like "Dr.", accents (Portuguese names).
    return all(w[0].isupper() or w.endswith(".") for w in words if w)


def _extract_role(description: str) -> str:
    """Pull the role from the start of a description like 'Senior Product Manager with 8 years...'."""
    # Cut at the first ' with ' or comma — that boundary separates role from biography.
    cut = re.split(r"\s+with\s+|,\s+", description.strip(), maxsplit=1)
    head = cut[0].strip()
    # Trim long heads to a reasonable role string.
    if len(head) > 80:
        head = head[:80].rsplit(" ", 1)[0]
    return head or "Team Member"


def _extract_skills(description: str) -> List[str]:
    found: List[str] = []
    seen = set()
    text = description.lower()
    for kw in SKILL_KEYWORDS:
        kw_l = kw.lower()
        if kw_l in seen:
            continue
        # Word-boundary search so "AWS" doesn't match "laws" and "vue" doesn't match "value".
        pattern = r"(?<![a-z0-9])" + re.escape(kw_l) + r"(?![a-z0-9])"
        if re.search(pattern, text):
            found.append(kw)
            seen.add(kw_l)
    return found[:8]


def _parse_labeled_block(block: str) -> TeamMember | None:
    """Parse a block written with explicit Name:/Role:/Skills: labels."""
    lines = [l.strip() for l in block.splitlines() if l.strip()]
    fields: dict = {"skills": [], "capacity": 60, "seniority": None}
    saw_label = False
    for line in lines:
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip().lower()
            val = val.strip()
            if key in ("name", "nome"):
                fields["name"] = val
                saw_label = True
            elif key in ("role", "função", "funcao", "cargo"):
                fields["role"] = val
                saw_label = True
            elif key in ("skills", "competências", "competencias"):
                fields["skills"] = [s.strip() for s in re.split(r"[,;]", val) if s.strip()]
                saw_label = True
            elif key in ("capacity", "capacidade"):
                m = re.search(r"\d+", val)
                if m:
                    fields["capacity"] = int(m.group())
                saw_label = True
            elif key in ("seniority", "senioridade", "level"):
                fields["seniority"] = val
                saw_label = True
    if saw_label and "name" in fields and "role" in fields:
        return TeamMember(
            name=fields["name"],
            role=fields["role"],
            skills=fields["skills"],
            capacity_hours_per_sprint=fields["capacity"],
            seniority=fields["seniority"],
        )
    return None


def _parse_paragraph_block(block: str) -> TeamMember | None:
    """Parse the EY 2-line format: name on line 1, description paragraph below."""
    lines = [l for l in block.splitlines() if l.strip()]
    if len(lines) < 2:
        return None
    name = lines[0].strip()
    if not _looks_like_name(name):
        return None
    description = " ".join(lines[1:]).strip()
    role = _extract_role(description)
    skills = _extract_skills(description)
    seniority = None
    m = re.search(r"(\d+)\s+years?", description)
    if m:
        years = int(m.group(1))
        if years >= 8:
            seniority = "Senior"
        elif years >= 4:
            seniority = "Mid"
        else:
            seniority = "Junior"
    return TeamMember(
        name=name,
        role=role,
        skills=skills,
        capacity_hours_per_sprint=60,
        seniority=seniority,
    )


def parse_team_members(text: str) -> List[TeamMember]:
    """Parse a team roster file. Supports:
      • Labeled blocks (Name:/Role:/Skills:/Capacity:/Seniority:)
      • EY paragraph format: name line, then a description paragraph
      • Simple 'Name - Role' lines (one per line)
    """
    members: List[TeamMember] = []
    blocks = re.split(r"\n\s*\n", text.strip())

    for block in blocks:
        member = _parse_labeled_block(block) or _parse_paragraph_block(block)
        if member:
            members.append(member)

    if not members:
        # Final fallback: each line is "Name - Role".
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "-" in line:
                name, _, role = line.partition("-")
                members.append(TeamMember(name=name.strip(), role=role.strip() or "Engineer"))

    return members


def load_team_from_file(path: Path) -> List[TeamMember]:
    return parse_team_members(path.read_text(encoding="utf-8"))


def default_team() -> List[TeamMember]:
    return [
        TeamMember(name="Ana Costa", role="Product Owner", skills=["product strategy", "stakeholder management"], capacity_hours_per_sprint=40, seniority="Senior"),
        TeamMember(name="Bruno Silva", role="Backend Engineer", skills=["Python", "FastAPI", "PostgreSQL"], capacity_hours_per_sprint=60, seniority="Senior"),
        TeamMember(name="Carla Mendes", role="Frontend Engineer", skills=["React", "TypeScript", "UX"], capacity_hours_per_sprint=60, seniority="Mid"),
        TeamMember(name="Diogo Pinto", role="ML Engineer", skills=["LLMs", "RAG", "Python"], capacity_hours_per_sprint=55, seniority="Senior"),
        TeamMember(name="Eva Ribeiro", role="QA Engineer", skills=["pytest", "Playwright", "test automation"], capacity_hours_per_sprint=50, seniority="Mid"),
        TeamMember(name="Filipe Sousa", role="DevOps Engineer", skills=["Docker", "CI/CD", "AWS"], capacity_hours_per_sprint=45, seniority="Mid"),
    ]
