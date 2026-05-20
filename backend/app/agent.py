from __future__ import annotations

import json
import os
import re
from datetime import date, timedelta
from typing import List, Optional

from .models import (
    AnalyzeRequest,
    Priority,
    ProjectPlan,
    Sprint,
    Task,
    TeamMember,
    UserStory,
)
from .prompts import STORY_GENERATION_PROMPT, SYSTEM_PROMPT


def _has_anthropic_key() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def _model_name() -> str:
    return os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _call_claude(prompt: str) -> str:
    from anthropic import Anthropic  # imported lazily so mock mode has no hard dep

    client = Anthropic()
    response = client.messages.create(
        model=_model_name(),
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    parts: List[str] = []
    for block in response.content:
        if getattr(block, "type", None) == "text":
            parts.append(block.text)
    return _strip_code_fences("".join(parts))


def _build_prompt(req: AnalyzeRequest) -> str:
    team_payload = [m.model_dump(mode="json") for m in req.team]
    total_capacity = sum(m.capacity_hours_per_sprint for m in req.team) or 60
    return STORY_GENERATION_PROMPT.format(
        project_text=req.project_text.strip(),
        team_json=json.dumps(team_payload, indent=2),
        sprint_count=req.sprint_count,
        sprint_length_days=req.sprint_length_days,
        total_capacity=total_capacity,
    )


def _resolve_assignee(name: Optional[str], team: List[TeamMember]) -> Optional[str]:
    if not name:
        return None
    name_lower = name.strip().lower()
    for m in team:
        if m.name.lower() == name_lower:
            return m.id
    # Loose match on first name.
    first = name_lower.split()[0] if name_lower else ""
    for m in team:
        if m.name.lower().startswith(first):
            return m.id
    return None


def _build_sprints(
    raw_sprints: list,
    stories: List[UserStory],
    sprint_length_days: int,
) -> List[Sprint]:
    title_to_id = {s.title.strip().lower(): s.id for s in stories}
    sprints: List[Sprint] = []
    today = date.today()
    for idx, raw in enumerate(raw_sprints):
        story_ids = []
        for title in raw.get("story_titles", []):
            sid = title_to_id.get(str(title).strip().lower())
            if sid:
                story_ids.append(sid)
        start = today + timedelta(days=idx * sprint_length_days)
        end = start + timedelta(days=sprint_length_days - 1)
        sprints.append(Sprint(
            name=raw.get("name") or f"Sprint {idx + 1}",
            goal=raw.get("goal", ""),
            start_date=start,
            end_date=end,
            story_ids=story_ids,
        ))
    return sprints


def _parse_llm_payload(payload: dict, team: List[TeamMember], sprint_length_days: int) -> tuple[list, list, str, str, list]:
    stories: List[UserStory] = []
    for raw in payload.get("user_stories", []):
        tasks: List[Task] = []
        for raw_t in raw.get("tasks", []):
            tasks.append(Task(
                title=raw_t.get("title", "Untitled task"),
                description=raw_t.get("description", ""),
                estimate_hours=float(raw_t.get("estimate_hours", 0) or 0),
                assignee_id=_resolve_assignee(raw_t.get("assignee_name"), team),
            ))
        priority_raw = str(raw.get("priority", "medium")).lower()
        priority = Priority(priority_raw) if priority_raw in Priority._value2member_map_ else Priority.MEDIUM
        sp = raw.get("story_points", 3)
        try:
            sp = int(sp)
        except (TypeError, ValueError):
            sp = 3
        stories.append(UserStory(
            title=raw.get("title", "Untitled story"),
            as_a=raw.get("as_a", "user"),
            i_want=raw.get("i_want", ""),
            so_that=raw.get("so_that", ""),
            acceptance_criteria=raw.get("acceptance_criteria", []) or [],
            story_points=sp,
            priority=priority,
            tasks=tasks,
        ))
    sprints = _build_sprints(payload.get("sprints", []), stories, sprint_length_days)
    return stories, sprints, payload.get("project_name", ""), payload.get("summary", ""), payload.get("risks", []) or []


def _mock_plan(req: AnalyzeRequest) -> ProjectPlan:
    """Deterministic offline plan so the demo always works without an API key."""
    text = req.project_text.strip() or "Unnamed project"
    project_name = req.project_name or (text.splitlines()[0][:60] if text else "Demo Project")
    snippet = " ".join(text.split()[:40])

    base_stories = [
        ("Set up project foundation",
         "developer", "scaffold the repository and CI",
         "the team can ship code with confidence",
         ["Given a clean checkout, When CI runs, Then linting and tests pass"],
         3, Priority.HIGH),
        ("Define core domain model",
         "product owner", "agree on the domain entities",
         "engineering and stakeholders share a vocabulary",
         ["Given the brief, When the model is reviewed, Then all entities map to stakeholder needs"],
         5, Priority.HIGH),
        ("Build minimal end-to-end happy path",
         "end user", "complete the primary workflow",
         "we can validate the product hypothesis early",
         ["Given a new user, When they perform the main action, Then they reach a successful outcome"],
         8, Priority.CRITICAL),
        ("Add observability and error reporting",
         "operator", "see logs and alerts for failures",
         "we can detect problems before users do",
         ["Given a runtime error, When it occurs, Then it is logged and surfaced in the dashboard"],
         3, Priority.MEDIUM),
        ("Implement role-based access control",
         "admin", "restrict sensitive operations by role",
         "we comply with security requirements",
         ["Given a non-admin user, When they call an admin endpoint, Then they get 403"],
         5, Priority.HIGH),
        ("Polish UI and accessibility pass",
         "user with assistive tech", "navigate the app via keyboard and screen reader",
         "the product is inclusive and meets WCAG AA",
         ["Given the main flow, When tested with axe-core, Then there are zero critical violations"],
         3, Priority.MEDIUM),
        ("Prepare production deployment runbook",
         "on-call engineer", "follow a documented runbook",
         "incident response is fast and predictable",
         ["Given an incident, When the runbook is followed, Then service is restored within SLA"],
         2, Priority.MEDIUM),
        ("Stakeholder demo and feedback loop",
         "product owner", "gather stakeholder feedback per sprint",
         "the product stays aligned with business value",
         ["Given a sprint end, When the demo runs, Then feedback is captured in the backlog"],
         2, Priority.LOW),
    ]

    stories: List[UserStory] = []
    for title, role, want, benefit, ac, pts, prio in base_stories:
        tasks = [
            Task(title=f"Design: {title}", description=f"Design approach for: {title}", estimate_hours=4.0,
                 assignee_id=req.team[0].id if req.team else None),
            Task(title=f"Implement: {title}", description=f"Build the feature: {title}. Context: {snippet}", estimate_hours=pts * 2.0,
                 assignee_id=req.team[1].id if len(req.team) > 1 else None),
            Task(title=f"Test: {title}", description=f"Write tests for: {title}", estimate_hours=pts * 1.0,
                 assignee_id=req.team[-1].id if req.team else None),
        ]
        stories.append(UserStory(
            title=title, as_a=role, i_want=want, so_that=benefit,
            acceptance_criteria=ac, story_points=pts, priority=prio, tasks=tasks,
        ))

    per_sprint = max(1, len(stories) // max(1, req.sprint_count))
    sprints: List[Sprint] = []
    today = date.today()
    for i in range(req.sprint_count):
        chunk = stories[i * per_sprint : (i + 1) * per_sprint] if i < req.sprint_count - 1 else stories[i * per_sprint :]
        sprints.append(Sprint(
            name=f"Sprint {i + 1}",
            goal=f"Deliver: " + "; ".join(s.title for s in chunk[:2]) if chunk else "Refinement sprint",
            start_date=today + timedelta(days=i * req.sprint_length_days),
            end_date=today + timedelta(days=(i + 1) * req.sprint_length_days - 1),
            story_ids=[s.id for s in chunk],
        ))

    return ProjectPlan(
        project_name=project_name,
        summary=f"Mock-mode plan generated from project brief ({len(text)} chars). Set ANTHROPIC_API_KEY to enable real LLM planning.",
        risks=[
            "Mock mode is active — stories are templated, not tailored.",
            "Team capacity vs scope not algorithmically validated in mock mode.",
            "No real risk analysis performed.",
        ],
        user_stories=stories,
        sprints=sprints,
        team=req.team,
        used_mock=True,
    )


def generate_plan(req: AnalyzeRequest) -> ProjectPlan:
    if not _has_anthropic_key():
        return _mock_plan(req)

    prompt = _build_prompt(req)
    try:
        raw = _call_claude(prompt)
        payload = json.loads(raw)
    except Exception as exc:  # noqa: BLE001 — falling back to mock keeps the demo alive
        plan = _mock_plan(req)
        plan.risks = [f"LLM call failed ({type(exc).__name__}: {exc}). Returned mock plan."] + plan.risks
        return plan

    stories, sprints, project_name, summary, risks = _parse_llm_payload(
        payload, req.team, req.sprint_length_days
    )
    return ProjectPlan(
        project_name=project_name or req.project_name or "Generated Plan",
        summary=summary,
        risks=risks,
        user_stories=stories,
        sprints=sprints,
        team=req.team,
        used_mock=False,
    )
