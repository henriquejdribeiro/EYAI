from __future__ import annotations

from datetime import date
from enum import Enum
from typing import List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


def _uid() -> str:
    return uuid4().hex[:8]


class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    DONE = "done"


class TeamMember(BaseModel):
    id: str = Field(default_factory=_uid)
    name: str
    role: str
    skills: List[str] = Field(default_factory=list)
    capacity_hours_per_sprint: int = 60
    seniority: Optional[str] = None


class Task(BaseModel):
    id: str = Field(default_factory=_uid)
    title: str
    description: str = ""
    estimate_hours: float = 0.0
    assignee_id: Optional[str] = None
    status: TaskStatus = TaskStatus.TODO


class UserStory(BaseModel):
    id: str = Field(default_factory=_uid)
    title: str
    as_a: str
    i_want: str
    so_that: str
    acceptance_criteria: List[str] = Field(default_factory=list)
    story_points: int = 3
    priority: Priority = Priority.MEDIUM
    tasks: List[Task] = Field(default_factory=list)


class Sprint(BaseModel):
    id: str = Field(default_factory=_uid)
    name: str
    goal: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    story_ids: List[str] = Field(default_factory=list)


class ProjectPlan(BaseModel):
    project_name: str
    summary: str
    risks: List[str] = Field(default_factory=list)
    user_stories: List[UserStory] = Field(default_factory=list)
    sprints: List[Sprint] = Field(default_factory=list)
    team: List[TeamMember] = Field(default_factory=list)
    used_mock: bool = False


class AnalyzeRequest(BaseModel):
    project_text: str
    project_name: Optional[str] = None
    sprint_count: int = 3
    sprint_length_days: int = 14
    team: List[TeamMember] = Field(default_factory=list)


class PlanRequest(BaseModel):
    user_stories: List[UserStory]
    team: List[TeamMember]
    sprint_count: int = 3
    sprint_length_days: int = 14
    project_name: str = "Sprint Plan"
