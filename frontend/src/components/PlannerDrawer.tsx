import { useEffect, useMemo, useState, type ReactNode } from 'react';
import TaskChecklist, { parseChecklist, serializeChecklist } from './TaskChecklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type {
  ChecklistItem,
  InlineMilestoneCreate,
  Milestone,
  MilestoneCreate,
  MilestoneUpdate,
  Project,
  ProjectCreate,
  ProjectCreateWithMilestones,
  ProjectPriority,
  ProjectStatus,
  Task,
  TaskBucket,
  TaskCreate,
  TaskPriority,
  TaskUpdate,
} from '../types';

export type PlannerDrawerState =
  | {
      type: 'task-create';
      defaults?: {
        bucket?: TaskBucket;
        scheduled_date?: string | null;
        due_date?: string | null;
        project_id?: string | null;
        parent_milestone_id?: string | null;
      };
    }
  | { type: 'task-edit'; task: Task }
  | { type: 'project-create' }
  | { type: 'project-edit'; project: Project }
  | { type: 'milestone-create'; projectId: string; parentMilestoneId?: string | null }
  | { type: 'milestone-edit'; milestone: Milestone };

export interface EditorProps {
  projects: Project[];
  milestonesByProject: Record<string, Milestone[]>;
  onClose: () => void;
  onCreateTask: (data: TaskCreate) => Promise<void>;
  onUpdateTask: (task: Task, data: TaskUpdate) => Promise<void>;
  onCreateProject: (data: ProjectCreate | ProjectCreateWithMilestones, milestones: InlineMilestoneCreate[]) => Promise<void>;
  onUpdateProject: (project: Project, data: ProjectCreate) => Promise<void>;
  onCreateMilestone: (projectId: string, data: MilestoneCreate) => Promise<void>;
  onUpdateMilestone: (milestone: Milestone, data: MilestoneUpdate) => Promise<void>;
}

interface Props extends EditorProps {
  state: PlannerDrawerState | null;
}

export default function PlannerDrawer(props: Props) {
  const { state, onClose } = props;

  if (!state) {
    return (
      <aside className="planner-drawer empty">
        <div className="planner-drawer-empty">
          <span className="planner-drawer-kicker">Planning drawer</span>
          <h3>Select something to plan</h3>
          <p>Choose a task, project, or milestone from the workspace to edit it here.</p>
          <div className="planner-drawer-empty-note">Create actions stay in the header so this panel can remain focused on the item you are shaping.</div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="planner-drawer">
      <div className="planner-drawer-header">
        <div>
          <span className="planner-drawer-kicker">Workspace editor</span>
          <h3>{titleForState(state)}</h3>
          <p className="planner-drawer-subtitle">{descriptionForState(state)}</p>
        </div>
      </div>

      <ScrollArea className="planner-drawer-body">
        {state.type === 'task-create' || state.type === 'task-edit' ? (
          <TaskEditor {...props} state={state} />
        ) : null}

        {state.type === 'project-create' || state.type === 'project-edit' ? (
          <ProjectEditor {...props} state={state} />
        ) : null}

        {state.type === 'milestone-create' || state.type === 'milestone-edit' ? (
          <MilestoneEditor {...props} state={state} />
        ) : null}
      </ScrollArea>
    </aside>
  );
}

export function titleForState(state: PlannerDrawerState): string {
  switch (state.type) {
    case 'task-create':
      return 'Create Task';
    case 'task-edit':
      return 'Edit Task';
    case 'project-create':
      return 'Create Project';
    case 'project-edit':
      return 'Edit Project';
    case 'milestone-create':
      return 'Create Milestone';
    case 'milestone-edit':
      return 'Edit Milestone';
  }
}

export function descriptionForState(state: PlannerDrawerState): string {
  switch (state.type) {
    case 'task-create':
      return 'Capture the work item, place it in a lane, and attach it to the current project structure.';
    case 'task-edit':
      return 'Adjust scope, timing, and hierarchy without losing your place on the board.';
    case 'project-create':
      return 'Define the project frame first, then add only the structure you need to start moving work.';
    case 'project-edit':
      return 'Tighten the project framing, dates, and status from the same workspace.';
    case 'milestone-create':
      return 'Map the milestone into the active project with just enough detail to keep planning moving.';
    case 'milestone-edit':
      return 'Update the milestone details and keep the hierarchy aligned.';
  }
}

function OptionalSection({
  open,
  onToggle,
  summary,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div className="planner-form-section planner-form-section-optional">
      <button type="button" className="planner-form-optional-toggle" onClick={onToggle} aria-expanded={open}>
        <span className="planner-form-optional-copy">
          <strong>Optional details</strong>
          <small>{summary}</small>
        </span>
        <span className="planner-form-optional-icon" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="planner-form-optional-body">{children}</div>}
    </div>
  );
}

