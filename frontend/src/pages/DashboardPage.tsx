import { useCallback, useEffect, useMemo, useState } from 'react';
import PlannerDrawer, { type PlannerDrawerState } from '../components/PlannerDrawer';
import PlannerProjectTree from '../components/PlannerProjectTree';
import { api } from '../api';
import { useProjects } from '../hooks/useProjects';
import { useSummary, useTasks } from '../hooks/useTasks';
import type {
  InlineMilestoneCreate,
  Milestone,
  MilestoneCreate,
  MilestoneUpdate,
  Project,
  ProjectCreate,
  ProjectCreateWithMilestones,
  Task,
  TaskBucket,
  TaskCreate,
  TaskPriority,
  TaskUpdate,
} from '../types';

type PlannerLane = 'overdue' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'later';

interface FilterState {
  search: string;
  priority: '' | TaskPriority;
  projectId: string;
}

const EMPTY_FILTERS: FilterState = {
  search: '',
  priority: '',
  projectId: '',
};

const WEEKDAY_LANES: PlannerLane[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const PLANNER_LANES: PlannerLane[] = ['overdue', ...WEEKDAY_LANES, 'later'];
const WEEKDAY_LABELS: Record<PlannerLane, string> = {
  overdue: 'Overdue',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  later: 'Later',
};

export default function DashboardPage() {
  const { tasks, loading, create, update, complete, remove, refresh } = useTasks();
  const { summary, refresh: refreshSummary } = useSummary();
  const {
    projects,
    create: createProject,
    createWithMilestones,
    update: updateProject,
    refresh: refreshProjects,
  } = useProjects();

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [weekOffset, setWeekOffset] = useState(0);
  const [drawerState, setDrawerState] = useState<PlannerDrawerState | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [milestonesByProject, setMilestonesByProject] = useState<Record<string, Milestone[]>>({});

  const activeProjects = useMemo(() => {
    const openProjects = projects.filter(project => project.status !== 'completed');
    const activelyRunning = openProjects.filter(project => project.status === 'active');
    return activelyRunning.length ? activelyRunning : openProjects;
  }, [projects]);

  const projectOptions = useMemo(
    () => projects.filter(project => project.status !== 'completed'),
    [projects],
  );

  const selectedProject = useMemo(
    () => activeProjects.find(project => project.id === selectedProjectId) || activeProjects[0] || null,
    [activeProjects, selectedProjectId],
  );

  const selectedProjectMilestones = useMemo(
    () => selectedProject ? milestonesByProject[selectedProject.id] || [] : [],
    [milestonesByProject, selectedProject],
  );

  const selectedProjectTaskCount = useMemo(
    () => selectedProject ? tasks.filter(task => task.project_id === selectedProject.id).length : tasks.length,
    [selectedProject, tasks],
  );

  const selectedProjectCompletedMilestones = useMemo(
    () => selectedProjectMilestones.filter(milestone => milestone.status === 'completed').length,
    [selectedProjectMilestones],
  );

  const selectedProjectProgress = selectedProjectMilestones.length
    ? Math.round((selectedProjectCompletedMilestones / selectedProjectMilestones.length) * 100)
    : 0;

  const selectedProjectNextMilestone = useMemo(
    () => [...selectedProjectMilestones]
      .filter(milestone => milestone.status !== 'completed' && milestone.due_date)
      .sort((left, right) => (left.due_date || '9999-12-31').localeCompare(right.due_date || '9999-12-31'))[0] || null,
    [selectedProjectMilestones],
  );

  const refreshMilestones = useCallback(async (projectIds?: string[]) => {
    const scopedProjects = projectIds ? projectOptions.filter(project => projectIds.includes(project.id)) : projectOptions;
    if (scopedProjects.length === 0) {
      if (!projectIds) setMilestonesByProject({});
      return;
    }

    const entries = await Promise.all(
      scopedProjects.map(async project => [project.id, await api.listMilestones(project.id)] as const),
    );
    const milestoneMap = Object.fromEntries(entries);
    setMilestonesByProject(prev => projectIds ? { ...prev, ...milestoneMap } : milestoneMap);
  }, [projectOptions]);

  useEffect(() => {
    void refreshMilestones();
  }, [refreshMilestones]);

  useEffect(() => {
    if (!selectedProjectId && activeProjects.length > 0) {
      setSelectedProjectId(activeProjects[0].id);
      return;
    }
    if (selectedProjectId && !activeProjects.some(project => project.id === selectedProjectId)) {
      setSelectedProjectId(activeProjects[0]?.id || null);
    }
  }, [activeProjects, selectedProjectId]);

  const weekStart = useMemo(() => startOfPlannerWeek(new Date(), weekOffset), [weekOffset]);
  const weekDates = useMemo(
    () => WEEKDAY_LANES.map((lane, index) => ({ lane, date: toISODate(addDays(weekStart, index)) })),
    [weekStart],
  );
  const weekDateMap = useMemo(
    () => Object.fromEntries(weekDates.map(entry => [entry.lane, entry.date])) as Record<string, string>,
    [weekDates],
  );

  const filteredTasks = useMemo(() => {
    const searchNeedle = filters.search.trim().toLowerCase();
    return tasks.filter(task => {
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.projectId && task.project_id !== filters.projectId) return false;
      if (!searchNeedle) return true;
      return [task.title, task.description, task.notes, task.project]
        .join(' ')
        .toLowerCase()
        .includes(searchNeedle);
    });
  }, [filters, tasks]);

  const laneGroups = useMemo(() => {
    const groups = Object.fromEntries(PLANNER_LANES.map(lane => [lane, [] as Task[]])) as Record<PlannerLane, Task[]>;
    for (const task of filteredTasks) {
      const lane = getPlannerLane(task, weekStart, weekDateMap);
      groups[lane].push(task);
    }
    for (const lane of PLANNER_LANES) {
      groups[lane].sort((left, right) => {
        const leftDate = (left.scheduled_date || left.due_date || '9999-12-31').slice(0, 10);
        const rightDate = (right.scheduled_date || right.due_date || '9999-12-31').slice(0, 10);
        if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
        return priorityWeight(left.priority) - priorityWeight(right.priority);
      });
    }
    return groups;
  }, [filteredTasks, weekDateMap, weekStart]);

  const overdueCount = laneGroups.overdue.length;
  const plannedThisWeekCount = WEEKDAY_LANES.reduce((count, lane) => count + laneGroups[lane].length, 0);
  const heroProjectCopy = selectedProject?.description?.trim() || 'Keep the board aligned with the project tree so delivery work stays attached to real structure.';
  const weekRangeLabel = `${formatDisplayDate(weekDates[0]?.date)} - ${formatDisplayDate(weekDates[weekDates.length - 1]?.date)}`;
  const isTaskActionActive = drawerState?.type === 'task-create';
  const isMilestoneActionActive = drawerState?.type === 'milestone-create';
  const isProjectActionActive = drawerState?.type === 'project-create';

  const openCreateTask = (projectId?: string, parentMilestoneId?: string | null, lane?: PlannerLane) => {
    setDrawerState({
      type: 'task-create',
      defaults: {
        bucket: lane ? bucketForLane(lane, weekDateMap) : 'this_week',
        scheduled_date: lane ? scheduledDateForLane(lane, weekDateMap) : null,
        due_date: lane === 'overdue' ? toISODate(new Date()) : null,
        project_id: projectId || selectedProjectId || undefined,
        parent_milestone_id: parentMilestoneId || undefined,
      },
    });
  };

  const handleCreateTask = async (data: TaskCreate) => {
    const createdTask = await create(data);
    if (data.parent_milestone_id) {
      await api.linkTask(data.parent_milestone_id, createdTask.id);
      const linkedMilestone = findMilestone(milestonesByProject, data.parent_milestone_id);
      if (linkedMilestone) {
        await refreshMilestones([linkedMilestone.project_id]);
      }
    }
    await Promise.all([refresh(), refreshSummary()]);
  };

  const handleUpdateTask = async (task: Task, data: TaskUpdate) => {
    const previousMilestoneId = task.parent_milestone_id;
    const nextMilestoneId = data.parent_milestone_id ?? task.parent_milestone_id;

    if (previousMilestoneId && previousMilestoneId !== nextMilestoneId) {
      await api.unlinkTask(previousMilestoneId, task.id);
    }

    await update(task.id, data);

    if (nextMilestoneId && nextMilestoneId !== previousMilestoneId) {
      await api.linkTask(nextMilestoneId, task.id);
    }

    await Promise.all([refresh(), refreshSummary()]);
    const affectedProjects = [task.project_id, data.project_id]
      .filter((value): value is string => Boolean(value));
    if (affectedProjects.length > 0) {
      await refreshMilestones(affectedProjects);
    }
  };

  const handleCreateProject = async (data: ProjectCreate | ProjectCreateWithMilestones, milestones: InlineMilestoneCreate[]) => {
    if (milestones.length > 0) {
      const created = await createWithMilestones(data as ProjectCreateWithMilestones);
      setSelectedProjectId(created.project.id);
    } else {
      const created = await createProject(data as ProjectCreate);
      setSelectedProjectId(created.id);
    }
    await refreshProjects();
  };

  const handleUpdateProject = async (project: Project, data: ProjectCreate) => {
    await updateProject(project.id, data);
    await refreshProjects();
  };

  const handleCreateMilestone = async (projectId: string, data: MilestoneCreate) => {
    await api.createMilestone(projectId, data);
    await refreshMilestones([projectId]);
  };

  const handleUpdateMilestone = async (milestone: Milestone, data: MilestoneUpdate) => {
    await api.updateMilestone(milestone.id, data);
    await refreshMilestones([milestone.project_id]);
  };

  const handleDropToLane = async (lane: PlannerLane) => {
    if (!dragTaskId) return;
    const task = tasks.find(candidate => candidate.id === dragTaskId);
    if (!task) return;
    setDragTaskId(null);
    await handleUpdateTask(task, {
      scheduled_date: scheduledDateForLane(lane, weekDateMap),
      due_date: lane === 'overdue' ? toISODate(addDays(new Date(), -1)) : task.due_date,
      bucket: bucketForLane(lane, weekDateMap),
    });
  };

  const handleCompleteTask = async (task: Task) => {
    await complete(task.id);
    await refreshSummary();
    if (task.project_id) await refreshMilestones([task.project_id]);
  };

  const handleDeleteTask = async (task: Task) => {
    await remove(task.id);
    await refreshSummary();
    if (task.project_id) await refreshMilestones([task.project_id]);
  };

  return (
    <div className="planner-page">
      <section className="planner-shell">
        <div className="planner-topbar">
          <div className="planner-week-card">
            <span className="planner-eyebrow">Week window</span>
            <div className="planner-week-window compact">
              <span>Week of {formatDisplayDate(weekDates[0]?.date, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <strong>{weekRangeLabel}</strong>
              <p className="planner-week-note">Use the board as a weekly storyboard. Keep scheduling, creation, and editing in the same band above the board.</p>
            </div>
            <div className="planner-week-actions">
              <div className="planner-action-group planner-action-group-nav">
                <button className="btn btn-ghost" onClick={() => setWeekOffset(offset => offset - 1)}>Previous week</button>
                <button className="btn btn-secondary" onClick={() => setWeekOffset(0)}>Current week</button>
                <button className="btn btn-ghost" onClick={() => setWeekOffset(offset => offset + 1)}>Next week</button>
              </div>
              <div className="planner-action-group planner-action-group-primary">
                <button className={`btn ${isTaskActionActive ? 'btn-primary' : 'btn-secondary'}`} onClick={() => openCreateTask(selectedProjectId || undefined)}>New task</button>
                <button className={`btn ${isMilestoneActionActive ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDrawerState({ type: 'milestone-create', projectId: selectedProjectId || projectOptions[0]?.id || '' })} disabled={!projectOptions.length}>New milestone</button>
                <button className={`btn ${isProjectActionActive ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDrawerState({ type: 'project-create' })}>New project</button>
              </div>
            </div>
          </div>
          <div className="planner-topbar-side">
            <div className="planner-focus-card">
              <span className="planner-eyebrow">Project workspace</span>
              <div className="planner-focus-header">
                <div>
                  <strong>{selectedProject?.name || 'Portfolio overview'}</strong>
                  <p>{heroProjectCopy}</p>
                </div>
                {selectedProject && (
                  <span className={`planner-project-status planner-project-status-${selectedProject.status}`}>
                    {selectedProject.status.replace('_', ' ')}
                  </span>
                )}
              </div>
              <div className="planner-focus-metrics">
                <div className="planner-focus-metric">
                  <span>Milestone map</span>
                  <strong>{selectedProjectCompletedMilestones}/{selectedProjectMilestones.length || 0}</strong>
                </div>
                <div className="planner-focus-metric">
                  <span>Open work</span>
                  <strong>{selectedProjectTaskCount}</strong>
                </div>
                <div className="planner-focus-metric planner-focus-metric-wide">
                  <span>Next target</span>
                  <strong>{selectedProjectNextMilestone ? formatDisplayDate(selectedProjectNextMilestone.due_date) : 'No due date'}</strong>
                </div>
              </div>
              <div className="planner-focus-progress">
                <div className="planner-focus-progress-bar">
                  <div className="planner-focus-progress-fill" style={{ width: `${selectedProjectProgress}%` }} />
                </div>
                <span>{selectedProjectProgress}% mapped</span>
              </div>

              {activeProjects.length > 1 && (
                <div className="planner-project-switcher">
                  <span className="planner-focus-label">Active projects</span>
                  <div className="planner-project-pills">
                    {activeProjects.map(project => (
                      <button
                        key={project.id}
                        type="button"
                        className={`planner-project-pill${selectedProjectId === project.id ? ' active' : ''}`}
                        onClick={() => setSelectedProjectId(project.id)}
                      >
                        {project.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="planner-focus-structure">
                <PlannerProjectTree
                  projects={selectedProject ? [selectedProject] : []}
                  milestonesByProject={milestonesByProject}
                  tasks={tasks}
                  selectedProjectId={selectedProjectId}
                  onSelectProject={setSelectedProjectId}
                  onCreateTask={openCreateTask}
                  onCreateMilestone={(projectId, parentMilestoneId) => setDrawerState({ type: 'milestone-create', projectId, parentMilestoneId })}
                  onEditProject={project => setDrawerState({ type: 'project-edit', project })}
                  onEditMilestone={milestone => setDrawerState({ type: 'milestone-edit', milestone })}
                  variant="embedded"
                />
              </div>
            </div>
          </div>

          <PlannerDrawer
            state={drawerState}
            projects={projectOptions}
            milestonesByProject={milestonesByProject}
            onClose={() => setDrawerState(null)}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            onCreateMilestone={handleCreateMilestone}
            onUpdateMilestone={handleUpdateMilestone}
          />
        </div>

        <div className="planner-toolbar">
          <div className="planner-toolbar-section planner-toolbar-section-stats">
            <div className="planner-stats-row">
              <div className="planner-stat-card">
                <span>Active tasks</span>
                <strong>{summary?.active_count ?? tasks.length}</strong>
              </div>
              <div className="planner-stat-card">
                <span>Planned</span>
                <strong>{plannedThisWeekCount}</strong>
              </div>
              <div className="planner-stat-card alert">
                <span>Overdue</span>
                <strong>{overdueCount}</strong>
              </div>
              <div className="planner-stat-card">
                <span>Active projects</span>
                <strong>{activeProjects.length}</strong>
              </div>
            </div>
          </div>
          <div className="planner-toolbar-section planner-toolbar-section-filters">
            <span className="planner-eyebrow">Filter workspace</span>
            <div className="planner-filter-row">
              <input
                type="search"
                placeholder="Search tasks, notes, projects"
                value={filters.search}
                onChange={event => setFilters(current => ({ ...current, search: event.target.value }))}
              />
              <select value={filters.projectId} onChange={event => setFilters(current => ({ ...current, projectId: event.target.value }))}>
                <option value="">All projects</option>
                {projectOptions.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <select value={filters.priority} onChange={event => setFilters(current => ({ ...current, priority: event.target.value as FilterState['priority'] }))}>
                <option value="">Any priority</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        <div className="planner-layout">
          <section className="planner-board-panel">
            <div className="planner-panel-header">
              <div>
                <span className="planner-eyebrow">Weekly board</span>
                <h3>Execution lanes</h3>
              </div>
              <span className="planner-board-caption">Drag tasks to re-plan the week.</span>
            </div>

            <div className="planner-board">
              {PLANNER_LANES.map(lane => (
                <div
                  key={lane}
                  className={`planner-lane planner-lane-${lane}`}
                  onDragOver={event => event.preventDefault()}
                  onDrop={() => void handleDropToLane(lane)}
                >
                  <div className="planner-lane-header">
                    <div>
                      <span className="planner-lane-title">{WEEKDAY_LABELS[lane]}</span>
                      {weekDateMap[lane] && <span className="planner-lane-date">{weekDateMap[lane]}</span>}
                    </div>
                    <div className="planner-lane-actions">
                      <span className="planner-lane-count">{laneGroups[lane].length}</span>
                      <button className="btn btn-utility" onClick={() => openCreateTask(selectedProjectId || undefined, null, lane)} aria-label={`Add task to ${WEEKDAY_LABELS[lane]}`}>+</button>
                    </div>
                  </div>

                  <div className="planner-lane-body">
                    {laneGroups[lane].length === 0 && (
                      <div className="planner-lane-empty">{loading ? 'Loading tasks…' : 'Drop work here'}</div>
                    )}
                    {laneGroups[lane].map(task => (
                      <article
                        key={task.id}
                        className={`planner-task-card priority-${task.priority}`}
                        draggable
                        onDragStart={event => {
                          event.dataTransfer.setData('text/plain', task.id);
                          setDragTaskId(task.id);
                        }}
                      >
                        <button className="planner-task-main" onClick={() => setDrawerState({ type: 'task-edit', task })}>
                          <div className="planner-task-topline">
                            <span className="planner-task-title">{task.title}</span>
                            <span className="planner-task-priority">{task.priority}</span>
                          </div>
                          <div className="planner-task-meta">
                            {task.project && <span className="tag tag-project">{task.project}</span>}
                            {task.parent_milestone_id && (
                              <span className="tag">Milestone linked</span>
                            )}
                            {task.due_date && <span className="tag tag-due">Due {task.due_date.slice(0, 10)}</span>}
                          </div>
                          {task.description && <p className="planner-task-desc">{task.description}</p>}
                        </button>
                        <div className="planner-task-footer">
                          <button className="btn btn-xs btn-complete" onClick={() => void handleCompleteTask(task)}>Done</button>
                          <button className="btn btn-xs btn-ghost" onClick={() => setDrawerState({ type: 'task-edit', task })}>Edit</button>
                          <button className="btn btn-xs btn-ghost-danger" onClick={() => void handleDeleteTask(task)}>Delete</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function formatDisplayDate(
  value?: string | null,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  if (!value) return 'No date';
  return new Intl.DateTimeFormat('en-US', options).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function getPlannerLane(task: Task, weekStart: Date, weekDateMap: Record<string, string>): PlannerLane {
  const effectiveDate = (task.scheduled_date || task.due_date || '').slice(0, 10);
  if (!effectiveDate) return 'later';

  const today = toISODate(new Date());
  if (effectiveDate < today) return 'overdue';

  for (const lane of WEEKDAY_LANES) {
    if (weekDateMap[lane] === effectiveDate) return lane;
  }

  if (effectiveDate < toISODate(weekStart)) return 'overdue';
  return 'later';
}

function bucketForLane(lane: PlannerLane, weekDateMap: Record<string, string>): TaskBucket {
  if (lane === 'later') return 'backlog';
  if (lane === 'overdue') return 'today';
  const targetDate = weekDateMap[lane];
  if (!targetDate) return 'this_week';
  const today = toISODate(new Date());
  if (targetDate <= today) return 'today';
  return 'this_week';
}

function scheduledDateForLane(lane: PlannerLane, weekDateMap: Record<string, string>): string | null {
  if (lane === 'later') return null;
  if (lane === 'overdue') return toISODate(addDays(new Date(), -1));
  return weekDateMap[lane] || null;
}

function priorityWeight(priority: TaskPriority): number {
  switch (priority) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
  }
}

function startOfPlannerWeek(value: Date, offsetWeeks = 0): Date {
  const result = new Date(value);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff + (offsetWeeks * 7));
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function toISODate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function findMilestone(collection: Record<string, Milestone[]>, milestoneId: string): Milestone | null {
  for (const milestones of Object.values(collection)) {
    const match = milestones.find(milestone => milestone.id === milestoneId);
    if (match) return match;
  }
  return null;
}
