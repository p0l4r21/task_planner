import { useEffect, useMemo, useState } from 'react';
import TaskChecklist, { parseChecklist, serializeChecklist } from './TaskChecklist';
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

interface Props {
  state: PlannerDrawerState | null;
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

      <div className="planner-drawer-body">
        {state.type === 'task-create' || state.type === 'task-edit' ? (
          <TaskEditor {...props} state={state} />
        ) : null}

        {state.type === 'project-create' || state.type === 'project-edit' ? (
          <ProjectEditor {...props} state={state} />
        ) : null}

        {state.type === 'milestone-create' || state.type === 'milestone-edit' ? (
          <MilestoneEditor {...props} state={state} />
        ) : null}
      </div>
    </aside>
  );
}

function titleForState(state: PlannerDrawerState): string {
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

function descriptionForState(state: PlannerDrawerState): string {
  switch (state.type) {
    case 'task-create':
      return 'Capture the details now so the task does not need a second editing pass.';
    case 'task-edit':
      return 'Adjust scope, timing, and hierarchy without losing your place on the board.';
    case 'project-create':
      return 'Set the project basics and scaffold the first milestone structure.';
    case 'project-edit':
      return 'Tighten the project framing, dates, and status from the same workspace.';
    case 'milestone-create':
      return 'Define the milestone cleanly so it fits the current project structure.';
    case 'milestone-edit':
      return 'Update the milestone details and keep the hierarchy aligned.';
  }
}

function TaskEditor({
  state,
  projects,
  milestonesByProject,
  onClose,
  onCreateTask,
  onUpdateTask,
}: Pick<Props, 'projects' | 'milestonesByProject' | 'onClose' | 'onCreateTask' | 'onUpdateTask'> & {
  state: Extract<PlannerDrawerState, { type: 'task-create' | 'task-edit' }>;
}) {
  const editingTask = state.type === 'task-edit' ? state.task : null;
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
    <form className="planner-form" onSubmit={handleSubmit}>
      <div className="planner-form-actions top">
        <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
          {saving ? 'Saving…' : editingTask ? 'Save task' : 'Create task'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>

      <div className="planner-form-section">
        <label>
          Title
          <input type="text" value={title} onChange={event => setTitle(event.target.value)} required />
        </label>
        <label>
          Description / brief
          <textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} />
        </label>
      </div>

      <div className="planner-form-grid two">
        <label>
          Status lane
          <select value={bucket} onChange={event => setBucket(event.target.value as TaskBucket)}>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="incoming">Incoming</option>
            <option value="backlog">Backlog</option>
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={event => setPriority(event.target.value as TaskPriority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label>
          Due date
          <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
        </label>
        <label>
          Planned date
          <input type="date" value={scheduledDate} onChange={event => setScheduledDate(event.target.value)} />
        </label>
      </div>

      <div className="planner-form-section">
        <div className="planner-section-header">
          <h4>Hierarchy</h4>
          <span>Attach the task to a real project structure.</span>
        </div>
        <div className="planner-form-grid two">
          <label>
            Project
            <select value={projectId} onChange={event => setProjectId(event.target.value)}>
              <option value="">No project</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            Parent milestone
            <select value={parentMilestoneId} onChange={event => setParentMilestoneId(event.target.value)} disabled={!projectId}>
              <option value="">No parent milestone</option>
              {projectMilestones.map(milestone => (
                <option key={milestone.id} value={milestone.id}>{milestone.title}</option>
              ))}
            </select>
          </label>
          <label>
            Hierarchy level
            <select value={hierarchyLevel} onChange={event => setHierarchyLevel(event.target.value)}>
              <option value="0">Standard task</option>
              <option value="1">Major milestone layer</option>
              <option value="2">Sub-milestone layer</option>
              <option value="3">Sub-sub-milestone layer</option>
            </select>
          </label>
          <label>
            Tags
            <input type="text" value={tags} onChange={event => setTags(event.target.value)} placeholder="comma separated" />
          </label>
        </div>
      </div>

      {bucket === 'blocked' && (
        <label>
          Blocked reason
          <input type="text" value={blockedReason} onChange={event => setBlockedReason(event.target.value)} />
        </label>
      )}

      <label>
        Notes
        <textarea rows={4} value={notes} onChange={event => setNotes(event.target.value)} />
      </label>

      <div className="planner-form-section">
        <div className="planner-section-header">
          <h4>Checklist</h4>
          <span>Capture next actions immediately.</span>
        </div>
        <TaskChecklist items={checklist} onChange={setChecklist} />
      </div>

    </form>
  );
}

function MilestoneEditor({
  state,
  projects,
  milestonesByProject,
  onClose,
  onCreateMilestone,
  onUpdateMilestone,
}: Pick<Props, 'projects' | 'milestonesByProject' | 'onClose' | 'onCreateMilestone' | 'onUpdateMilestone'> & {
  state: Extract<PlannerDrawerState, { type: 'milestone-create' | 'milestone-edit' }>;
}) {
  const editingMilestone = state.type === 'milestone-edit' ? state.milestone : null;
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

  const projectMilestones = projectId ? milestonesByProject[projectId] || [] : [];
  const parentOptions = projectMilestones.filter(milestone => !editingMilestone || milestone.id !== editingMilestone.id);

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
    <form className="planner-form" onSubmit={handleSubmit}>
      <div className="planner-form-actions top">
        <button type="submit" className="btn btn-primary" disabled={saving || !title.trim() || !projectId}>
          {saving ? 'Saving…' : editingMilestone ? 'Save milestone' : 'Create milestone'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>

      {state.type === 'milestone-create' && (
        <label>
          Project
          <select value={projectId} onChange={event => setProjectId(event.target.value)} required>
            {projects.map(project => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
      )}

      <label>
        Title
        <input type="text" value={title} onChange={event => setTitle(event.target.value)} required />
      </label>
      <label>
        Description
        <textarea rows={4} value={description} onChange={event => setDescription(event.target.value)} />
      </label>

      <div className="planner-form-grid two">
        <label>
          Priority
          <select value={priority} onChange={event => setPriority(event.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label>
          Due date
          <input type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} />
        </label>
        <label>
          Hierarchy level
          <select value={level} onChange={event => setLevel(event.target.value)}>
            <option value="major">Major milestone</option>
            <option value="sub">Sub-milestone</option>
          </select>
        </label>
        <label>
          Parent milestone
          <select value={parentMilestoneId} onChange={event => setParentMilestoneId(event.target.value)} disabled={level === 'major'}>
            <option value="">No parent</option>
            {parentOptions.map(milestone => (
              <option key={milestone.id} value={milestone.id}>{milestone.title}</option>
            ))}
          </select>
        </label>
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

function ProjectEditor({
  state,
  onClose,
  onCreateProject,
  onUpdateProject,
}: Pick<Props, 'onClose' | 'onCreateProject' | 'onUpdateProject'> & {
  state: Extract<PlannerDrawerState, { type: 'project-create' | 'project-edit' }>;
}) {
  const editingProject = state.type === 'project-edit' ? state.project : null;
  const [name, setName] = useState(editingProject?.name || '');
  const [description, setDescription] = useState(editingProject?.description || '');
  const [status, setStatus] = useState<ProjectStatus>(editingProject?.status || 'planning');
  const [priority, setPriority] = useState<ProjectPriority>(editingProject?.priority || 'medium');
  const [startDate, setStartDate] = useState(editingProject?.start_date?.slice(0, 10) || '');
  const [targetEndDate, setTargetEndDate] = useState(editingProject?.target_end_date?.slice(0, 10) || '');
  const [tags, setTags] = useState(editingProject?.tags || '');
  const [saving, setSaving] = useState(false);
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
    <form className="planner-form" onSubmit={handleSubmit}>
      <div className="planner-form-actions top">
        <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
          {saving ? 'Saving…' : editingProject ? 'Save project' : 'Create project'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>

      <label>
        Project name
        <input type="text" value={name} onChange={event => setName(event.target.value)} required />
      </label>
      <label>
        Description
        <textarea rows={4} value={description} onChange={event => setDescription(event.target.value)} />
      </label>

      <div className="planner-form-grid two">
        <label>
          Status
          <select value={status} onChange={event => setStatus(event.target.value as ProjectStatus)}>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label>
          Priority
          <select value={priority} onChange={event => setPriority(event.target.value as ProjectPriority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label>
          Start date
          <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
        </label>
        <label>
          Target end date
          <input type="date" value={targetEndDate} onChange={event => setTargetEndDate(event.target.value)} />
        </label>
      </div>

      <label>
        Tags
        <input type="text" value={tags} onChange={event => setTags(event.target.value)} placeholder="comma separated" />
      </label>

      {!editingProject && (
        <div className="planner-form-section">
          <div className="planner-section-header">
            <h4>Initial milestone map</h4>
            <button type="button" className="btn btn-sm btn-secondary" onClick={addMajor}>Add milestone</button>
          </div>
          {milestones.length === 0 && <div className="planner-inline-empty">Add the first milestones now so the project opens with structure.</div>}
          {milestones.map(milestone => (
            <div key={milestone.key} className="planner-inline-milestone major">
              <div className="planner-inline-row">
                <span className="planner-inline-badge major">Major</span>
                <input
                  type="text"
                  placeholder="Milestone title"
                  value={milestone.title}
                  onChange={event => updateMajor(milestone.key, 'title', event.target.value)}
                />
                <select value={milestone.priority} onChange={event => updateMajor(milestone.key, 'priority', event.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <input type="date" value={milestone.due_date} onChange={event => updateMajor(milestone.key, 'due_date', event.target.value)} />
                <button type="button" className="btn btn-utility btn-ghost-danger" onClick={() => removeMajor(milestone.key)} aria-label="Remove major milestone">✕</button>
              </div>

              <div className="planner-inline-children">
                {milestone.children.map(child => (
                  <div key={child.key} className="planner-inline-row child">
                    <span className="planner-inline-badge child">Sub</span>
                    <input
                      type="text"
                      placeholder="Sub-milestone title"
                      value={child.title}
                      onChange={event => updateChild(milestone.key, child.key, 'title', event.target.value)}
                    />
                    <select value={child.priority} onChange={event => updateChild(milestone.key, child.key, 'priority', event.target.value)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <input type="date" value={child.due_date} onChange={event => updateChild(milestone.key, child.key, 'due_date', event.target.value)} />
                    <button type="button" className="btn btn-utility btn-ghost-danger" onClick={() => removeChild(milestone.key, child.key)} aria-label="Remove child milestone">✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => addChild(milestone.key)}>Add sub-milestone</button>
              </div>
            </div>
          ))}
        </div>
      )}

    </form>
  );
}