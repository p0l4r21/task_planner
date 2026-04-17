from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..models.idea import Idea, IdeaCreate, IdeaEntry, IdeaEntryCreate, IdeaEntryUpdate, IdeaUpdate
from ..services import idea_service

router = APIRouter(prefix="/api/ideas", tags=["ideas"])


@router.post("", response_model=Idea, status_code=201)
def create_idea(data: IdeaCreate):
    return idea_service.create_idea(data)


@router.get("", response_model=list[Idea])
def list_ideas(
    status: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    sort_dir: str = Query("desc"),
):
    return idea_service.list_ideas(
        status=status, tag=tag, search=search,
        sort_by=sort_by, sort_dir=sort_dir,
    )


@router.get("/{idea_id}", response_model=Idea)
def get_idea(idea_id: str):
    idea = idea_service.get_idea(idea_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea


@router.put("/{idea_id}", response_model=Idea)
def update_idea(idea_id: str, data: IdeaUpdate):
    idea = idea_service.update_idea(idea_id, data)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea


@router.get("/{idea_id}/entries", response_model=list[IdeaEntry])
def list_entries(idea_id: str):
    entries = idea_service.list_entries(idea_id)
    if entries is None:
        raise HTTPException(status_code=404, detail="Idea not found")
    return entries


@router.post("/{idea_id}/entries", response_model=IdeaEntry, status_code=201)
def create_entry(idea_id: str, data: IdeaEntryCreate):
    entry = idea_service.create_entry(idea_id, data)
    if not entry:
        raise HTTPException(status_code=404, detail="Idea not found")
    return entry


@router.put("/{idea_id}/entries/{entry_id}", response_model=IdeaEntry)
def update_entry(idea_id: str, entry_id: str, data: IdeaEntryUpdate):
    entry = idea_service.update_entry(idea_id, entry_id, data)
    if not entry:
        raise HTTPException(status_code=404, detail="Idea entry not found")
    return entry


@router.delete("/{idea_id}/entries/{entry_id}", status_code=204)
def delete_entry(idea_id: str, entry_id: str):
    if not idea_service.delete_entry(idea_id, entry_id):
        raise HTTPException(status_code=404, detail="Idea entry not found")


@router.delete("/{idea_id}", status_code=204)
def delete_idea(idea_id: str):
    if not idea_service.delete_idea(idea_id):
        raise HTTPException(status_code=404, detail="Idea not found")


class ConvertBody(BaseModel):
    project_id: str


@router.post("/{idea_id}/convert", response_model=Idea)
def convert_idea(idea_id: str, body: ConvertBody):
    idea = idea_service.convert_to_project(idea_id, body.project_id)
    if not idea:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea
