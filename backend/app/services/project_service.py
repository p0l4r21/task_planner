from __future__ import annotations

import csv
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

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
# CSV paths & field definitions
# ---------------------------------------------------------------------------

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
PROJECTS_CSV = DATA_DIR / "projects.csv"
MILESTONES_CSV = DATA_DIR / "milestones.csv"

PROJECT_FIELDS = [
    "id", "name", "description", "status", "priority",
    "start_date", "target_end_date", "owner", "tags",
    "created_at", "updated_at",
]

MILESTONE_FIELDS = [
    "id", "project_id", "title", "description", "priority", "due_date",
    "status", "is_major", "parent_milestone_id", "linked_milestone_ids",
    "task_ids", "order_index", "created_at", "updated_at", "completed_at",
]

_lock = threading.Lock()

# ---------------------------------------------------------------------------
# CSV helpers (mirrors task_service pattern)
# ---------------------------------------------------------------------------


def _ensure_csv(path: Path, fields: List[str]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        with open(path, "w", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=fields).writeheader()


def _read_csv(path: Path, fields: List[str]) -> List[dict]:
    _ensure_csv(path, fields)
    with open(path, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = []
        for row in reader:
            for field in fields:
                if field not in row:
                    row[field] = ""
            rows.append(row)
        return rows


def _write_csv(path: Path, fields: List[str], rows: List[dict]) -> None:
    _ensure_csv(path, fields)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def _append_csv(path: Path, fields: List[str], row: dict) -> None:
    _ensure_csv(path, fields)
    with open(path, "a", newline="", encoding="utf-8") as f:
        csv.DictWriter(f, fieldnames=fields).writerow(row)


# ---------------------------------------------------------------------------
# Row ↔ model conversions
# ---------------------------------------------------------------------------


def _row_to_project(row: dict) -> Project:
    clean = {}
    for k, v in row.items():
        if k in ("start_date", "target_end_date"):
            clean[k] = v if v else None
        else:
            clean[k] = v
    return Project(**clean)


def _project_to_row(p: Project) -> dict:
    d = p.model_dump()
    for k, v in d.items():
        if v is None:
            d[k] = ""
    return d


def _row_to_milestone(row: dict) -> Milestone:
    clean = {}
    for k, v in row.items():
        if k in ("due_date", "completed_at", "parent_milestone_id"):
            clean[k] = v if v else None
        elif k == "is_major":
            clean[k] = v.lower() in ("true", "1", "yes") if isinstance(v, str) else bool(v)
        elif k == "order_index":
            try:
                clean[k] = int(v) if v else 0
            except (ValueError, TypeError):
                clean[k] = 0
        else:
            clean[k] = v
    return Milestone(**clean)


def _milestone_to_row(m: Milestone) -> dict:
    d = m.model_dump()
    for k, v in d.items():
        if v is None:
            d[k] = ""
        elif isinstance(v, bool):
            d[k] = str(v)
    return d


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
    with _lock:
        _append_csv(PROJECTS_CSV, PROJECT_FIELDS, _project_to_row(project))
    return project


def list_projects() -> List[Project]:
    with _lock:
        rows = _read_csv(PROJECTS_CSV, PROJECT_FIELDS)
    return [_row_to_project(r) for r in rows]


def get_project(project_id: str) -> Optional[Project]:
    with _lock:
        rows = _read_csv(PROJECTS_CSV, PROJECT_FIELDS)
    for r in rows:
        if r["id"] == project_id:
            return _row_to_project(r)
    return None


def update_project(project_id: str, data: ProjectUpdate) -> Optional[Project]:
    with _lock:
        rows = _read_csv(PROJECTS_CSV, PROJECT_FIELDS)
        for i, r in enumerate(rows):
            if r["id"] == project_id:
                project = _row_to_project(r)
                for k, v in data.model_dump(exclude_unset=True).items():
                    setattr(project, k, v)
                project.updated_at = datetime.now().isoformat()
                rows[i] = _project_to_row(project)
                _write_csv(PROJECTS_CSV, PROJECT_FIELDS, rows)
                return _row_to_project(rows[i])
    return None


def delete_project(project_id: str) -> bool:
    with _lock:
        rows = _read_csv(PROJECTS_CSV, PROJECT_FIELDS)
        new_rows = [r for r in rows if r["id"] != project_id]
        if len(new_rows) == len(rows):
            return False
        _write_csv(PROJECTS_CSV, PROJECT_FIELDS, new_rows)
        # Also delete milestones belonging to this project
        ms_rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)
        ms_rows = [r for r in ms_rows if r["project_id"] != project_id]
        _write_csv(MILESTONES_CSV, MILESTONE_FIELDS, ms_rows)
    return True


# ===================================================================
# MILESTONE CRUD
# ===================================================================

def list_milestones(project_id: str) -> List[Milestone]:
    with _lock:
        rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)
    milestones = [_row_to_milestone(r) for r in rows if r["project_id"] == project_id]
    milestones.sort(key=lambda m: m.order_index)
    return milestones


