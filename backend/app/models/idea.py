from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class IdeaStatus(str, Enum):
    CAPTURED = "captured"
    EXPLORING = "exploring"
    VALIDATED = "validated"
    CONVERTED = "converted"
    ARCHIVED = "archived"


class IdeaLinkType(str, Enum):
    INSPIRED_BY = "inspired_by"
    SIMILAR_TO = "similar_to"
    DEPENDS_ON = "depends_on"
    EXPANDS = "expands"
    REUSES = "reuses"
    LEARNED_FROM = "learned_from"


class IdeaLink(BaseModel):
    target_type: str  # "project" | "task" | "milestone" | "idea"
    target_id: str
    link_type: IdeaLinkType = IdeaLinkType.SIMILAR_TO


class Idea(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    summary: str = ""
    current_state: str = ""
    proposed_change: str = ""
    why_it_matters: str = ""
    body: str = ""
    status: IdeaStatus = IdeaStatus.CAPTURED
    tags: str = ""  # comma-separated
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    linked_project_ids: str = ""  # comma-separated
    linked_task_ids: str = ""  # comma-separated
    linked_milestone_ids: str = ""  # comma-separated
    linked_idea_ids: str = ""  # comma-separated
    parent_idea_id: Optional[str] = None
    links_json: str = ""  # JSON array of IdeaLink for typed links
    converted_project_id: Optional[str] = None
    description: str = ""  # Legacy compatibility source for summary.


class IdeaCreate(BaseModel):
    title: str
    summary: str = ""
    current_state: str = ""
    proposed_change: str = ""
    why_it_matters: str = ""
    body: str = ""
    status: IdeaStatus = IdeaStatus.CAPTURED
    tags: str = ""
    notes: str = ""
    linked_project_ids: str = ""
    linked_task_ids: str = ""
    linked_milestone_ids: str = ""
    linked_idea_ids: str = ""
    parent_idea_id: Optional[str] = None
    links_json: str = ""
    description: str = ""  # Legacy compatibility source for summary.


class IdeaUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    current_state: Optional[str] = None
    proposed_change: Optional[str] = None
    why_it_matters: Optional[str] = None
    body: Optional[str] = None
    status: Optional[IdeaStatus] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    linked_project_ids: Optional[str] = None
    linked_task_ids: Optional[str] = None
    linked_milestone_ids: Optional[str] = None
    linked_idea_ids: Optional[str] = None
    parent_idea_id: Optional[str] = None
    links_json: Optional[str] = None
    converted_project_id: Optional[str] = None
    description: Optional[str] = None  # Legacy compatibility source for summary.


class IdeaEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    idea_id: str
    title: str = ""
    content: str
    type: str = "note"
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class IdeaEntryCreate(BaseModel):
    title: str = ""
    content: str
    type: str = "note"


class IdeaEntryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    type: Optional[str] = None
