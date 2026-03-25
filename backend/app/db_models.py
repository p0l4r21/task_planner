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
    project = Column(String, default="")
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