def get_milestone(milestone_id: str) -> Optional[Milestone]:
    with _lock:
        rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)
    for r in rows:
        if r["id"] == milestone_id:
            return _row_to_milestone(r)
    return None


def create_milestone(project_id: str, data: MilestoneCreate) -> Milestone:
    # Enforce data integrity: minor milestones must have a parent, major must not
    is_major = data.is_major
    parent_id = data.parent_milestone_id
    if parent_id:
        is_major = False  # child milestones are always minor
    if is_major:
        parent_id = None  # major milestones have no parent

    milestone = Milestone(
        project_id=project_id,
        **{**data.model_dump(), "is_major": is_major, "parent_milestone_id": parent_id},
    )
    with _lock:
        _append_csv(MILESTONES_CSV, MILESTONE_FIELDS, _milestone_to_row(milestone))
    return milestone


def update_milestone(milestone_id: str, data: MilestoneUpdate) -> Optional[Milestone]:
    with _lock:
        rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)
        for i, r in enumerate(rows):
            if r["id"] == milestone_id:
                milestone = _row_to_milestone(r)
                update_data = data.model_dump(exclude_unset=True)
                for k, v in update_data.items():
                    setattr(milestone, k, v)
                milestone.updated_at = datetime.now().isoformat()
                if milestone.status == MilestoneStatus.COMPLETED and not milestone.completed_at:
                    milestone.completed_at = datetime.now().isoformat()
                rows[i] = _milestone_to_row(milestone)
                _write_csv(MILESTONES_CSV, MILESTONE_FIELDS, rows)
                updated_milestone = _row_to_milestone(rows[i])
                break
        else:
            return None

    # --- Two-way sync: milestone → tasks (field-aware) ---
    _sync_milestone_to_tasks(updated_milestone, update_data)
    return updated_milestone


def delete_milestone(milestone_id: str) -> bool:
    with _lock:
        rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)
        new_rows = [r for r in rows if r["id"] != milestone_id]
        if len(new_rows) == len(rows):
            return False
        # Remove this milestone from parent_milestone_id / linked references
        for r in new_rows:
            if r.get("parent_milestone_id") == milestone_id:
                r["parent_milestone_id"] = ""
            linked = _parse_ids(r.get("linked_milestone_ids", ""))
            if milestone_id in linked:
                linked.remove(milestone_id)
                r["linked_milestone_ids"] = _join_ids(linked)
        _write_csv(MILESTONES_CSV, MILESTONE_FIELDS, new_rows)
    return True


def complete_milestone(milestone_id: str) -> Optional[Milestone]:
    return update_milestone(milestone_id, MilestoneUpdate(
        status=MilestoneStatus.COMPLETED,
    ))


# ===================================================================
# LINKING: tasks ↔ milestones
# ===================================================================

