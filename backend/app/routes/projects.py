from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..models.project import (
    InlineMilestoneCreate,
    Milestone,
    MilestoneCreate,
    MilestoneUpdate,
    Project,
    ProjectCreate,
    ProjectCreateWithMilestones,
    ProjectProgress,
    ProjectUpdate,
)
from ..models.task import Task
from ..services import project_service

router = APIRouter(prefix="/api", tags=["projects"])


# ===================================================================
# Projects
# ===================================================================

@router.get("/projects", response_model=list[Project])
def list_projects():
    return project_service.list_projects()


@router.post("/projects", response_model=Project, status_code=201)
def create_project(data: ProjectCreate):
    return project_service.create_project(data)


@router.post("/projects/with-milestones", status_code=201)
def create_project_with_milestones(data: ProjectCreateWithMilestones):
    result = project_service.create_project_with_milestones(data)
    return result


@router.get("/projects/summary")
def projects_summary():
    return project_service.get_projects_summary()


@router.get("/projects/{project_id}", response_model=Project)
def get_project(project_id: str):
    p = project_service.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@router.put("/projects/{project_id}", response_model=Project)
def update_project(project_id: str, data: ProjectUpdate):
    p = project_service.update_project(project_id, data)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str):
    if not project_service.delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")


# ===================================================================
# Milestones
# ===================================================================

@router.get("/projects/{project_id}/milestones", response_model=list[Milestone])
def list_milestones(project_id: str):
    return project_service.list_milestones(project_id)


@router.post("/projects/{project_id}/milestones", response_model=Milestone, status_code=201)
def create_milestone(project_id: str, data: MilestoneCreate):
    p = project_service.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_service.create_milestone(project_id, data)


@router.put("/milestones/{milestone_id}", response_model=Milestone)
def update_milestone(milestone_id: str, data: MilestoneUpdate):
    m = project_service.update_milestone(milestone_id, data)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return m


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(milestone_id: str):
    if not project_service.delete_milestone(milestone_id):
        raise HTTPException(status_code=404, detail="Milestone not found")


@router.patch("/milestones/{milestone_id}/complete", response_model=Milestone)
def complete_milestone(milestone_id: str):
    m = project_service.complete_milestone(milestone_id)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return m


class ChildrenBody(BaseModel):
    children: list[InlineMilestoneCreate]


@router.post("/milestones/{milestone_id}/children", response_model=list[Milestone], status_code=201)
def create_children(milestone_id: str, body: ChildrenBody):
    result = project_service.create_children(milestone_id, body.children)
    if not result and not body.children:
        return []
    if not result:
        raise HTTPException(status_code=404, detail="Parent milestone not found")
    return result


# ===================================================================
# Linking
# ===================================================================

class LinkTaskBody(BaseModel):
    task_id: str


class LinkMilestoneBody(BaseModel):
    target_milestone_id: str


@router.post("/milestones/{milestone_id}/link-task", response_model=Milestone)
def link_task(milestone_id: str, body: LinkTaskBody):
    m = project_service.link_task(milestone_id, body.task_id)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return m


@router.post("/milestones/{milestone_id}/unlink-task", response_model=Milestone)
def unlink_task(milestone_id: str, body: LinkTaskBody):
    m = project_service.unlink_task(milestone_id, body.task_id)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return m


@router.post("/milestones/{milestone_id}/link-milestone", response_model=Milestone)
def link_milestone(milestone_id: str, body: LinkMilestoneBody):
    m = project_service.link_milestones(milestone_id, body.target_milestone_id)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return m


# ===================================================================
# Progress rollup
# ===================================================================

@router.get("/projects/{project_id}/progress", response_model=ProjectProgress)
def get_progress(project_id: str):
    progress = project_service.get_project_progress(project_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Project not found")
    return progress


# ===================================================================
# Discovery: tasks matching project name
# ===================================================================

@router.get("/projects/{project_id}/tasks", response_model=list[Task])
def discover_tasks(project_id: str):
    return project_service.discover_project_tasks(project_id)


# ===================================================================
# Calendar: milestones in date range
# ===================================================================

@router.get("/milestones/calendar")
def milestone_calendar(
    start: str = Query(..., description="Start date YYYY-MM-DD"),
    end: str = Query(..., description="End date YYYY-MM-DD"),
):
    return project_service.list_calendar_milestones(start, end)
