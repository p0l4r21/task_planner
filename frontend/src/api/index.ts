import type {
  Task, TaskCreate, TaskUpdate, DashboardSummary, TaskBucket,
  Project, ProjectCreate, ProjectUpdate, ProjectCreateWithMilestones,
  Milestone, MilestoneCreate, MilestoneUpdate, InlineMilestoneCreate,
  ProjectProgress, CalendarMilestone, ProjectsSummary,
  Idea, IdeaCreate, IdeaUpdate,
  IdeaEntry, IdeaEntryCreate, IdeaEntryUpdate,
} from '../types';

const BASE = '/api/tasks';
const PROJ = '/api/projects';
const MS = '/api/milestones';
const IDEAS = '/api/ideas';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Active tasks
  listActive(params?: Record<string, string>): Promise<Task[]> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Task[]>(`${BASE}${qs}`);
  },

  getTask(id: string): Promise<Task> {
    return request<Task>(`${BASE}/${id}`);
  },

  createTask(data: TaskCreate): Promise<Task> {
    return request<Task>(BASE, { method: 'POST', body: JSON.stringify(data) });
  },

  updateTask(id: string, data: TaskUpdate): Promise<Task> {
    return request<Task>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  moveTask(id: string, bucket: TaskBucket): Promise<Task> {
    return request<Task>(`${BASE}/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ bucket }),
    });
  },

  completeTask(id: string): Promise<Task> {
    return request<Task>(`${BASE}/${id}/complete`, { method: 'PATCH' });
  },

  deleteTask(id: string): Promise<void> {
    return request<void>(`${BASE}/${id}`, { method: 'DELETE' });
  },

  // Completed tasks
  listCompleted(params?: Record<string, string>): Promise<Task[]> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Task[]>(`${BASE}/completed${qs}`);
  },

  restoreTask(id: string): Promise<Task> {
    return request<Task>(`${BASE}/${id}/restore`, { method: 'PATCH' });
  },

  // Dashboard
  getSummary(): Promise<DashboardSummary> {
    return request<DashboardSummary>(`${BASE}/summary`);
  },

  // Calendar
  listCalendarTasks(start: string, end: string): Promise<Task[]> {
    return request<Task[]>(`${BASE}/calendar?start=${start}&end=${end}`);
  },

  // ===================================================================
  // Projects
  // ===================================================================

  listProjects(): Promise<Project[]> {
    return request<Project[]>(PROJ);
  },

  getProject(id: string): Promise<Project> {
    return request<Project>(`${PROJ}/${id}`);
  },

  createProject(data: ProjectCreate): Promise<Project> {
    return request<Project>(PROJ, { method: 'POST', body: JSON.stringify(data) });
  },

  createProjectWithMilestones(data: ProjectCreateWithMilestones): Promise<{ project: Project; milestones: Milestone[] }> {
    return request<{ project: Project; milestones: Milestone[] }>(`${PROJ}/with-milestones`, {
      method: 'POST', body: JSON.stringify(data),
    });
  },

  updateProject(id: string, data: ProjectUpdate): Promise<Project> {
    return request<Project>(`${PROJ}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteProject(id: string): Promise<void> {
    return request<void>(`${PROJ}/${id}`, { method: 'DELETE' });
  },

  // ===================================================================
  // Milestones
  // ===================================================================

  listMilestones(projectId: string): Promise<Milestone[]> {
    return request<Milestone[]>(`${PROJ}/${projectId}/milestones`);
  },

  createMilestone(projectId: string, data: MilestoneCreate): Promise<Milestone> {
    return request<Milestone>(`${PROJ}/${projectId}/milestones`, {
      method: 'POST', body: JSON.stringify(data),
    });
  },

  updateMilestone(id: string, data: MilestoneUpdate): Promise<Milestone> {
    return request<Milestone>(`${MS}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteMilestone(id: string): Promise<void> {
    return request<void>(`${MS}/${id}`, { method: 'DELETE' });
  },

  completeMilestone(id: string): Promise<Milestone> {
    return request<Milestone>(`${MS}/${id}/complete`, { method: 'PATCH' });
  },

  createMilestoneChildren(milestoneId: string, children: InlineMilestoneCreate[]): Promise<Milestone[]> {
    return request<Milestone[]>(`${MS}/${milestoneId}/children`, {
      method: 'POST', body: JSON.stringify({ children }),
    });
  },

  linkTask(milestoneId: string, taskId: string): Promise<Milestone> {
    return request<Milestone>(`${MS}/${milestoneId}/link-task`, {
      method: 'POST', body: JSON.stringify({ task_id: taskId }),
    });
  },

  unlinkTask(milestoneId: string, taskId: string): Promise<Milestone> {
    return request<Milestone>(`${MS}/${milestoneId}/unlink-task`, {
      method: 'POST', body: JSON.stringify({ task_id: taskId }),
    });
  },

  linkMilestone(milestoneId: string, targetId: string): Promise<Milestone> {
    return request<Milestone>(`${MS}/${milestoneId}/link-milestone`, {
      method: 'POST', body: JSON.stringify({ target_milestone_id: targetId }),
    });
  },

  getProjectProgress(projectId: string): Promise<ProjectProgress> {
    return request<ProjectProgress>(`${PROJ}/${projectId}/progress`);
  },

  discoverProjectTasks(projectId: string): Promise<Task[]> {
    return request<Task[]>(`${PROJ}/${projectId}/tasks`);
  },

  // Calendar milestones
  listCalendarMilestones(start: string, end: string): Promise<CalendarMilestone[]> {
    return request<CalendarMilestone[]>(`${MS}/calendar?start=${start}&end=${end}`);
  },

  // Projects dashboard summary
  getProjectsSummary(): Promise<ProjectsSummary> {
    return request<ProjectsSummary>(`${PROJ}/summary`);
  },

  // ===================================================================
  // Ideas
  // ===================================================================

  listIdeas(params?: Record<string, string>): Promise<Idea[]> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<Idea[]>(`${IDEAS}${qs}`);
  },

  getIdea(id: string): Promise<Idea> {
    return request<Idea>(`${IDEAS}/${id}`);
  },

  createIdea(data: IdeaCreate): Promise<Idea> {
    return request<Idea>(IDEAS, { method: 'POST', body: JSON.stringify(data) });
  },

  updateIdea(id: string, data: IdeaUpdate): Promise<Idea> {
    return request<Idea>(`${IDEAS}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteIdea(id: string): Promise<void> {
    return request<void>(`${IDEAS}/${id}`, { method: 'DELETE' });
  },

  convertIdea(id: string, projectId: string): Promise<Idea> {
    return request<Idea>(`${IDEAS}/${id}/convert`, {
      method: 'POST', body: JSON.stringify({ project_id: projectId }),
    });
  },

  listIdeaEntries(ideaId: string): Promise<IdeaEntry[]> {
    return request<IdeaEntry[]>(`${IDEAS}/${ideaId}/entries`);
  },

  createIdeaEntry(ideaId: string, data: IdeaEntryCreate): Promise<IdeaEntry> {
    return request<IdeaEntry>(`${IDEAS}/${ideaId}/entries`, { method: 'POST', body: JSON.stringify(data) });
  },

  updateIdeaEntry(ideaId: string, entryId: string, data: IdeaEntryUpdate): Promise<IdeaEntry> {
    return request<IdeaEntry>(`${IDEAS}/${ideaId}/entries/${entryId}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteIdeaEntry(ideaId: string, entryId: string): Promise<void> {
    return request<void>(`${IDEAS}/${ideaId}/entries/${entryId}`, { method: 'DELETE' });
  },
};