def link_task(milestone_id: str, task_id: str) -> Optional[Milestone]:
    """Add a task to a milestone's task_ids list."""
    with _lock:
        rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)
        for i, r in enumerate(rows):
            if r["id"] == milestone_id:
                ids = _parse_ids(r.get("task_ids", ""))
                if task_id not in ids:
                    ids.append(task_id)
                    r["task_ids"] = _join_ids(ids)
                    r["updated_at"] = datetime.now().isoformat()
                    rows[i] = r
                    _write_csv(MILESTONES_CSV, MILESTONE_FIELDS, rows)
                return _row_to_milestone(rows[i])
    return None


def unlink_task(milestone_id: str, task_id: str) -> Optional[Milestone]:
    """Remove a task from a milestone's task_ids list."""
    with _lock:
        rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)
        for i, r in enumerate(rows):
            if r["id"] == milestone_id:
                ids = _parse_ids(r.get("task_ids", ""))
                if task_id in ids:
                    ids.remove(task_id)
                    r["task_ids"] = _join_ids(ids)
                    r["updated_at"] = datetime.now().isoformat()
                    rows[i] = r
                    _write_csv(MILESTONES_CSV, MILESTONE_FIELDS, rows)
                return _row_to_milestone(rows[i])
    return None


def link_milestones(milestone_id: str, target_milestone_id: str) -> Optional[Milestone]:
    """Bidirectionally link two milestones."""
    with _lock:
        rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)
        idx_a, idx_b = None, None
        for i, r in enumerate(rows):
            if r["id"] == milestone_id:
                idx_a = i
            elif r["id"] == target_milestone_id:
                idx_b = i

        if idx_a is None:
            return None

        # Add target to source
        ids_a = _parse_ids(rows[idx_a].get("linked_milestone_ids", ""))
        if target_milestone_id not in ids_a:
            ids_a.append(target_milestone_id)
            rows[idx_a]["linked_milestone_ids"] = _join_ids(ids_a)
            rows[idx_a]["updated_at"] = datetime.now().isoformat()

        # Add source to target (bidirectional)
        if idx_b is not None:
            ids_b = _parse_ids(rows[idx_b].get("linked_milestone_ids", ""))
            if milestone_id not in ids_b:
                ids_b.append(milestone_id)
                rows[idx_b]["linked_milestone_ids"] = _join_ids(ids_b)
                rows[idx_b]["updated_at"] = datetime.now().isoformat()

        _write_csv(MILESTONES_CSV, MILESTONE_FIELDS, rows)
        return _row_to_milestone(rows[idx_a])


# ===================================================================
# TWO-WAY SYNC
# ===================================================================

def _sync_milestone_to_tasks(milestone: Milestone, changed_fields: dict) -> None:
    """Push relevant milestone field changes to linked tasks."""
    task_ids = _parse_ids(milestone.task_ids)
    if not task_ids:
        return

    # Only sync fields that map to task fields
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
    """Called when a task is updated — propagate relevant changes to its milestone.
    Finds milestone that references this task_id and updates matching fields."""
    with _lock:
        rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)

    for r in rows:
        task_ids = _parse_ids(r.get("task_ids", ""))
        if task.id in task_ids:
            # Only sync non-destructively: if task title/desc changed, mirror it
            # For simplicity in v1, we do NOT auto-overwrite milestone fields
            # from task edits — the milestone is the "planning" layer.
            # We DO sync completion status.
            if task.status.value == "completed":
                _check_milestone_completion(r["id"])
            break


def _check_milestone_completion(milestone_id: str) -> None:
    """If all tasks for a milestone are completed, mark milestone completed."""
    milestone = get_milestone(milestone_id)
    if not milestone or milestone.status == MilestoneStatus.COMPLETED:
        return

    task_ids = _parse_ids(milestone.task_ids)
    if not task_ids:
        return

    # Check tasks in both active and completed CSVs
    all_complete = True
    for tid in task_ids:
        t = task_service.get_task(tid)
        if t is not None:
            # Task exists in active → not complete
            all_complete = False
            break
        # If not in active, check completed (it was moved there)
        # task_service doesn't expose get_completed_task, so we check presence
        # If get_task returns None, it's either completed or deleted - assume completed

    if all_complete:
        complete_milestone(milestone_id)


