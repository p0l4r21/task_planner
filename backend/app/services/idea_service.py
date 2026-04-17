from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from ..database import SessionLocal
from ..db_models import IdeaEntryRow, IdeaRow
from ..models.idea import Idea, IdeaCreate, IdeaEntry, IdeaEntryCreate, IdeaEntryUpdate, IdeaStatus, IdeaUpdate


def _status_value(status: str | IdeaStatus) -> str:
    return status.value if isinstance(status, IdeaStatus) else status


def _row_to_idea(row: IdeaRow) -> Idea:
    summary = row.summary or row.description or ""
    return Idea(
        id=row.id,
        title=row.title,
        summary=summary,
        current_state=row.current_state or "",
        proposed_change=row.proposed_change or "",
        why_it_matters=row.why_it_matters or "",
        body=row.body or "",
        status=row.status,
        tags=row.tags or "",
        notes=row.notes or "",
        created_at=row.created_at,
        updated_at=row.updated_at,
        linked_project_ids=row.linked_project_ids or "",
        linked_task_ids=row.linked_task_ids or "",
        linked_milestone_ids=row.linked_milestone_ids or "",
        linked_idea_ids=row.linked_idea_ids or "",
        parent_idea_id=row.parent_idea_id,
        links_json=row.links_json or "",
        converted_project_id=row.converted_project_id,
        description=row.description or summary,
    )


