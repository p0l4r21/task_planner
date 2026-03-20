from __future__ import annotations

import csv
import os
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from ..models.task import (
    DashboardSummary,
    Task,
    TaskBucket,
    TaskCreate,
    TaskMove,
    TaskStatus,
    TaskUpdate,
)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
ACTIVE_CSV = DATA_DIR / "tasks_active.csv"
COMPLETED_CSV = DATA_DIR / "tasks_completed.csv"

CSV_FIELDS = [
    "id", "title", "description", "status", "priority", "bucket",
    "due_date", "scheduled_date", "created_at", "updated_at",
    "completed_at", "tags", "project", "owner", "blocked_reason", "notes",
    "checklist_items",
]

_lock = threading.Lock()


def _ensure_csv(path: Path) -> None:
    """Create the CSV file with headers if it doesn't exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writeheader()


def _read_csv(path: Path) -> List[dict]:
    _ensure_csv(path)
    with open(path, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            # Normalise missing keys
            for field in CSV_FIELDS:
                if field not in row:
                    row[field] = ""
            rows.append(row)
        return rows


def _write_csv(path: Path, rows: List[dict]) -> None:
    _ensure_csv(path)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)


def _append_csv(path: Path, row: dict) -> None:
    _ensure_csv(path)
    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writerow(row)


def _row_to_task(row: dict) -> Task:
    return Task(**{k: (v if v != "" else None) if k in (
        "due_date", "scheduled_date", "completed_at"
    ) else v for k, v in row.items() if k in CSV_FIELDS})


def _task_to_row(task: Task) -> dict:
    d = task.model_dump()
    for k, v in d.items():
        if v is None:
            d[k] = ""
    return d


# ---------------------------------------------------------------------------
# Smart bucket assignment
# ---------------------------------------------------------------------------

def _smart_bucket(due_date: Optional[str], bucket: TaskBucket) -> TaskBucket:
    """Assign bucket based on due_date proximity if user left default."""
    if bucket != TaskBucket.INCOMING:
        return bucket  # user explicitly chose
    if not due_date:
        return TaskBucket.INCOMING
    try:
        due = datetime.fromisoformat(due_date[:10])
        diff = (due - datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)).days
        if diff <= 0:
            return TaskBucket.TODAY
        if diff <= 7:
            return TaskBucket.THIS_WEEK
        return TaskBucket.BACKLOG
    except (ValueError, TypeError):
        return TaskBucket.INCOMING


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_task(data: TaskCreate) -> Task:
    resolved_bucket = _smart_bucket(data.due_date, data.bucket)
    task = Task(
        title=data.title,
        description=data.description,
        priority=data.priority,
        bucket=resolved_bucket,
        status=TaskStatus(resolved_bucket.value) if resolved_bucket.value in [s.value for s in TaskStatus] else TaskStatus.INCOMING,
        due_date=data.due_date,
        scheduled_date=data.scheduled_date,
        tags=data.tags,
        project=data.project,
        checklist_items=data.checklist_items,
    )
    with _lock:
        _append_csv(ACTIVE_CSV, _task_to_row(task))
    return task


def list_active_tasks(
    bucket: Optional[str] = None,
    priority: Optional[str] = None,
    tag: Optional[str] = None,
    project: Optional[str] = None,
    due_date: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "asc",
) -> List[Task]:
    with _lock:
        rows = _read_csv(ACTIVE_CSV)
    tasks = [_row_to_task(r) for r in rows]

    if bucket:
        tasks = [t for t in tasks if t.bucket.value == bucket]
    if priority:
        tasks = [t for t in tasks if t.priority.value == priority]
    if tag:
        tasks = [t for t in tasks if tag.lower() in t.tags.lower()]
    if project:
        tasks = [t for t in tasks if project.lower() in t.project.lower()]
    if due_date:
        tasks = [t for t in tasks if t.due_date and t.due_date[:10] == due_date[:10]]
    if search:
        q = search.lower()
        tasks = [t for t in tasks if q in t.title.lower() or q in t.description.lower() or q in t.notes.lower()]

    if sort_by:
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        reverse = sort_dir == "desc"
        if sort_by == "priority":
            tasks.sort(key=lambda t: priority_order.get(t.priority.value, 9), reverse=reverse)
        elif sort_by == "due_date":
            tasks.sort(key=lambda t: t.due_date or "9999", reverse=reverse)
        elif sort_by == "scheduled_date":
            tasks.sort(key=lambda t: t.scheduled_date or "9999", reverse=reverse)
        elif sort_by == "created_at":
            tasks.sort(key=lambda t: t.created_at, reverse=reverse)

    return tasks


def get_task(task_id: str) -> Optional[Task]:
    with _lock:
        rows = _read_csv(ACTIVE_CSV)
    for r in rows:
        if r["id"] == task_id:
            return _row_to_task(r)
    return None


def list_calendar_tasks(start: str, end: str) -> List[Task]:
    """Return active tasks whose effective date (scheduled_date or due_date) falls in [start, end]."""
    with _lock:
        rows = _read_csv(ACTIVE_CSV)
    tasks = [_row_to_task(r) for r in rows]
    result = []
    for t in tasks:
        effective = (t.scheduled_date or t.due_date or "")[:10]
        if effective and start <= effective <= end:
            result.append(t)
    return result


def update_task(task_id: str, data: TaskUpdate) -> Optional[Task]:
    with _lock:
        rows = _read_csv(ACTIVE_CSV)
        updated = False
        for i, r in enumerate(rows):
            if r["id"] == task_id:
                task = _row_to_task(r)
                update_data = data.model_dump(exclude_unset=True)
                for k, v in update_data.items():
                    setattr(task, k, v)
                # Sync status ↔ bucket
                if "bucket" in update_data and "status" not in update_data:
                    bv = task.bucket.value
                    if bv in [s.value for s in TaskStatus]:
                        task.status = TaskStatus(bv)
                if "status" in update_data and "bucket" not in update_data:
                    sv = task.status.value
                    if sv in [b.value for b in TaskBucket]:
                        task.bucket = TaskBucket(sv)
                task.updated_at = datetime.now().isoformat()
                rows[i] = _task_to_row(task)
                updated = True
                break
        if not updated:
            return None
        _write_csv(ACTIVE_CSV, rows)
        return _row_to_task(rows[i])


def move_task(task_id: str, data: TaskMove) -> Optional[Task]:
    return update_task(task_id, TaskUpdate(bucket=data.bucket))


def complete_task(task_id: str) -> Optional[Task]:
    with _lock:
        rows = _read_csv(ACTIVE_CSV)
        target = None
        remaining = []
        for r in rows:
            if r["id"] == task_id:
                target = r
            else:
                remaining.append(r)
        if target is None:
            return None
        task = _row_to_task(target)
        task.status = TaskStatus.COMPLETED
        task.bucket = TaskBucket.COMPLETED
        task.completed_at = datetime.now().isoformat()
        task.updated_at = datetime.now().isoformat()
        _write_csv(ACTIVE_CSV, remaining)
        _append_csv(COMPLETED_CSV, _task_to_row(task))
    return task


def list_completed_tasks(
    search: Optional[str] = None,
    project: Optional[str] = None,
    priority: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "desc",
) -> List[Task]:
    with _lock:
        rows = _read_csv(COMPLETED_CSV)
    tasks = [_row_to_task(r) for r in rows]

    if search:
        q = search.lower()
        tasks = [t for t in tasks if q in t.title.lower() or q in t.description.lower()]
    if project:
        tasks = [t for t in tasks if project.lower() in t.project.lower()]
    if priority:
        tasks = [t for t in tasks if t.priority.value == priority]

    reverse = sort_dir == "desc"
    if sort_by == "completed_at":
        tasks.sort(key=lambda t: t.completed_at or "", reverse=reverse)
    elif sort_by == "priority":
        prio = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        tasks.sort(key=lambda t: prio.get(t.priority.value, 9), reverse=reverse)
    else:
        tasks.sort(key=lambda t: t.completed_at or "", reverse=True)

    return tasks


def restore_task(task_id: str) -> Optional[Task]:
    with _lock:
        rows = _read_csv(COMPLETED_CSV)
        target = None
        remaining = []
        for r in rows:
            if r["id"] == task_id:
                target = r
            else:
                remaining.append(r)
        if target is None:
            return None
        task = _row_to_task(target)
        task.status = TaskStatus.INCOMING
        task.bucket = TaskBucket.BACKLOG
        task.completed_at = None
        task.updated_at = datetime.now().isoformat()
        _write_csv(COMPLETED_CSV, remaining)
        _append_csv(ACTIVE_CSV, _task_to_row(task))
    return task


def delete_task(task_id: str) -> bool:
    with _lock:
        rows = _read_csv(ACTIVE_CSV)
        new_rows = [r for r in rows if r["id"] != task_id]
        if len(new_rows) == len(rows):
            return False
        _write_csv(ACTIVE_CSV, new_rows)
    return True


def get_dashboard_summary() -> DashboardSummary:
    with _lock:
        active_rows = _read_csv(ACTIVE_CSV)
        completed_rows = _read_csv(COMPLETED_CSV)

    active_tasks = [_row_to_task(r) for r in active_rows]
    completed_tasks = [_row_to_task(r) for r in completed_rows]

    week_ago = (datetime.now() - timedelta(days=7)).isoformat()
    completed_this_week = sum(
        1 for t in completed_tasks
        if t.completed_at and t.completed_at >= week_ago
    )

    return DashboardSummary(
        active_count=len(active_tasks),
        today_count=sum(1 for t in active_tasks if t.bucket == TaskBucket.TODAY),
        in_progress_count=sum(1 for t in active_tasks if t.bucket == TaskBucket.IN_PROGRESS),
        blocked_count=sum(1 for t in active_tasks if t.bucket == TaskBucket.BLOCKED),
        completed_this_week=completed_this_week,
        incoming_count=sum(1 for t in active_tasks if t.bucket == TaskBucket.INCOMING),
        this_week_count=sum(1 for t in active_tasks if t.bucket == TaskBucket.THIS_WEEK),
        backlog_count=sum(1 for t in active_tasks if t.bucket == TaskBucket.BACKLOG),
    )
