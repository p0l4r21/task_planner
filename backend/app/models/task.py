from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    INCOMING = "incoming"
    THIS_WEEK = "this_week"
    TODAY = "today"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    COMPLETED = "completed"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TaskBucket(str, Enum):
    INCOMING = "incoming"
    THIS_WEEK = "this_week"
    TODAY = "today"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    BACKLOG = "backlog"
    COMPLETED = "completed"


class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    status: TaskStatus = TaskStatus.INCOMING
    priority: TaskPriority = TaskPriority.MEDIUM
    bucket: TaskBucket = TaskBucket.INCOMING
    due_date: Optional[str] = None
    scheduled_date: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None
    tags: str = ""
    project_id: Optional[str] = None
    project: str = ""
    parent_milestone_id: Optional[str] = None
    hierarchy_level: int = 0
    owner: str = "local_user"
    blocked_reason: str = ""
    notes: str = ""
    checklist_items: str = ""  # JSON string: [{"id":"...","text":"...","completed":false}]


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: Optional[str] = None
    scheduled_date: Optional[str] = None
    tags: str = ""
    project_id: Optional[str] = None
    project: str = ""
    parent_milestone_id: Optional[str] = None
    hierarchy_level: int = 0
    bucket: TaskBucket = TaskBucket.INCOMING
    blocked_reason: str = ""
    notes: str = ""
    checklist_items: str = ""


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    bucket: Optional[TaskBucket] = None
    due_date: Optional[str] = None
    scheduled_date: Optional[str] = None
    tags: Optional[str] = None
    project_id: Optional[str] = None
    project: Optional[str] = None
    parent_milestone_id: Optional[str] = None
    hierarchy_level: Optional[int] = None
    owner: Optional[str] = None
    blocked_reason: Optional[str] = None
    notes: Optional[str] = None
    checklist_items: Optional[str] = None


class TaskMove(BaseModel):
    bucket: TaskBucket


class DashboardSummary(BaseModel):
    active_count: int = 0
    today_count: int = 0
    in_progress_count: int = 0
    blocked_count: int = 0
    completed_this_week: int = 0
    incoming_count: int = 0
    this_week_count: int = 0
    backlog_count: int = 0