export function TaskEditor({
  state,
  projects,
  milestonesByProject,
  onClose,
  onCreateTask,
  onUpdateTask,
}: Pick<EditorProps, 'projects' | 'milestonesByProject' | 'onClose' | 'onCreateTask' | 'onUpdateTask'> & {
  state: Extract<PlannerDrawerState, { type: 'task-create' | 'task-edit' }>;
}) {
  const editingTask = state.type === 'task-edit' ? state.task : null;
  const isCreateMode = state.type === 'task-create';
  const createDefaults = state.type === 'task-create' ? state.defaults ?? {} : {};
  const initialProjectId = editingTask?.project_id || createDefaults.project_id || '';

  const [title, setTitle] = useState(editingTask?.title || '');
  const [description, setDescription] = useState(editingTask?.description || '');
  const [notes, setNotes] = useState(editingTask?.notes || '');
  const [priority, setPriority] = useState<TaskPriority>(editingTask?.priority || 'medium');
  const [bucket, setBucket] = useState<TaskBucket>(editingTask?.bucket || createDefaults.bucket || 'this_week');
  const [dueDate, setDueDate] = useState(editingTask?.due_date?.slice(0, 10) || createDefaults.due_date || '');
  const [scheduledDate, setScheduledDate] = useState(editingTask?.scheduled_date?.slice(0, 10) || createDefaults.scheduled_date || '');
  const [projectId, setProjectId] = useState(initialProjectId);
  const [parentMilestoneId, setParentMilestoneId] = useState(editingTask?.parent_milestone_id || createDefaults.parent_milestone_id || '');
  const [hierarchyLevel, setHierarchyLevel] = useState(String(editingTask?.hierarchy_level ?? 0));
  const [tags, setTags] = useState(editingTask?.tags || '');
  const [blockedReason, setBlockedReason] = useState(editingTask?.blocked_reason || '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(parseChecklist(editingTask?.checklist_items || ''));
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    if (!projectId) {
      setParentMilestoneId('');
      return;
    }
    const milestones = milestonesByProject[projectId] || [];
    if (!milestones.some(milestone => milestone.id === parentMilestoneId)) {
      setParentMilestoneId('');
    }
  }, [projectId, parentMilestoneId, milestonesByProject]);

  const selectedProject = useMemo(
    () => projects.find(project => project.id === projectId) || null,
    [projectId, projects],
  );
  const projectMilestones = projectId ? milestonesByProject[projectId] || [] : [];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const payload: TaskCreate = {
      title,
      description,
      notes,
      priority,
      bucket,
      due_date: dueDate || null,
      scheduled_date: scheduledDate || null,
      project_id: projectId || null,
      project: selectedProject?.name || '',
      parent_milestone_id: parentMilestoneId || null,
      hierarchy_level: Number(hierarchyLevel),
      tags,
      checklist_items: serializeChecklist(checklist),
    };

    if (bucket === 'blocked') {
      payload.blocked_reason = blockedReason;
    }

    try {
      if (editingTask) {
        await onUpdateTask(editingTask, payload as TaskUpdate);
      } else {
        await onCreateTask(payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={`planner-form${isCreateMode ? ' planner-form-create' : ''}`} onSubmit={handleSubmit}>
      <div className="planner-form-body">
        {isCreateMode ? (
          <>
            <div className="planner-form-field">
              <Input
                type="text"
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Title..."
                aria-label="Title"
                required
              />
            </div>
            <div className="planner-form-field">
              <Textarea
                rows={3}
                value={description}
                onChange={event => setDescription(event.target.value)}
                placeholder="Description / brief..."
                aria-label="Description / brief"
              />
            </div>
          </>
        ) : (
          <>
            <label>
              Title
              <Input type="text" value={title} onChange={event => setTitle(event.target.value)} required />
            </label>
            <label>
              Description / brief
              <Textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} />
            </label>
          </>
        )}

        <div className="planner-form-grid two">
          {isCreateMode ? (
            <>
              <div className="planner-form-field">
                <Select value={projectId || 'none'} onValueChange={v => setProjectId(v === 'none' ? '' : v)}>
                  <SelectTrigger aria-label="Project"><SelectValue placeholder="Project" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Project</SelectLabel>
                      <SelectItem value="none">No project</SelectItem>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="planner-form-field">
                <Select value={parentMilestoneId || 'none'} onValueChange={v => setParentMilestoneId(v === 'none' ? '' : v)} disabled={!projectId}>
                  <SelectTrigger aria-label="Parent milestone"><SelectValue placeholder="Parent milestone" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Parent milestone</SelectLabel>
                      <SelectItem value="none">No parent milestone</SelectItem>
                      {projectMilestones.map(milestone => (
                        <SelectItem key={milestone.id} value={milestone.id}>{milestone.title}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="planner-form-field">
                <Select value={bucket} onValueChange={v => setBucket(v as TaskBucket)}>
                  <SelectTrigger aria-label="Status lane"><SelectValue placeholder="Status lane" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Status lane</SelectLabel>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="this_week">This Week</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="incoming">Incoming</SelectItem>
                      <SelectItem value="backlog">Backlog</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="planner-form-field">
                <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
                  <SelectTrigger aria-label="Priority"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Priority</SelectLabel>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="planner-form-field">
                <Input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} aria-label="Due date" />
              </div>
              <div className="planner-form-field">
                <Input type="date" value={scheduledDate} onChange={event => setScheduledDate(event.target.value)} aria-label="Planned date" />
              </div>
            </>
          ) : (
            <>
              <label>
                Project
                <Select value={projectId || 'none'} onValueChange={v => setProjectId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                Parent milestone
                <Select value={parentMilestoneId || 'none'} onValueChange={v => setParentMilestoneId(v === 'none' ? '' : v)} disabled={!projectId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent milestone</SelectItem>
                    {projectMilestones.map(milestone => (
                      <SelectItem key={milestone.id} value={milestone.id}>{milestone.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label>
                Status lane
                <Select value={bucket} onValueChange={v => setBucket(v as TaskBucket)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="incoming">Incoming</SelectItem>
                    <SelectItem value="backlog">Backlog</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                Priority
                <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                Due date
                <Input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
              </label>
              <label>
                Planned date
                <Input type="date" value={scheduledDate} onChange={event => setScheduledDate(event.target.value)} />
              </label>
            </>
          )}
        </div>

        {bucket === 'blocked' && (
          isCreateMode ? (
            <div className="planner-form-field">
              <Input type="text" value={blockedReason} onChange={event => setBlockedReason(event.target.value)} placeholder="Blocked reason..." aria-label="Blocked reason" />
            </div>
          ) : (
            <label>
              Blocked reason
              <Input type="text" value={blockedReason} onChange={event => setBlockedReason(event.target.value)} />
            </label>
          )
        )}

        {editingTask ? (
          <>
            <div className="planner-form-section">
              <div className="planner-section-header">
                <h4>Hierarchy</h4>
                <span>Attach the task to a real project structure.</span>
              </div>
              <div className="planner-form-grid two">
                <label>
                  Hierarchy level
                  <Select value={hierarchyLevel} onValueChange={v => setHierarchyLevel(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Standard task</SelectItem>
                      <SelectItem value="1">Major milestone layer</SelectItem>
                      <SelectItem value="2">Sub-milestone layer</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Tags
                  <Input type="text" value={tags} onChange={event => setTags(event.target.value)} placeholder="comma separated" />
                </label>
              </div>
            </div>

            <label>
              Notes
              <Textarea rows={4} value={notes} onChange={event => setNotes(event.target.value)} />
            </label>

            <div className="planner-form-section">
              <div className="planner-section-header">
                <h4>Checklist</h4>
                <span>Capture next actions immediately.</span>
              </div>
              <TaskChecklist items={checklist} onChange={setChecklist} />
            </div>
          </>
        ) : (
          <OptionalSection
            open={showOptional}
            onToggle={() => setShowOptional(prev => !prev)}
            summary="Hierarchy, tags, notes, and checklist"
          >
            <div className="planner-form-grid two">
              <div className="planner-form-field">
                <Select value={hierarchyLevel} onValueChange={v => setHierarchyLevel(v)}>
                  <SelectTrigger aria-label="Hierarchy level"><SelectValue placeholder="Hierarchy level" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Hierarchy level</SelectLabel>
                      <SelectItem value="0">Standard task</SelectItem>
                      <SelectItem value="1">Major milestone layer</SelectItem>
                      <SelectItem value="2">Sub-milestone layer</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="planner-form-field">
                <Input type="text" value={tags} onChange={event => setTags(event.target.value)} placeholder="Tags..." aria-label="Tags" />
              </div>
            </div>
            <div className="planner-form-field">
              <Textarea rows={4} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Notes..." aria-label="Notes" />
            </div>
            <div className="planner-form-section planner-form-section-subtle">
              <div className="planner-section-header">
                <h4>Checklist</h4>
                <span>Capture next actions immediately.</span>
              </div>
              <TaskChecklist items={checklist} onChange={setChecklist} />
            </div>
          </OptionalSection>
        )}
      </div>

      <div className="planner-form-actions">
        <Button className="planner-form-secondary-action" variant="outline" size="sm" type="button" onClick={onClose}>Cancel</Button>
        <Button className="planner-form-primary-action" variant="default" size="sm" type="submit" disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : editingTask ? 'Save' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

export function MilestoneEditor({
  state,
  projects,
  milestonesByProject,
  onClose,
  onCreateMilestone,
  onUpdateMilestone,
}: Pick<EditorProps, 'projects' | 'milestonesByProject' | 'onClose' | 'onCreateMilestone' | 'onUpdateMilestone'> & {
  state: Extract<PlannerDrawerState, { type: 'milestone-create' | 'milestone-edit' }>;
}) {
  const editingMilestone = state.type === 'milestone-edit' ? state.milestone : null;
  const isCreateMode = state.type === 'milestone-create';
  const initialProjectId = editingMilestone?.project_id || (state.type === 'milestone-create' ? state.projectId : '');

  const [projectId, setProjectId] = useState(initialProjectId);
  const [title, setTitle] = useState(editingMilestone?.title || '');
  const [description, setDescription] = useState(editingMilestone?.description || '');
  const [priority, setPriority] = useState(editingMilestone?.priority || 'medium');
  const [dueDate, setDueDate] = useState(editingMilestone?.due_date?.slice(0, 10) || '');
  const [level, setLevel] = useState(editingMilestone?.is_major ? 'major' : 'sub');
  const [parentMilestoneId, setParentMilestoneId] = useState(
    editingMilestone?.parent_milestone_id || (state.type === 'milestone-create' ? state.parentMilestoneId || '' : ''),
  );
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  const projectMilestones = projectId ? milestonesByProject[projectId] || [] : [];
  const parentOptions = projectMilestones.filter(
    milestone => milestone.is_major && (!editingMilestone || milestone.id !== editingMilestone.id),
  );

  useEffect(() => {
    if (level === 'major') {
      setParentMilestoneId('');
    }
  }, [level]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const payload: MilestoneCreate = {
      title,
      description,
      priority,
      due_date: dueDate || null,
      is_major: level === 'major',
      parent_milestone_id: level === 'major' ? null : parentMilestoneId || null,
    };

    try {
      if (editingMilestone) {
        await onUpdateMilestone(editingMilestone, payload as MilestoneUpdate);
      } else {
        await onCreateMilestone(projectId, payload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={`planner-form${isCreateMode ? ' planner-form-create' : ''}`} onSubmit={handleSubmit}>
      <div className="planner-form-body">
        {state.type === 'milestone-create' && (
          <div className="planner-form-field">
            <Select value={projectId} onValueChange={v => setProjectId(v)} required>
              <SelectTrigger aria-label="Project"><SelectValue placeholder="Project" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Project</SelectLabel>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}

        {isCreateMode ? (
          <div className="planner-form-field">
            <Input type="text" value={title} onChange={event => setTitle(event.target.value)} placeholder="Title..." aria-label="Title" required />
          </div>
        ) : (
          <label>
            Title
            <Input type="text" value={title} onChange={event => setTitle(event.target.value)} required />
          </label>
        )}

        <div className="planner-form-grid two">
          {isCreateMode ? (
            <>
              <div className="planner-form-field">
                <Select value={priority} onValueChange={v => setPriority(v)}>
                  <SelectTrigger aria-label="Priority"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Priority</SelectLabel>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="planner-form-field">
                <Input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} aria-label="Due date" />
              </div>
              <div className="planner-form-field">
                <Select value={level} onValueChange={v => setLevel(v)}>
                  <SelectTrigger aria-label="Hierarchy level"><SelectValue placeholder="Hierarchy level" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Hierarchy level</SelectLabel>
                      <SelectItem value="major">Major milestone</SelectItem>
                      <SelectItem value="sub">Sub-milestone</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="planner-form-field">
                <Select value={parentMilestoneId || 'none'} onValueChange={v => setParentMilestoneId(v === 'none' ? '' : v)} disabled={level === 'major'}>
                  <SelectTrigger aria-label="Parent milestone"><SelectValue placeholder="Parent milestone" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Parent milestone</SelectLabel>
                      <SelectItem value="none">No parent</SelectItem>
                      {parentOptions.map(milestone => (
                        <SelectItem key={milestone.id} value={milestone.id}>{milestone.title}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <label>
                Priority
                <Select value={priority} onValueChange={v => setPriority(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                Due date
                <Input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
              </label>
              <label>
                Hierarchy level
                <Select value={level} onValueChange={v => setLevel(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="major">Major milestone</SelectItem>
                    <SelectItem value="sub">Sub-milestone</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                Parent milestone
                <Select value={parentMilestoneId || 'none'} onValueChange={v => setParentMilestoneId(v === 'none' ? '' : v)} disabled={level === 'major'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent</SelectItem>
                    {parentOptions.map(milestone => (
                      <SelectItem key={milestone.id} value={milestone.id}>{milestone.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </>
          )}
        </div>

        {editingMilestone ? (
          <label>
            Description
            <Textarea rows={4} value={description} onChange={event => setDescription(event.target.value)} />
          </label>
        ) : (
          <OptionalSection
            open={showOptional}
            onToggle={() => setShowOptional(prev => !prev)}
            summary="Description and supporting context"
          >
            <div className="planner-form-field">
              <Textarea rows={4} value={description} onChange={event => setDescription(event.target.value)} placeholder="Description..." aria-label="Description" />
            </div>
          </OptionalSection>
        )}

        {editingMilestone && editingMilestone.status !== 'archived' && (
          <div className="planner-form-danger-zone">
            <Button
              variant="ghost"
              type="button"
              className="text-destructive hover:bg-destructive/10"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onUpdateMilestone(editingMilestone, { status: 'archived' } as MilestoneUpdate);
                  onClose();
                } finally {
                  setSaving(false);
                }
              }}
            >
              Archive milestone
            </Button>
          </div>
        )}
      </div>

      <div className="planner-form-actions">
        <Button className="planner-form-secondary-action" variant="outline" size="sm" type="button" onClick={onClose}>Cancel</Button>
        <Button className="planner-form-primary-action" variant="default" size="sm" type="submit" disabled={saving || !title.trim() || !projectId}>
          {saving ? 'Saving…' : editingMilestone ? 'Save' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

interface MilestoneDraft {
  key: number;
  title: string;
  priority: string;
  due_date: string;
  children: {
    key: number;
    title: string;
    priority: string;
    due_date: string;
  }[];
}

let milestoneDraftKey = 0;

export function ProjectEditor({
  state,
  onClose,
  onCreateProject,
  onUpdateProject,
}: Pick<EditorProps, 'onClose' | 'onCreateProject' | 'onUpdateProject'> & {
  state: Extract<PlannerDrawerState, { type: 'project-create' | 'project-edit' }>;
}) {
  const editingProject = state.type === 'project-edit' ? state.project : null;
  const isCreateMode = state.type === 'project-create';
  const [name, setName] = useState(editingProject?.name || '');
  const [description, setDescription] = useState(editingProject?.description || '');
  const [status, setStatus] = useState<ProjectStatus>(editingProject?.status || 'planning');
  const [priority, setPriority] = useState<ProjectPriority>(editingProject?.priority || 'medium');
  const [startDate, setStartDate] = useState(editingProject?.start_date?.slice(0, 10) || '');
  const [targetEndDate, setTargetEndDate] = useState(editingProject?.target_end_date?.slice(0, 10) || '');
  const [tags, setTags] = useState(editingProject?.tags || '');
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);

  const addMajor = () => {
    milestoneDraftKey += 1;
    setMilestones(prev => [...prev, { key: milestoneDraftKey, title: '', priority: 'medium', due_date: '', children: [] }]);
  };

  const removeMajor = (key: number) => {
    setMilestones(prev => prev.filter(milestone => milestone.key !== key));
  };

  const updateMajor = (key: number, field: keyof Omit<MilestoneDraft, 'key' | 'children'>, value: string) => {
    setMilestones(prev => prev.map(milestone => milestone.key === key ? { ...milestone, [field]: value } : milestone));
  };

  const addChild = (majorKey: number) => {
    milestoneDraftKey += 1;
    setMilestones(prev => prev.map(milestone => milestone.key === majorKey
      ? {
          ...milestone,
          children: [...milestone.children, { key: milestoneDraftKey, title: '', priority: 'medium', due_date: '' }],
        }
      : milestone));
  };

  const updateChild = (majorKey: number, childKey: number, field: 'title' | 'priority' | 'due_date', value: string) => {
    setMilestones(prev => prev.map(milestone => milestone.key === majorKey
      ? {
          ...milestone,
          children: milestone.children.map(child => child.key === childKey ? { ...child, [field]: value } : child),
        }
      : milestone));
  };

  const removeChild = (majorKey: number, childKey: number) => {
    setMilestones(prev => prev.map(milestone => milestone.key === majorKey
      ? { ...milestone, children: milestone.children.filter(child => child.key !== childKey) }
      : milestone));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    const projectPayload: ProjectCreate = {
      name,
      description,
      status,
      priority,
      start_date: startDate || null,
      target_end_date: targetEndDate || null,
      tags,
    };

    const milestonePayload: InlineMilestoneCreate[] = milestones
      .filter(milestone => milestone.title.trim())
      .map(milestone => ({
        title: milestone.title,
        priority: milestone.priority,
        due_date: milestone.due_date || null,
        children: milestone.children
          .filter(child => child.title.trim())
          .map(child => ({
            title: child.title,
            priority: child.priority,
            due_date: child.due_date || null,
          })),
      }));

    try {
      if (editingProject) {
        await onUpdateProject(editingProject, projectPayload);
      } else {
        await onCreateProject({ ...projectPayload, milestones: milestonePayload }, milestonePayload);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={`planner-form${isCreateMode ? ' planner-form-create' : ''}`} onSubmit={handleSubmit}>
      <div className="planner-form-body">
        {isCreateMode ? (
          <>
            <div className="planner-form-field">
              <Input type="text" value={name} onChange={event => setName(event.target.value)} placeholder="Project name..." aria-label="Project name" required />
            </div>
            <div className="planner-form-field">
              <Textarea rows={4} value={description} onChange={event => setDescription(event.target.value)} placeholder="Description..." aria-label="Description" />
            </div>
          </>
        ) : (
          <>
            <label>
              Project name
              <Input type="text" value={name} onChange={event => setName(event.target.value)} required />
            </label>
            <label>
              Description
              <Textarea rows={4} value={description} onChange={event => setDescription(event.target.value)} />
            </label>
          </>
        )}

        <div className="planner-form-grid two">
          {isCreateMode ? (
            <>
              <div className="planner-form-field">
                <Select value={status} onValueChange={v => setStatus(v as ProjectStatus)}>
                  <SelectTrigger aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Status</SelectLabel>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="planner-form-field">
                <Select value={priority} onValueChange={v => setPriority(v as ProjectPriority)}>
                  <SelectTrigger aria-label="Priority"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Priority</SelectLabel>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="planner-form-field">
                <Input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} aria-label="Start date" />
              </div>
              <div className="planner-form-field">
                <Input type="date" value={targetEndDate} onChange={event => setTargetEndDate(event.target.value)} aria-label="Target end date" />
              </div>
            </>
          ) : (
            <>
              <label>
                Status
                <Select value={status} onValueChange={v => setStatus(v as ProjectStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                Priority
                <Select value={priority} onValueChange={v => setPriority(v as ProjectPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label>
                Start date
                <Input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
              </label>
              <label>
                Target end date
                <Input type="date" value={targetEndDate} onChange={event => setTargetEndDate(event.target.value)} />
              </label>
            </>
          )}
        </div>

        {editingProject ? (
          <label>
            Tags
            <Input type="text" value={tags} onChange={event => setTags(event.target.value)} placeholder="comma separated" />
          </label>
        ) : (
          <OptionalSection
            open={showOptional}
            onToggle={() => setShowOptional(prev => !prev)}
            summary="Tags and an initial milestone map"
          >
            <div className="planner-form-field">
              <Input type="text" value={tags} onChange={event => setTags(event.target.value)} placeholder="Tags..." aria-label="Tags" />
            </div>

            <div className="planner-form-section planner-form-section-subtle">
              <div className="planner-section-header">
                <h4>Initial milestone map</h4>
                <Button type="button" variant="secondary" size="sm" onClick={addMajor}>Add milestone</Button>
              </div>
              {milestones.length === 0 && <div className="planner-inline-empty">Add the first milestones now so the project opens with structure.</div>}
              {milestones.map(milestone => (
                <div key={milestone.key} className="planner-inline-milestone major">
                  <div className="planner-inline-row">
                    <span className="planner-inline-badge major">Major</span>
                    <Input
                      type="text"
                      placeholder="Milestone title"
                      value={milestone.title}
                      onChange={event => updateMajor(milestone.key, 'title', event.target.value)}
                    />
                    <Select value={milestone.priority} onValueChange={v => updateMajor(milestone.key, 'priority', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="date" value={milestone.due_date} onChange={event => updateMajor(milestone.key, 'due_date', event.target.value)} />
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => removeMajor(milestone.key)} aria-label="Remove major milestone">✕</Button>
                  </div>

                  <div className="planner-inline-children">
                    {milestone.children.map(child => (
                      <div key={child.key} className="planner-inline-row child">
                        <span className="planner-inline-badge child">Sub</span>
                        <Input
                          type="text"
                          placeholder="Sub-milestone title"
                          value={child.title}
                          onChange={event => updateChild(milestone.key, child.key, 'title', event.target.value)}
                        />
                        <Select value={child.priority} onValueChange={v => updateChild(milestone.key, child.key, 'priority', v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input type="date" value={child.due_date} onChange={event => updateChild(milestone.key, child.key, 'due_date', event.target.value)} />
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => removeChild(milestone.key, child.key)} aria-label="Remove child milestone">✕</Button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => addChild(milestone.key)}>Add sub-milestone</Button>
                  </div>
                </div>
              ))}
            </div>
          </OptionalSection>
        )}
      </div>

      <div className="planner-form-actions">
        <Button className="planner-form-secondary-action" type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button className="planner-form-primary-action" type="submit" variant="default" size="sm" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : editingProject ? 'Save' : 'Create'}
        </Button>
      </div>
    </form>
  );
}