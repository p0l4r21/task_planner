from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

from ..database import SessionLocal
from ..db_models import TaskRow
from ..models.task import (
    DashboardSummary,
    Task,
    TaskBucket,
    TaskCreate,
    TaskMove,
    TaskStatus,
    TaskUpdate,
)


# ---------------------------------------------------------------------------
# Row <-> Pydantic conversions
# ---------------------------------------------------------------------------

def _row_to_task(row: TaskRow) -> Task:
    return Task(
        id=row.id,
        title=row.title,
        description=row.description or "",
        status=row.status,
        priority=row.priority,
        bucket=row.bucket,
        due_date=row.due_date,
        scheduled_date=row.scheduled_date,
        created_at=row.created_at,
        updated_at=row.updated_at,
        completed_at=row.completed_at,
        tags=row.tags or "",
        project=row.project or "",
        owner=row.owner or "local_user",
        blocked_reason=row.blocked_reason or "",
        notes=row.notes or "",
        checklist_items=row.checklist_items or "",
    )


def _apply_task_to_row(row: TaskRow, task: Task) -> None:
    row.title = task.title
    row.description = task.description
    row.status = task.status.value
    row.priority = task.priority.value
    row.bucket = task.bucket.value
    row.due_date = task.due_date
    row.scheduled_date = task.scheduled_date
    row.created_at = task.created_at
    row.updated_at = task.updated_at
    row.completed_at = task.completed_at
    row.tags = task.tags
    row.project = task.project
    row.owner = task.owner
    row.blocked_reason = task.blocked_reason
    row.notes = task.notes
    row.checklist_items = task.checklist_items


# ---------------------------------------------------------------------------
# Smart bucket assignment
# ---------------------------------------------------------------------------

def _smart_bucket(due_date: Optional[str], bucket: TaskBucket) -> TaskBucket:
    if bucket != TaskBucket.INCOMING:
        return bucket
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
    with SessionLocal() as db:
        row = TaskRow(is_completed=False)
        _apply_task_to_row(row, task)
        row.id = task.id
        db.add(row)
        db.commit()
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
    with SessionLocal() as db:
        q = db.query(TaskRow).filter(TaskRow.is_completed == False)
        if bucket:
            q = q.filter(TaskRow.bucket == bucket)
        if priority:
            q = q.filter(TaskRow.priority == priority)
        if due_date:
            q = q.filter(TaskRow.due_date.ilike(f"{due_date[:10]}%"))
        rows = q.all()

    tasks = [_row_to_task(r) for r in rows]

    if tag:
        tasks = [t for t in tasks if tag.lower() in t.tags.lower()]
    if project:
        tasks = [t for t in tasks if project.lower() in t.project.lower()]
    if search:
        sq = search.lower()
        tasks = [t for t in tasks if sq in t.title.lower() or sq in t.description.lower() or sq in t.notes.lower()]

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
    with SessionLocal() as db:
        row = db.query(TaskRow).filter(
            TaskRow.id == task_id,
            TaskRow.is_completed == False,
        ).first()
    if row is None:
        return None
    return _row_to_task(row)


def list_calendar_tasks(start: str, end: str) -> List[Task]:
    with SessionLocal() as db:
        rows = db.query(TaskRow).filter(TaskRow.is_completed == False).all()
    tasks = [_row_to_task(r) for r in rows]
    result = []
    for t in tasks:
        effective = (t.scheduled_date or t.due_date or "")[:10]
        if effective and start <= effective <= end:
            result.append(t)
    return result


def update_task(task_id: str, data: TaskUpdate) -> Optional[Task]:
    with SessionLocal() as db:
        row = db.query(TaskRow).filter(
            TaskRow.id == task_id,
            TaskRow.is_completed == False,
        ).first()
        if row is None:
            return None
        task = _row_to_task(row)
        update_data = data.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(task, k, v)
        if "bucket" in update_data and "status" not in update_data:
            bv = task.bucket.value
            if bv in [s.value for s in TaskStatus]:
                task.status = TaskStatus(bv)
        if "status" in update_data and "bucket" not in update_data:
            sv = task.status.value
            if sv in [b.value for b in TaskBucket]:
                task.bucket = TaskBucket(sv)
        task.updated_at = datetime.now().isoformat()
        _apply_task_to_row(row, task)
        db.commit()
        return task


def move_task(task_id: str, data: TaskMove) -> Optional[Task]:
    return update_task(task_id, TaskUpdate(bucket=data.bucket))


def complete_task(task_id: str) -> Optional[Task]:
    with SessionLocal() as db:
        row = db.query(TaskRow).filter(
            TaskRow.id == task_id,
            TaskRow.is_completed == False,
        ).first()
        if row is None:
            return None
        task = _row_to_task(row)
        task.status = TaskStatus.COMPLETED
        task.bucket = TaskBucket.COMPLETED
        task.completed_at = datetime.now().isoformat()
        task.updated_at = datetime.now().isoformat()
        _apply_task_to_row(row, task)
        row.is_completed = True
        db.commit()
        return task


def list_completed_tasks(
    search: Optional[str] = None,
    project: Optional[str] = None,
    priority: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "desc",
) -> List[Task]:
    with SessionLocal() as db:
        q = db.query(TaskRow).filter(TaskRow.is_completed == True)
        if priority:
            q = q.filter(TaskRow.priority == priority)
        rows = q.all()

    tasks = [_row_to_task(r) for r in rows]

    if search:
        sq = search.lower()
        tasks = [t for t in tasks if sq in t.title.lower() or sq in t.description.lower()]
    if project:
        tasks = [t for t in tasks if project.lower() in t.project.lower()]

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
    with SessionLocal() as db:
        row = db.query(TaskRow).filter(
            TaskRow.id == task_id,
            TaskRow.is_completed == True,
        ).first()
        if row is None:
            return None
        task = _row_to_task(row)
        task.status = TaskStatus.INCOMING
        task.bucket = TaskBucket.BACKLOG
        task.completed_at = None
        task.updated_at = datetime.now().isoformat()
        _apply_task_to_row(row, task)
        row.is_completed = False
        db.commit()
        return task


def delete_task(task_id: str) -> bool:
    with SessionLocal() as db:
        row = db.query(TaskRow).filter(TaskRow.id == task_id).first()
        if row is None:
            return False
        db.delete(row)
        db.commit()
    return True


def get_dashboard_summary() -> DashboardSummary:
    with SessionLocal() as db:
        active_rows = db.query(TaskRow).filter(TaskRow.is_completed == False).all()
        week_ago = (datetime.now() - timedelta(days=7)).isoformat()
        completed_this_week = db.query(TaskRow).filter(
            TaskRow.is_completed == True,
            TaskRow.completed_at >= week_ago,
        ).count()

    active_tasks = [_row_to_task(r) for r in active_rows]

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