def on_task_completed(task_id: str) -> None:
    """Hook called after a task is completed — check milestone rollup."""
    with _lock:
        rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)
    for r in rows:
        if task_id in _parse_ids(r.get("task_ids", "")):
            _check_milestone_completion(r["id"])
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

    ms_by_id = {m.id: m for m in milestones}

    def _build_progress(m: Milestone) -> MilestoneProgress:
        task_ids = _parse_ids(m.task_ids)
        # Count completed tasks: if task_service.get_task returns None, it's completed
        completed = 0
        for tid in task_ids:
            t = task_service.get_task(tid)
            if t is None:
                completed += 1

        # Build child milestones (minor milestones under this major)
        children = [
            ms for ms in milestones
            if ms.parent_milestone_id == m.id
        ]
        child_progress = [_build_progress(c) for c in children]

        return MilestoneProgress(
            milestone_id=m.id,
            title=m.title,
            is_major=m.is_major,
            status=m.status,
            total_tasks=len(task_ids),
            completed_tasks=completed,
            child_milestones=child_progress,
        )

    # Top-level = major milestones without a parent
    top_level = [m for m in milestones if m.is_major and not m.parent_milestone_id]
    milestone_progress = [_build_progress(m) for m in top_level]

    # Also include orphan minor milestones (no parent, not major)
    orphan_minors = [
        m for m in milestones
        if not m.is_major and not m.parent_milestone_id
    ]
    for om in orphan_minors:
        milestone_progress.append(_build_progress(om))

    total_major = len(top_level)
    completed_major = sum(1 for m in top_level if m.status == MilestoneStatus.COMPLETED)

    return ProjectProgress(
        project_id=project_id,
        project_name=project.name,
        total_major=total_major,
        completed_major=completed_major,
        percent=round((completed_major / total_major * 100) if total_major > 0 else 0, 1),
        milestones=milestone_progress,
    )


# ===================================================================
# DISCOVERY: find tasks that match a project name
# ===================================================================

def discover_project_tasks(project_id: str) -> List[Task]:
    """Find active tasks whose project field matches this project's name."""
    project = get_project(project_id)
    if not project:
        return []
    all_tasks = task_service.list_active_tasks(project=project.name)
    return all_tasks


# ===================================================================
# CALENDAR: milestones in date range
# ===================================================================

def list_calendar_milestones(start: str, end: str) -> List[dict]:
    """Return milestones whose due_date falls within [start, end], enriched with project name."""
    with _lock:
        ms_rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)
        proj_rows = _read_csv(PROJECTS_CSV, PROJECT_FIELDS)

    proj_map = {r["id"]: r["name"] for r in proj_rows}
    results = []
    for r in ms_rows:
        due = (r.get("due_date") or "")[:10]
        if due and start <= due <= end:
            m = _row_to_milestone(r)
            results.append({
                "id": m.id,
                "project_id": m.project_id,
                "project_name": proj_map.get(m.project_id, ""),
                "title": m.title,
                "due_date": m.due_date,
                "status": m.status.value,
                "is_major": m.is_major,
                "priority": m.priority,
            })
    return results


# ===================================================================
# DASHBOARD: project overview summary
# ===================================================================

