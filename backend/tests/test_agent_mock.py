import os

from app.agent import generate_plan
from app.models import AnalyzeRequest
from app.team_loader import default_team


def test_mock_plan_runs_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    req = AnalyzeRequest(
        project_text="Build a customer-facing portal that lets users self-serve account changes.",
        project_name="Customer Portal",
        sprint_count=3,
        sprint_length_days=14,
        team=default_team(),
    )
    plan = generate_plan(req)
    assert plan.used_mock is True
    assert plan.project_name == "Customer Portal"
    assert len(plan.user_stories) >= 6
    assert len(plan.sprints) == 3
    assert all(s.story_ids for s in plan.sprints[:-1])  # earlier sprints non-empty


def test_team_loader_default_team():
    team = default_team()
    assert len(team) == 6
    assert all(m.capacity_hours_per_sprint > 0 for m in team)
