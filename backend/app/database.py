"""SQLAlchemy engine and session factory for PostgreSQL."""

import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://taskplanner:taskplanner@localhost:5432/taskplanner",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist."""
    from . import db_models  # noqa: F401 — ensure models are registered
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    task_columns = {column["name"] for column in inspector.get_columns("tasks")}
    project_columns = {column["name"] for column in inspector.get_columns("projects")}
    idea_columns = {column["name"] for column in inspector.get_columns("ideas")}
    idea_entry_columns = {column["name"] for column in inspector.get_columns("idea_entries")}
    alter_statements = []
    post_alter_statements = []

    if "project_id" not in task_columns:
        alter_statements.append("ALTER TABLE tasks ADD COLUMN project_id VARCHAR")
    if "parent_milestone_id" not in task_columns:
        alter_statements.append("ALTER TABLE tasks ADD COLUMN parent_milestone_id VARCHAR")
    if "hierarchy_level" not in task_columns:
        alter_statements.append("ALTER TABLE tasks ADD COLUMN hierarchy_level INTEGER DEFAULT 0")
    if "source_idea_id" not in project_columns:
        alter_statements.append("ALTER TABLE projects ADD COLUMN source_idea_id VARCHAR")
    if "summary" not in idea_columns:
        alter_statements.append("ALTER TABLE ideas ADD COLUMN summary TEXT DEFAULT ''")
        post_alter_statements.append("UPDATE ideas SET summary = COALESCE(NULLIF(description, ''), '') WHERE summary IS NULL OR summary = ''")
    if "current_state" not in idea_columns:
        alter_statements.append("ALTER TABLE ideas ADD COLUMN current_state TEXT DEFAULT ''")
    if "proposed_change" not in idea_columns:
        alter_statements.append("ALTER TABLE ideas ADD COLUMN proposed_change TEXT DEFAULT ''")
    if "why_it_matters" not in idea_columns:
        alter_statements.append("ALTER TABLE ideas ADD COLUMN why_it_matters TEXT DEFAULT ''")
    if "body" not in idea_columns:
        alter_statements.append("ALTER TABLE ideas ADD COLUMN body TEXT DEFAULT ''")
    if "notes" not in idea_columns:
        alter_statements.append("ALTER TABLE ideas ADD COLUMN notes TEXT DEFAULT ''")
    if "parent_idea_id" not in idea_columns:
        alter_statements.append("ALTER TABLE ideas ADD COLUMN parent_idea_id VARCHAR")
    if "type" not in idea_entry_columns:
        alter_statements.append("ALTER TABLE idea_entries ADD COLUMN type VARCHAR DEFAULT 'note'")

    if alter_statements:
        with engine.begin() as conn:
            for statement in alter_statements:
                conn.execute(text(statement))
            for statement in post_alter_statements:
                conn.execute(text(statement))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_tasks_project_id ON tasks (project_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_tasks_parent_milestone_id ON tasks (parent_milestone_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_projects_source_idea_id ON projects (source_idea_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_idea_entries_idea_id ON idea_entries (idea_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_ideas_parent_idea_id ON ideas (parent_idea_id)"))
