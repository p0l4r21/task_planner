import { useCallback, useEffect, useMemo, useState } from 'react';
import { type PlannerDrawerState } from '../components/PlannerDrawer';
import WeekBar from '../components/WeekBar';
import RightPanel from '../components/RightPanel';
import LaneQuickAdd from '../components/LaneQuickAdd';
import InsightsPanel from '../components/InsightsPanel';
import WorkspaceTabs, { type WorkspaceTab } from '../components/WorkspaceTabs';
import ProjectsView from '../components/ProjectsView';
import InsightsView from '../components/InsightsView';
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
import { Button } from '@/components/ui/button';

type PlannerLane = 'overdue' | 'today' | 'this_week' | 'later';

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

const DROPPABLE_LANES: PlannerLane[] = ['today', 'this_week', 'later'];
const PLANNER_LANES: PlannerLane[] = ['overdue', ...DROPPABLE_LANES];
const LANE_LABELS: Record<PlannerLane, string> = {
  overdue: 'Overdue',
  today: 'Today',
  this_week: 'This Week',
  later: 'Later',
};

export default function DashboardPage() {
  const { tasks, loading, create, update, complete, remove, refresh } = useTasks();
  const { refresh: refreshSummary } = useSummary();
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
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('tasks');

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
  const weekEnd = useMemo(() => addDays(weekStart, 4), [weekStart]); // Friday

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
      const lane = getPlannerLane(task, weekStart, weekEnd);
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
  }, [filteredTasks, weekStart, weekEnd]);

  const heroProjectCopy = selectedProject?.description?.trim() || 'Keep the board aligned with the project tree so delivery work stays attached to real structure.';
  const weekRangeLabel = `${formatDisplayDate(toISODate(weekStart))} – ${formatDisplayDate(toISODate(weekEnd))}`;

  const openCreateTask = (projectId?: string, parentMilestoneId?: string | null, lane?: PlannerLane) => {
    setDrawerState({
      type: 'task-create',
      defaults: {
        bucket: lane ? bucketForLane(lane) : 'this_week',
        scheduled_date: lane ? scheduledDateForLane(lane) : null,
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
    if (!dragTaskId || lane === 'overdue') return;
    const task = tasks.find(candidate => candidate.id === dragTaskId);
    if (!task) return;
    setDragTaskId(null);
    await handleUpdateTask(task, {
      scheduled_date: scheduledDateForLane(lane),
      bucket: bucketForLane(lane),
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
      <WeekBar
        weekRangeLabel={weekRangeLabel}
        weekOffset={weekOffset}
        onChangeWeek={setWeekOffset}
        onCreate={() => openCreateTask(selectedProjectId || undefined)}
        filterSearch={filters.search}
        onFilterChange={patch => setFilters(current => ({
          ...current,
          search: patch.search ?? current.search,
          priority: (patch.priority ?? current.priority) as FilterState['priority'],
          projectId: patch.projectId ?? current.projectId,
        }))}
        workspaceTabs={<WorkspaceTabs value={workspaceTab} onChange={setWorkspaceTab} />}
      />

      {workspaceTab === 'tasks' && <InsightsPanel projects={projects} tasks={tasks} />}

      <div className="planner-body">
        {/* Main content area — tabs switch the view */}
        {workspaceTab === 'tasks' && (
          <section className="planner-board-panel">
            <div className="planner-board">
              {PLANNER_LANES.map(lane => {
                const isDroppable = lane !== 'overdue';
                return (
                  <div
                    key={lane}
                    className={`planner-lane planner-lane-${lane}${lane === 'today' ? ' planner-lane-today' : ''}`}
                    onDragOver={isDroppable ? (event => event.preventDefault()) : undefined}
                    onDrop={isDroppable ? (() => void handleDropToLane(lane)) : undefined}
                  >
                    <div className="planner-lane-header">
                      <span className="planner-lane-title">{LANE_LABELS[lane]}</span>
                      <span className="planner-lane-count">{laneGroups[lane].length}</span>
                    </div>

                    <div className="planner-lane-body">
                      {laneGroups[lane].length === 0 && (
                        <div className="planner-lane-empty">
                          {loading ? 'Loading…' : lane === 'overdue' ? 'No overdue tasks' : 'Drop work here'}
                        </div>
                      )}
                      {laneGroups[lane].map(task => (
                        <article
                          key={task.id}
                          className={`planner-task-card priority-${task.priority}${lane === 'later' ? ` bucket-${task.bucket}` : ''}`}
                          draggable
                          onDragStart={event => {
                            event.dataTransfer.setData('text/plain', task.id);
                            setDragTaskId(task.id);
                          }}
                          onClick={() => setDrawerState({ type: 'task-edit', task })}
                        >
                          <span className="planner-task-title">{task.title}</span>
                          <div className="planner-task-meta">
                            {task.project && <span className="tag tag-project">{task.project}</span>}
                            {task.due_date && <span className="tag tag-due">{task.due_date.slice(0, 10)}</span>}
                            {lane === 'later' && (task.bucket === 'incoming' || task.bucket === 'backlog') && (
                              <span className={`tag tag-bucket-${task.bucket}`}>{task.bucket}</span>
                            )}
                          </div>
                          <div className="planner-task-actions">
                            <Button variant="ghost" size="xs" className="text-green-500 hover:bg-green-500/10" onClick={e => { e.stopPropagation(); void handleCompleteTask(task); }}>Done</Button>
                            <Button variant="ghost" size="xs" className="text-destructive hover:bg-destructive/10" onClick={e => { e.stopPropagation(); void handleDeleteTask(task); }}>Del</Button>
                          </div>
                        </article>
                      ))}
                    </div>

                    <LaneQuickAdd
                      defaultBucket={bucketForLane(lane)}
                      defaultScheduledDate={scheduledDateForLane(lane)}
                      defaultProjectId={selectedProjectId || undefined}
                      onCreateTask={handleCreateTask}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {workspaceTab === 'projects' && (
          <section className="planner-board-panel">
            <ProjectsView
              projects={projectOptions}
              tasks={tasks}
              milestonesByProject={milestonesByProject}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onSetDrawerState={setDrawerState}
            />
          </section>
        )}

        {workspaceTab === 'insights' && (
          <section className="planner-board-panel">
            <InsightsView
              projects={projects}
              tasks={tasks}
              milestonesByProject={milestonesByProject}
            />
          </section>
        )}

        {/* Right panel — workspace + editor */}
        <RightPanel
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
          selectedProject={selectedProject}
          selectedProjectId={selectedProjectId}
          activeProjects={activeProjects}
          tasks={tasks}
          onSelectProject={setSelectedProjectId}
          onOpenCreateTask={openCreateTask}
          onSetDrawerState={setDrawerState}
          projectProgress={selectedProjectProgress}
          projectCompletedMilestones={selectedProjectCompletedMilestones}
          projectTotalMilestones={selectedProjectMilestones.length}
          projectTaskCount={selectedProjectTaskCount}
          projectNextMilestoneDate={selectedProjectNextMilestone ? formatDisplayDate(selectedProjectNextMilestone.due_date) : 'No due date'}
          heroProjectCopy={heroProjectCopy}
        />
      </div>
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

function getPlannerLane(task: Task, weekStart: Date, weekEnd: Date): PlannerLane {
  const effectiveDate = (task.scheduled_date || task.due_date || '').slice(0, 10);
  const today = toISODate(new Date());

  // Tasks with bucket today/in_progress and no future date → today lane
  if (task.bucket === 'today' || task.bucket === 'in_progress') {
    if (!effectiveDate || effectiveDate <= today) return 'today';
  }

  if (!effectiveDate) return 'later';
  if (effectiveDate < today) return 'overdue';
  if (effectiveDate === today) return 'today';
  if (effectiveDate <= toISODate(weekEnd)) return 'this_week';
  return 'later';
}

function bucketForLane(lane: PlannerLane): TaskBucket {
  switch (lane) {
    case 'overdue': return 'today'; // rescue: quick-add in overdue rescues to today
    case 'today': return 'today';
    case 'this_week': return 'this_week';
    case 'later': return 'backlog';
  }
}

function scheduledDateForLane(lane: PlannerLane): string | null {
  switch (lane) {
    case 'overdue': return toISODate(new Date()); // rescue to today
    case 'today': return toISODate(new Date());
    case 'this_week': return null;
    case 'later': return null;
  }
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
