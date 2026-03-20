from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..models.task import (
    DashboardSummary,
    Task,
    TaskCreate,
    TaskMove,
    TaskUpdate,
)
from ..services import task_service

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("", response_model=Task, status_code=201)
def create_task(data: TaskCreate):
    return task_service.create_task(data)


@router.get("", response_model=list[Task])
def list_active_tasks(
    bucket: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    project: Optional[str] = Query(None),
    due_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_dir: str = Query("asc"),
):
    return task_service.list_active_tasks(
        bucket=bucket, priority=priority, tag=tag,
        project=project, due_date=due_date, search=search,
        sort_by=sort_by, sort_dir=sort_dir,
    )


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary():
    return task_service.get_dashboard_summary()


@router.get("/calendar", response_model=list[Task])
def calendar_tasks(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    """Return tasks that fall within [start, end] by scheduled_date or due_date."""
    return task_service.list_calendar_tasks(start, end)


@router.get("/completed", response_model=list[Task])
def list_completed_tasks(
    search: Optional[str] = Query(None),
    project: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_dir: str = Query("desc"),
):
    return task_service.list_completed_tasks(
        search=search, project=project, priority=priority,
        sort_by=sort_by, sort_dir=sort_dir,
    )


@router.get("/{task_id}", response_model=Task)
def get_task(task_id: str):
    task = task_service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=Task)
def update_task(task_id: str, data: TaskUpdate):
    task = task_service.update_task(task_id, data)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}/move", response_model=Task)
def move_task(task_id: str, data: TaskMove):
    task = task_service.move_task(task_id, data)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}/complete", response_model=Task)
def complete_task(task_id: str):
    task = task_service.complete_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/{task_id}/restore", response_model=Task)
def restore_task(task_id: str):
    task = task_service.restore_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: str):
    ok = task_service.delete_task(task_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Task not found")