def get_projects_summary() -> dict:
    """Return aggregate project/milestone stats for the dashboard."""
    with _lock:
        proj_rows = _read_csv(PROJECTS_CSV, PROJECT_FIELDS)
        ms_rows = _read_csv(MILESTONES_CSV, MILESTONE_FIELDS)

    projects = [_row_to_project(r) for r in proj_rows]
    milestones = [_row_to_milestone(r) for r in ms_rows]

    active_projects = [p for p in projects if p.status.value in ("planning", "active")]
    total_milestones = len(milestones)
    completed_milestones = sum(1 for m in milestones if m.status == MilestoneStatus.COMPLETED)
    pending_milestones = total_milestones - completed_milestones

    # Upcoming milestones (due within next 14 days, not completed)
    now_str = datetime.now().strftime("%Y-%m-%d")
    future_14 = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
    upcoming = []
    proj_map = {p.id: p.name for p in projects}
    for m in milestones:
        if m.status != MilestoneStatus.COMPLETED and m.due_date:
            due = m.due_date[:10]
            if due <= future_14:
                upcoming.append({
                    "id": m.id,
                    "title": m.title,
                    "due_date": m.due_date,
                    "project_name": proj_map.get(m.project_id, ""),
                    "is_major": m.is_major,
                    "is_overdue": due < now_str,
                })
    upcoming.sort(key=lambda x: x["due_date"])

    # Per-project mini progress
    project_summaries = []
    for p in active_projects:
        p_milestones = [m for m in milestones if m.project_id == p.id]
        total = len(p_milestones)
        done = sum(1 for m in p_milestones if m.status == MilestoneStatus.COMPLETED)
        task_count = len(task_service.list_active_tasks(project=p.name))
        project_summaries.append({
            "id": p.id,
            "name": p.name,
            "status": p.status.value,
            "priority": p.priority.value,
            "total_milestones": total,
            "completed_milestones": done,
            "active_tasks": task_count,
            "target_end_date": p.target_end_date,
        })

    return {
        "total_projects": len(projects),
        "active_projects": len(active_projects),
        "total_milestones": total_milestones,
        "completed_milestones": completed_milestones,
        "pending_milestones": pending_milestones,
        "upcoming_milestones": upcoming,
        "projects": project_summaries,
    }


# ===================================================================
# BATCH CREATION
# ===================================================================

def create_project_with_milestones(data: ProjectCreateWithMilestones) -> dict:
    """Create a project and its full milestone hierarchy in one go."""
    project = Project(
        name=data.name,
        description=data.description,
        status=data.status,
        priority=data.priority,
        start_date=data.start_date,
        target_end_date=data.target_end_date,
        owner=data.owner,
        tags=data.tags,
    )
    with _lock:
        _append_csv(PROJECTS_CSV, PROJECT_FIELDS, _project_to_row(project))

    milestones: List[Milestone] = []
    for idx, inline in enumerate(data.milestones):
        major = Milestone(
            project_id=project.id,
            title=inline.title,
            description=inline.description,
            priority=inline.priority,
            due_date=inline.due_date,
            is_major=True,
            parent_milestone_id=None,
            order_index=idx,
        )
        milestones.append(major)
        for cidx, child in enumerate(inline.children):
            minor = Milestone(
                project_id=project.id,
                title=child.title,
                description=child.description,
                priority=child.priority,
                due_date=child.due_date,
                is_major=False,
                parent_milestone_id=major.id,
                order_index=cidx,
            )
            milestones.append(minor)

    if milestones:
        with _lock:
            for m in milestones:
                _append_csv(MILESTONES_CSV, MILESTONE_FIELDS, _milestone_to_row(m))

    return {"project": project, "milestones": milestones}


def create_children(parent_milestone_id: str, children: List[InlineMilestoneCreate]) -> List[Milestone]:
    """Create sub-milestones under an existing milestone."""
    parent = get_milestone(parent_milestone_id)
    if not parent:
        return []

    created: List[Milestone] = []
    with _lock:
        for idx, child in enumerate(children):
            minor = Milestone(
                project_id=parent.project_id,
                title=child.title,
                description=child.description,
                priority=child.priority,
                due_date=child.due_date,
                is_major=False,
                parent_milestone_id=parent_milestone_id,
                order_index=idx,
            )
            _append_csv(MILESTONES_CSV, MILESTONE_FIELDS, _milestone_to_row(minor))
            created.append(minor)
    return created
