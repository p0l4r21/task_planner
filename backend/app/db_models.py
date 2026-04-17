"""SQLAlchemy ORM models for PostgreSQL storage."""

from sqlalchemy import Boolean, Column, Integer, String, Text

from .database import Base


class TaskRow(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    status = Column(String, default="incoming")
    priority = Column(String, default="medium")
    bucket = Column(String, default="incoming")
    due_date = Column(String, nullable=True)
    scheduled_date = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    completed_at = Column(String, nullable=True)
    tags = Column(String, default="")
    project_id = Column(String, nullable=True, index=True)
    project = Column(String, default="")
    parent_milestone_id = Column(String, nullable=True, index=True)
    hierarchy_level = Column(Integer, default=0)
    owner = Column(String, default="local_user")
    blocked_reason = Column(String, default="")
    notes = Column(Text, default="")
    checklist_items = Column(Text, default="")
    is_completed = Column(Boolean, default=False, index=True)


class ProjectRow(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    status = Column(String, default="planning")
    priority = Column(String, default="medium")
    start_date = Column(String, nullable=True)
    target_end_date = Column(String, nullable=True)
    owner = Column(String, default="local_user")
    tags = Column(String, default="")
    source_idea_id = Column(String, nullable=True, index=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class IdeaRow(Base):
    __tablename__ = "ideas"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    summary = Column(Text, default="")
    current_state = Column(Text, default="")
    proposed_change = Column(Text, default="")
    why_it_matters = Column(Text, default="")
    body = Column(Text, default="")
    status = Column(String, default="captured", index=True)
    tags = Column(String, default="")
    notes = Column(Text, default="")
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    linked_project_ids = Column(String, default="")
    linked_task_ids = Column(String, default="")
    linked_milestone_ids = Column(String, default="")
    linked_idea_ids = Column(String, default="")
    parent_idea_id = Column(String, nullable=True, index=True)
    links_json = Column(Text, default="")
    converted_project_id = Column(String, nullable=True)


class IdeaEntryRow(Base):
    __tablename__ = "idea_entries"

    id = Column(String, primary_key=True)
    idea_id = Column(String, nullable=False, index=True)
    title = Column(String, default="")
    content = Column(Text, default="")
    type = Column(String, default="note")
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


class MilestoneRow(Base):
    __tablename__ = "milestones"

    id = Column(String, primary_key=True)
    project_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, default="")
    priority = Column(String, default="medium")
    due_date = Column(String, nullable=True)
    status = Column(String, default="pending")
    is_major = Column(Boolean, default=True)
    parent_milestone_id = Column(String, nullable=True)
    linked_milestone_ids = Column(String, default="")
    task_ids = Column(String, default="")
    order_index = Column(Integer, default=0)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    completed_at = Column(String, nullable=True)
