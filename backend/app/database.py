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
    alter_statements = []

    if "project_id" not in task_columns:
        alter_statements.append("ALTER TABLE tasks ADD COLUMN project_id VARCHAR")
    if "parent_milestone_id" not in task_columns:
        alter_statements.append("ALTER TABLE tasks ADD COLUMN parent_milestone_id VARCHAR")
    if "hierarchy_level" not in task_columns:
        alter_statements.append("ALTER TABLE tasks ADD COLUMN hierarchy_level INTEGER DEFAULT 0")

    if alter_statements:
        with engine.begin() as conn:
            for statement in alter_statements:
                conn.execute(text(statement))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_tasks_project_id ON tasks (project_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_tasks_parent_milestone_id ON tasks (parent_milestone_id)"))
