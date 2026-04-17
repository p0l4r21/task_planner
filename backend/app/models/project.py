from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ProjectStatus(str, Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"


class ProjectPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class MilestoneStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


# ---------------------------------------------------------------------------
# Project models
# ---------------------------------------------------------------------------

class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    status: ProjectStatus = ProjectStatus.PLANNING
    priority: ProjectPriority = ProjectPriority.MEDIUM
    start_date: Optional[str] = None
    target_end_date: Optional[str] = None
    owner: str = "local_user"
    tags: str = ""
    source_idea_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    status: ProjectStatus = ProjectStatus.PLANNING
    priority: ProjectPriority = ProjectPriority.MEDIUM
    start_date: Optional[str] = None
    target_end_date: Optional[str] = None
    owner: str = "local_user"
    tags: str = ""
    source_idea_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    start_date: Optional[str] = None
    target_end_date: Optional[str] = None
    owner: Optional[str] = None
    tags: Optional[str] = None
    source_idea_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Milestone models
# ---------------------------------------------------------------------------

class Milestone(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    title: str
    description: str = ""
    priority: str = "medium"
    due_date: Optional[str] = None
    status: MilestoneStatus = MilestoneStatus.PENDING
    is_major: bool = True
    parent_milestone_id: Optional[str] = None
    linked_milestone_ids: str = ""          # comma-separated UUIDs
    task_ids: str = ""                      # comma-separated UUIDs
    order_index: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None


class MilestoneCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    due_date: Optional[str] = None
    is_major: bool = True
    parent_milestone_id: Optional[str] = None
    linked_milestone_ids: str = ""
    task_ids: str = ""
    order_index: int = 0


class MilestoneUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[MilestoneStatus] = None
    is_major: Optional[bool] = None
    parent_milestone_id: Optional[str] = None
    linked_milestone_ids: Optional[str] = None
    task_ids: Optional[str] = None
    order_index: Optional[int] = None


# ---------------------------------------------------------------------------
# Inline / batch creation models
# ---------------------------------------------------------------------------

class InlineMilestoneCreate(BaseModel):
    title: str
    description: str = ""
    priority: str = "medium"
    due_date: Optional[str] = None
    children: List["InlineMilestoneCreate"] = []


class ProjectCreateWithMilestones(BaseModel):
    name: str
    description: str = ""
    status: ProjectStatus = ProjectStatus.PLANNING
    priority: ProjectPriority = ProjectPriority.MEDIUM
    start_date: Optional[str] = None
    target_end_date: Optional[str] = None
    owner: str = "local_user"
    tags: str = ""
    source_idea_id: Optional[str] = None
    milestones: List[InlineMilestoneCreate] = []


# ---------------------------------------------------------------------------
# Progress rollup response
# ---------------------------------------------------------------------------

class MilestoneProgress(BaseModel):
    milestone_id: str
    title: str
    is_major: bool
    status: MilestoneStatus
    total_tasks: int = 0
    completed_tasks: int = 0
    child_milestones: List[MilestoneProgress] = []


class ProjectProgress(BaseModel):
    project_id: str
    project_name: str
    total_major: int = 0
    completed_major: int = 0
    percent: float = 0.0
    milestones: List[MilestoneProgress] = []
