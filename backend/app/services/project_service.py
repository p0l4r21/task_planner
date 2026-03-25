from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from ..database import SessionLocal
from ..db_models import MilestoneRow, ProjectRow
from ..models.project import (
    InlineMilestoneCreate,
    Milestone,
    MilestoneCreate,
    MilestoneProgress,
    MilestoneStatus,
    MilestoneUpdate,
    Project,
    ProjectCreate,
    ProjectCreateWithMilestones,
    ProjectProgress,
    ProjectUpdate,
)
from ..models.task import Task, TaskBucket, TaskStatus, TaskUpdate
from ..services import task_service


# ---------------------------------------------------------------------------
# Row <-> Pydantic conversions
# ---------------------------------------------------------------------------

def _row_to_project(row: ProjectRow) -> Project:
    return Project(
        id=row.id,
        name=row.name,
        description=row.description or "",
        status=row.status,
        priority=row.priority,
        start_date=row.start_date,
        target_end_date=row.target_end_date,
        owner=row.owner or "local_user",
        tags=row.tags or "",
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _apply_project_to_row(row: ProjectRow, p: Project) -> None:
    row.name = p.name
    row.description = p.description
    row.status = p.status.value
    row.priority = p.priority.value
    row.start_date = p.start_date
    row.target_end_date = p.target_end_date
    row.owner = p.owner
    row.tags = p.tags
    row.created_at = p.created_at
    row.updated_at = p.updated_at


def _row_to_milestone(row: MilestoneRow) -> Milestone:
    return Milestone(
        id=row.id,
        project_id=row.project_id,
        title=row.title,
        description=row.description or "",
        priority=row.priority or "medium",
        due_date=row.due_date,
        status=row.status,
        is_major=row.is_major,
        parent_milestone_id=row.parent_milestone_id if row.parent_milestone_id else None,
        linked_milestone_ids=row.linked_milestone_ids or "",
        task_ids=row.task_ids or "",
        order_index=row.order_index or 0,
        created_at=row.created_at,
        updated_at=row.updated_at,
        completed_at=row.completed_at,
    )


def _apply_milestone_to_row(row: MilestoneRow, m: Milestone) -> None:
    row.project_id = m.project_id
    row.title = m.title
    row.description = m.description
    row.priority = m.priority
    row.due_date = m.due_date
    row.status = m.status.value
    row.is_major = m.is_major
    row.parent_milestone_id = m.parent_milestone_id
    row.linked_milestone_ids = m.linked_milestone_ids
    row.task_ids = m.task_ids
    row.order_index = m.order_index
    row.created_at = m.created_at
    row.updated_at = m.updated_at
    row.completed_at = m.completed_at


# ---------------------------------------------------------------------------
# Helpers for comma-separated ID lists
# ---------------------------------------------------------------------------

def _parse_ids(csv_str: str) -> List[str]:
    if not csv_str or not csv_str.strip():
        return []
    return [s.strip() for s in csv_str.split(",") if s.strip()]


def _join_ids(ids: List[str]) -> str:
    return ",".join(ids)


# ===================================================================
# PROJECT CRUD
# ===================================================================

def create_project(data: ProjectCreate) -> Project:
    project = Project(**data.model_dump())
    with SessionLocal() as db:
        row = ProjectRow()
        _apply_project_to_row(row, project)
        row.id = project.id
        db.add(row)
        db.commit()
    return project


def list_projects() -> List[Project]:
    with SessionLocal() as db:
        rows = db.query(ProjectRow).all()
    return [_row_to_project(r) for r in rows]


def get_project(project_id: str) -> Optional[Project]:
    with SessionLocal() as db:
        row = db.query(ProjectRow).filter(ProjectRow.id == project_id).first()
    if row is None:
        return None
    return _row_to_project(row)


def update_project(project_id: str, data: ProjectUpdate) -> Optional[Project]:
    with SessionLocal() as db:
        row = db.query(ProjectRow).filter(ProjectRow.id == project_id).first()
        if row is None:
            return None
        project = _row_to_project(row)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(project, k, v)
        project.updated_at = datetime.now().isoformat()
        _apply_project_to_row(row, project)
        db.commit()
        return _row_to_project(row)


def delete_project(project_id: str) -> bool:
    with SessionLocal() as db:
        row = db.query(ProjectRow).filter(ProjectRow.id == project_id).first()
        if row is None:
            return False
        db.delete(row)
        # Also delete milestones belonging to this project
        db.query(MilestoneRow).filter(MilestoneRow.project_id == project_id).delete()
        db.commit()
    return True


# ===================================================================
# MILESTONE CRUD
# ===================================================================

def list_milestones(project_id: str) -> List[Milestone]:
    with SessionLocal() as db:
        rows = db.query(MilestoneRow).filter(
            MilestoneRow.project_id == project_id
        ).order_by(MilestoneRow.order_index).all()
    return [_row_to_milestone(r) for r in rows]


def get_milestone(milestone_id: str) -> Optional[Milestone]:
    with SessionLocal() as db:
        row = db.query(MilestoneRow).filter(MilestoneRow.id == milestone_id).first()
    if row is None:
        return None
    return _row_to_milestone(row)


def create_milestone(project_id: str, data: MilestoneCreate) -> Milestone:
    is_major = data.is_major
    parent_id = data.parent_milestone_id
    if parent_id:
        is_major = False
    if is_major:
        parent_id = None

    milestone = Milestone(
        project_id=project_id,
        **{**data.model_dump(), "is_major": is_major, "parent_milestone_id": parent_id},
    )
    with SessionLocal() as db:
        row = MilestoneRow()
        _apply_milestone_to_row(row, milestone)
        row.id = milestone.id
        db.add(row)
        db.commit()
    return milestone


def update_milestone(milestone_id: str, data: MilestoneUpdate) -> Optional[Milestone]:
    with SessionLocal() as db:
        row = db.query(MilestoneRow).filter(MilestoneRow.id == milestone_id).first()
        if row is None:
            return None
        milestone = _row_to_milestone(row)
        update_data = data.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(milestone, k, v)
        milestone.updated_at = datetime.now().isoformat()
        if milestone.status == MilestoneStatus.COMPLETED and not milestone.completed_at:
            milestone.completed_at = datetime.now().isoformat()
        _apply_milestone_to_row(row, milestone)
        db.commit()
        updated_milestone = _row_to_milestone(row)

    _sync_milestone_to_tasks(updated_milestone, update_data)
    return updated_milestone


def delete_milestone(milestone_id: str) -> bool:
    with SessionLocal() as db:
        row = db.query(MilestoneRow).filter(MilestoneRow.id == milestone_id).first()
        if row is None:
            return False
        db.delete(row)
        # Clean up references in other milestones
        other_rows = db.query(MilestoneRow).all()
        for r in other_rows:
            if r.parent_milestone_id == milestone_id:
                r.parent_milestone_id = None
            linked = _parse_ids(r.linked_milestone_ids or "")
            if milestone_id in linked:
                linked.remove(milestone_id)
                r.linked_milestone_ids = _join_ids(linked)
        db.commit()
    return True


def complete_milestone(milestone_id: str) -> Optional[Milestone]:
    return update_milestone(milestone_id, MilestoneUpdate(
        status=MilestoneStatus.COMPLETED,
    ))


# ===================================================================
# LINKING: tasks <-> milestones
# ===================================================================

def link_task(milestone_id: str, task_id: str) -> Optional[Milestone]:
    with SessionLocal() as db:
        row = db.query(MilestoneRow).filter(MilestoneRow.id == milestone_id).first()
        if row is None:
            return None
        ids = _parse_ids(row.task_ids or "")
        if task_id not in ids:
            ids.append(task_id)
            row.task_ids = _join_ids(ids)
            row.updated_at = datetime.now().isoformat()
        db.commit()
        return _row_to_milestone(row)


def unlink_task(milestone_id: str, task_id: str) -> Optional[Milestone]:
    with SessionLocal() as db:
        row = db.query(MilestoneRow).filter(MilestoneRow.id == milestone_id).first()
        if row is None:
            return None
        ids = _parse_ids(row.task_ids or "")
        if task_id in ids:
            ids.remove(task_id)
            row.task_ids = _join_ids(ids)
            row.updated_at = datetime.now().isoformat()
        db.commit()
        return _row_to_milestone(row)


def link_milestones(milestone_id: str, target_milestone_id: str) -> Optional[Milestone]:
    with SessionLocal() as db:
        row_a = db.query(MilestoneRow).filter(MilestoneRow.id == milestone_id).first()
        if row_a is None:
            return None
        ids_a = _parse_ids(row_a.linked_milestone_ids or "")
        if target_milestone_id not in ids_a:
            ids_a.append(target_milestone_id)
            row_a.linked_milestone_ids = _join_ids(ids_a)
            row_a.updated_at = datetime.now().isoformat()

        row_b = db.query(MilestoneRow).filter(MilestoneRow.id == target_milestone_id).first()
        if row_b is not None:
            ids_b = _parse_ids(row_b.linked_milestone_ids or "")
            if milestone_id not in ids_b:
                ids_b.append(milestone_id)
                row_b.linked_milestone_ids = _join_ids(ids_b)
                row_b.updated_at = datetime.now().isoformat()

        db.commit()
        return _row_to_milestone(row_a)


# ===================================================================
# TWO-WAY SYNC
# ===================================================================

def _sync_milestone_to_tasks(milestone: Milestone, changed_fields: dict) -> None:
    task_ids = _parse_ids(milestone.task_ids)
    if not task_ids:
        return
    field_map = {
        "title": "title",
        "description": "description",
        "due_date": "due_date",
        "priority": "priority",
    }
    sync_data: dict = {}
    for ms_field, task_field in field_map.items():
        if ms_field in changed_fields:
            sync_data[task_field] = changed_fields[ms_field]
    if not sync_data:
        return
    for tid in task_ids:
        task_service.update_task(tid, TaskUpdate(**sync_data))


def sync_task_to_milestone(task: Task) -> None:
    with SessionLocal() as db:
        rows = db.query(MilestoneRow).all()
    for r in rows:
        task_ids = _parse_ids(r.task_ids or "")
        if task.id in task_ids:
            if task.status.value == "completed":
                _check_milestone_completion(r.id)
            break


def _check_milestone_completion(milestone_id: str) -> None:
    milestone = get_milestone(milestone_id)
    if not milestone or milestone.status == MilestoneStatus.COMPLETED:
        return
    task_ids = _parse_ids(milestone.task_ids)
    if not task_ids:
        return
    all_complete = True
    for tid in task_ids:
        t = task_service.get_task(tid)
        if t is not None:
            all_complete = False
            break
    if all_complete:
        complete_milestone(milestone_id)


def on_task_completed(task_id: str) -> None:
    with SessionLocal() as db:
        rows = db.query(MilestoneRow).all()
    for r in rows:
        if task_id in _parse_ids(r.task_ids or ""):
            _check_milestone_completion(r.id)
            break


# ===================================================================
# PROGRESS ROLLUP (hierarchical)
# ===================================================================

def get_project_progress(project_id: str) -> Optional[ProjectProgress]:
    project = get_project(project_id)
    if not project:
        return None

    milestones = list_milestones(project_id)
    if not milestones:
        return ProjectProgress(
            project_id=project_id,
            project_name=project.name,
        )

    def _build_progress(m: Milestone) -> MilestoneProgress:
        ms_task_ids = _parse_ids(m.task_ids)
        completed = 0
        for tid in ms_task_ids:
            t = task_service.get_task(tid)
            if t is None:
                completed += 1
        children = [ms for ms in milestones if ms.parent_milestone_id == m.id]
        child_progress = [_build_progress(c) for c in children]
        return MilestoneProgress(
            milestone_id=m.id,
            title=m.title,
            is_major=m.is_major,
            status=m.status,
            total_tasks=len(ms_task_ids),
            completed_tasks=completed,
            child_milestones=child_progress,
        )

    top_level = [m for m in milestones if m.is_major and not m.parent_milestone_id]
    milestone_progress = [_build_progress(m) for m in top_level]

    orphan_minors = [
        m for m in milestones
        if not m.is_major and not m.parent_milestone_id
    ]
    for om in orphan_minors:
        milestone_progress.append(_build_progress(om))

    total_major = len([m for m in milestones if m.is_major])
    completed_major = len([m for m in milestones if m.is_major and m.status == MilestoneStatus.COMPLETED])

    return ProjectProgress(
        project_id=project_id,
        project_name=project.name,
        total_major=total_major,
        completed_major=completed_major,
        percent=round(completed_major / total_major * 100, 1) if total_major else 0.0,
        milestones=milestone_progress,
    )


# ===================================================================
# BATCH / INLINE CREATION
# ===================================================================

def create_project_with_milestones(data: ProjectCreateWithMilestones) -> dict:
    project = create_project(ProjectCreate(
        name=data.name,
        description=data.description,
        status=data.status,
        priority=data.priority,
        start_date=data.start_date,
        target_end_date=data.target_end_date,
        owner=data.owner,
        tags=data.tags,
    ))

    created: List[Milestone] = []

    def _create_tree(items: List[InlineMilestoneCreate], parent_id: Optional[str] = None) -> None:
        for item in items:
            ms = create_milestone(project.id, MilestoneCreate(
                title=item.title,
                description=item.description,
                priority=item.priority,
                due_date=item.due_date,
                is_major=(parent_id is None),
                parent_milestone_id=parent_id,
            ))
            created.append(ms)
            if item.children:
                _create_tree(item.children, ms.id)

    if data.milestones:
        _create_tree(data.milestones)

    return {"project": project, "milestones": created}


def create_children(parent_milestone_id: str, children: List[InlineMilestoneCreate]) -> Optional[List[Milestone]]:
    parent = get_milestone(parent_milestone_id)
    if not parent:
        return None
    result: List[Milestone] = []
    for child in children:
        ms = create_milestone(parent.project_id, MilestoneCreate(
            title=child.title,
            description=child.description,
            priority=child.priority,
            due_date=child.due_date,
            is_major=False,
            parent_milestone_id=parent_milestone_id,
        ))
        result.append(ms)
    return result


# ===================================================================
# DISCOVERY
# ===================================================================

def discover_project_tasks(project_id: str) -> List[Task]:
    project = get_project(project_id)
    if not project:
        return []
    return task_service.list_active_tasks(project=project.name)


# ===================================================================
# CALENDAR milestones
# ===================================================================

def list_calendar_milestones(start: str, end: str) -> list:
    with SessionLocal() as db:
        rows = db.query(MilestoneRow).all()
    results = []
    for r in rows:
        m = _row_to_milestone(r)
        if m.due_date and start <= m.due_date[:10] <= end:
            results.append({
                "id": m.id,
                "project_id": m.project_id,
                "title": m.title,
                "due_date": m.due_date,
                "status": m.status.value,
                "is_major": m.is_major,
            })
    return results


# ===================================================================
# SUMMARY
# ===================================================================

def get_projects_summary() -> dict:
    from datetime import date as _date

    projects = list_projects()

    with SessionLocal() as db:
        all_milestones = [_row_to_milestone(r) for r in db.query(MilestoneRow).all()]

    today = _date.today().isoformat()

    # Per-project summary items
    project_items = []
    for p in projects:
        proj_ms = [m for m in all_milestones if m.project_id == p.id]
        active_tasks = task_service.list_active_tasks(project=p.name)
        project_items.append({
            "id": p.id,
            "name": p.name,
            "status": p.status.value,
            "priority": p.priority.value,
            "total_milestones": len(proj_ms),
            "completed_milestones": sum(1 for m in proj_ms if m.status.value == "completed"),
            "active_tasks": len(active_tasks),
            "target_end_date": p.target_end_date,
        })

    # Upcoming milestones (pending/in_progress with a due_date)
    upcoming = []
    for m in all_milestones:
        if m.status.value != "completed" and m.due_date:
            proj = next((p for p in projects if p.id == m.project_id), None)
            upcoming.append({
                "id": m.id,
                "title": m.title,
                "due_date": m.due_date,
                "project_name": proj.name if proj else "",
                "is_major": m.is_major,
                "is_overdue": m.due_date[:10] < today,
            })
    upcoming.sort(key=lambda x: x["due_date"])

    total_ms = len(all_milestones)
    completed_ms = sum(1 for m in all_milestones if m.status.value == "completed")

    return {
        "total_projects": len(projects),
        "active_projects": sum(1 for p in projects if p.status.value == "active"),
        "total_milestones": total_ms,
        "completed_milestones": completed_ms,
        "pending_milestones": total_ms - completed_ms,
        "upcoming_milestones": upcoming,
        "projects": project_items,
    }