def _row_to_entry(row: IdeaEntryRow) -> IdeaEntry:
    return IdeaEntry(
        id=row.id,
        idea_id=row.idea_id,
        title=row.title or "",
        content=row.content or "",
        type=row.type or "note",
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _apply_idea_to_row(row: IdeaRow, idea: Idea) -> None:
    row.title = idea.title
    row.summary = idea.summary or idea.description or ""
    row.current_state = idea.current_state
    row.proposed_change = idea.proposed_change
    row.why_it_matters = idea.why_it_matters
    row.body = idea.body
    row.description = row.summary
    row.status = _status_value(idea.status)
    row.tags = idea.tags
    row.notes = idea.notes
    row.created_at = idea.created_at
    row.updated_at = idea.updated_at
    row.linked_project_ids = idea.linked_project_ids
    row.linked_task_ids = idea.linked_task_ids
    row.linked_milestone_ids = idea.linked_milestone_ids
    row.linked_idea_ids = idea.linked_idea_ids
    row.parent_idea_id = idea.parent_idea_id
    row.links_json = idea.links_json
    row.converted_project_id = idea.converted_project_id


def _apply_entry_to_row(row: IdeaEntryRow, entry: IdeaEntry) -> None:
    row.id = entry.id
    row.idea_id = entry.idea_id
    row.title = entry.title
    row.content = entry.content
    row.type = entry.type or "note"
    row.created_at = entry.created_at
    row.updated_at = entry.updated_at


def _touch_idea(row: IdeaRow, timestamp: str) -> None:
    row.updated_at = timestamp


def create_idea(data: IdeaCreate) -> Idea:
    payload = data.model_dump()
    if not payload.get("summary") and payload.get("description"):
        payload["summary"] = payload["description"]
    idea = Idea(**payload)
    with SessionLocal() as db:
        row = IdeaRow()
        _apply_idea_to_row(row, idea)
        row.id = idea.id
        db.add(row)
        db.commit()
    return idea


def list_ideas(
    status: Optional[str] = None,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_dir: str = "desc",
) -> List[Idea]:
    with SessionLocal() as db:
        q = db.query(IdeaRow)
        if status:
            q = q.filter(IdeaRow.status == status)
        rows = q.all()

    ideas = [_row_to_idea(r) for r in rows]

    if tag:
        ideas = [i for i in ideas if tag.lower() in i.tags.lower()]
    if search:
        sq = search.lower()
        ideas = [
            i for i in ideas
            if sq in i.title.lower() or sq in i.description.lower() or sq in i.notes.lower()
            or sq in i.summary.lower() or sq in i.current_state.lower()
            or sq in i.proposed_change.lower() or sq in i.why_it_matters.lower()
            or sq in i.body.lower()
        ]

    reverse = sort_dir == "desc"
    if sort_by == "title":
        ideas.sort(key=lambda i: i.title.lower(), reverse=reverse)
    elif sort_by == "created_at":
        ideas.sort(key=lambda i: i.created_at, reverse=reverse)
    elif sort_by == "updated_at":
        ideas.sort(key=lambda i: i.updated_at, reverse=reverse)
    else:
        ideas.sort(key=lambda i: i.updated_at, reverse=True)

    return ideas


def get_idea(idea_id: str) -> Optional[Idea]:
    with SessionLocal() as db:
        row = db.query(IdeaRow).filter(IdeaRow.id == idea_id).first()
    if row is None:
        return None
    return _row_to_idea(row)


def update_idea(idea_id: str, data: IdeaUpdate) -> Optional[Idea]:
    with SessionLocal() as db:
        row = db.query(IdeaRow).filter(IdeaRow.id == idea_id).first()
        if row is None:
            return None
        idea = _row_to_idea(row)
        payload = data.model_dump(exclude_unset=True)
        if "summary" not in payload and "description" in payload:
            payload["summary"] = payload["description"]
        for k, v in payload.items():
            setattr(idea, k, v)
        idea.updated_at = datetime.now().isoformat()
        _apply_idea_to_row(row, idea)
        db.commit()
        return _row_to_idea(row)


def list_entries(idea_id: str) -> Optional[List[IdeaEntry]]:
    with SessionLocal() as db:
        idea = db.query(IdeaRow).filter(IdeaRow.id == idea_id).first()
        if idea is None:
            return None
        rows = (
            db.query(IdeaEntryRow)
            .filter(IdeaEntryRow.idea_id == idea_id)
            .order_by(IdeaEntryRow.created_at.desc())
            .all()
        )
    return [_row_to_entry(row) for row in rows]


def create_entry(idea_id: str, data: IdeaEntryCreate) -> Optional[IdeaEntry]:
    now = datetime.now().isoformat()
    with SessionLocal() as db:
        idea = db.query(IdeaRow).filter(IdeaRow.id == idea_id).first()
        if idea is None:
            return None
        entry = IdeaEntry(
            idea_id=idea_id,
            title=data.title,
            content=data.content,
            type=data.type or "note",
            created_at=now,
            updated_at=now,
        )
        row = IdeaEntryRow()
        _apply_entry_to_row(row, entry)
        _touch_idea(idea, now)
        db.add(row)
        db.commit()
        return _row_to_entry(row)


def update_entry(idea_id: str, entry_id: str, data: IdeaEntryUpdate) -> Optional[IdeaEntry]:
    now = datetime.now().isoformat()
    with SessionLocal() as db:
        idea = db.query(IdeaRow).filter(IdeaRow.id == idea_id).first()
        if idea is None:
            return None
        row = (
            db.query(IdeaEntryRow)
            .filter(IdeaEntryRow.idea_id == idea_id, IdeaEntryRow.id == entry_id)
            .first()
        )
        if row is None:
            return None
        entry = _row_to_entry(row)
        payload = data.model_dump(exclude_unset=True)
        for key, value in payload.items():
            setattr(entry, key, value)
        entry.updated_at = now
        _apply_entry_to_row(row, entry)
        _touch_idea(idea, now)
        db.commit()
        return _row_to_entry(row)


def delete_entry(idea_id: str, entry_id: str) -> bool:
    now = datetime.now().isoformat()
    with SessionLocal() as db:
        idea = db.query(IdeaRow).filter(IdeaRow.id == idea_id).first()
        if idea is None:
            return False
        row = (
            db.query(IdeaEntryRow)
            .filter(IdeaEntryRow.idea_id == idea_id, IdeaEntryRow.id == entry_id)
            .first()
        )
        if row is None:
            return False
        db.delete(row)
        _touch_idea(idea, now)
        db.commit()
    return True


def delete_idea(idea_id: str) -> bool:
    with SessionLocal() as db:
        row = db.query(IdeaRow).filter(IdeaRow.id == idea_id).first()
        if row is None:
            return False
        db.query(IdeaRow).filter(IdeaRow.parent_idea_id == idea_id).update(
            {IdeaRow.parent_idea_id: None},
            synchronize_session=False,
        )
        rows_with_links = db.query(IdeaRow).filter(IdeaRow.linked_idea_ids != "").all()
        for linked_row in rows_with_links:
            linked_ids = [id.strip() for id in (linked_row.linked_idea_ids or "").split(",") if id.strip()]
            if idea_id in linked_ids:
                linked_row.linked_idea_ids = ",".join(id for id in linked_ids if id != idea_id)
        db.query(IdeaEntryRow).filter(IdeaEntryRow.idea_id == idea_id).delete()
        db.delete(row)
        db.commit()
    return True


def convert_to_project(idea_id: str, project_id: str) -> Optional[Idea]:
    """Mark an idea as converted and link it to the newly created project."""
    with SessionLocal() as db:
        row = db.query(IdeaRow).filter(IdeaRow.id == idea_id).first()
        if row is None:
            return None
        idea = _row_to_idea(row)
        idea.status = IdeaStatus.CONVERTED
        idea.converted_project_id = project_id
        # Also add to linked project ids
        existing = [pid.strip() for pid in idea.linked_project_ids.split(",") if pid.strip()]
        if project_id not in existing:
            existing.append(project_id)
        idea.linked_project_ids = ",".join(existing)
        idea.updated_at = datetime.now().isoformat()
        _apply_idea_to_row(row, idea)
        db.commit()
        return _row_to_idea(row)
