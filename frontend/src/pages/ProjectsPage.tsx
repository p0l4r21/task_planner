import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import type { Project, ProjectCreate, ProjectStatus, ProjectPriority, InlineMilestoneCreate, ProjectCreateWithMilestones } from '../types';
import { PROJECT_STATUS_LABELS, PRIORITY_LABELS } from '../types';

export default function ProjectsPage() {
  const { projects, create, createWithMilestones, update, remove } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Projects</h2>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          + New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="ms-tree-empty">No projects yet. Create your first project to get started.</div>
      ) : (
        <div className="project-grid">
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={() => { setEditing(p); setShowForm(true); }}
              onDelete={() => remove(p.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ProjectFormModal
          project={editing}
          onSave={async (data, milestones) => {
            if (editing) {
              await update(editing.id, data);
            } else if (milestones && milestones.length > 0) {
              await createWithMilestones({ ...data, milestones } as ProjectCreateWithMilestones);
            } else {
              await create(data as ProjectCreate);
            }
          }}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Card
// ---------------------------------------------------------------------------

function ProjectCard({ project, onEdit, onDelete }: { project: Project; onEdit: () => void; onDelete: () => void }) {
  const statusColors: Record<ProjectStatus, string> = {
    planning: '#ca8a04',
    active: '#3b82f6',
    on_hold: '#ef4444',
    completed: '#22c55e',
  };

  return (
    <div className="project-card">
      <div className="project-card-header">
        <Link to={`/projects/${project.id}`} className="project-card-title">
          {project.name}
        </Link>
        <span className="project-status-badge" style={{ color: statusColors[project.status] }}>
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
      </div>
      {project.description && (
        <div className="project-card-desc">{project.description}</div>
      )}
      <div className="project-card-meta">
        <span className={`priority-badge priority-${project.priority}`}>
          {PRIORITY_LABELS[project.priority as keyof typeof PRIORITY_LABELS]}
        </span>
        {project.target_end_date && (
          <span className="tag tag-due">Target: {project.target_end_date.slice(0, 10)}</span>
        )}
        {project.tags && project.tags.split(',').map(t => (
          <span key={t.trim()} className="tag">{t.trim()}</span>
        ))}
      </div>
      <div className="project-card-actions">
        <Link to={`/projects/${project.id}`} className="btn btn-sm btn-primary">Open</Link>
        <button className="btn btn-sm" onClick={onEdit}>Edit</button>
        <button className="btn btn-sm btn-danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project Form Modal (with inline milestone builder for new projects)
// ---------------------------------------------------------------------------

interface MilestoneRow {
  key: number;
  title: string;
  priority: string;
  due_date: string;
  children: SubMilestoneRow[];
}

interface SubMilestoneRow {
  key: number;
  title: string;
  priority: string;
  due_date: string;
}

let _rowKey = 0;
function nextKey() { return ++_rowKey; }

function ProjectFormModal({ project, onSave, onClose }: {
  project: Project | null;
  onSave: (data: any, milestones?: InlineMilestoneCreate[]) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!project;
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status || 'planning');
  const [priority, setPriority] = useState<ProjectPriority>(project?.priority || 'medium');
  const [startDate, setStartDate] = useState(project?.start_date?.slice(0, 10) || '');
  const [targetEnd, setTargetEnd] = useState(project?.target_end_date?.slice(0, 10) || '');
  const [tags, setTags] = useState(project?.tags || '');
  const [saving, setSaving] = useState(false);

  // Milestone builder state (only for new projects)
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);

  const addMajor = () => {
    setMilestones(prev => [...prev, { key: nextKey(), title: '', priority: 'medium', due_date: '', children: [] }]);
  };

  const removeMajor = (key: number) => {
    setMilestones(prev => prev.filter(m => m.key !== key));
  };

  const updateMajor = (key: number, field: string, value: string) => {
    setMilestones(prev => prev.map(m => m.key === key ? { ...m, [field]: value } : m));
  };

  const addSub = (majorKey: number) => {
    setMilestones(prev => prev.map(m => m.key === majorKey
      ? { ...m, children: [...m.children, { key: nextKey(), title: '', priority: 'medium', due_date: '' }] }
      : m
    ));
  };

  const removeSub = (majorKey: number, subKey: number) => {
    setMilestones(prev => prev.map(m => m.key === majorKey
      ? { ...m, children: m.children.filter(c => c.key !== subKey) }
      : m
    ));
  };

  const updateSub = (majorKey: number, subKey: number, field: string, value: string) => {
    setMilestones(prev => prev.map(m => m.key === majorKey
      ? { ...m, children: m.children.map(c => c.key === subKey ? { ...c, [field]: value } : c) }
      : m
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const projectData = {
        name, description, status, priority,
        start_date: startDate || null,
        target_end_date: targetEnd || null,
        tags,
      };

      // Build InlineMilestoneCreate[] from builder rows
      const inlineMilestones: InlineMilestoneCreate[] = milestones
        .filter(m => m.title.trim())
        .map(m => ({
          title: m.title,
          priority: m.priority,
          due_date: m.due_date || null,
          children: m.children.filter(c => c.title.trim()).map(c => ({
            title: c.title,
            priority: c.priority,
            due_date: c.due_date || null,
          })),
        }));

      await onSave(projectData, isEdit ? undefined : inlineMilestones);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Project' : 'New Project'}</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="task-form">
          <label>
            Name
            <input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </label>
          <div className="form-row">
            <label>
              Status
              <select value={status} onChange={e => setStatus(e.target.value as ProjectStatus)}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label>
              Priority
              <select value={priority} onChange={e => setPriority(e.target.value as ProjectPriority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Start Date
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </label>
            <label>
              Target End Date
              <input type="date" value={targetEnd} onChange={e => setTargetEnd(e.target.value)} />
            </label>
          </div>
          <label>
            Tags
            <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="comma separated" />
          </label>

          {/* Milestone Builder (new projects only) */}
          {!isEdit && (
            <div className="milestone-builder">
              <div className="milestone-builder-header">
                <h4>Milestones</h4>
                <button type="button" className="btn btn-sm btn-primary" onClick={addMajor}>+ Major Milestone</button>
              </div>
              {milestones.length === 0 && (
                <div className="milestone-builder-empty">No milestones yet. You can add them now or later.</div>
              )}
              {milestones.map(m => (
                <div key={m.key} className="mb-major">
                  <div className="mb-major-header">
                    <span className="mb-type-badge major">Major</span>
                    <input
                      type="text"
                      placeholder="Milestone title"
                      value={m.title}
                      onChange={e => updateMajor(m.key, 'title', e.target.value)}
                      className="mb-title-input"
                    />
                    <select value={m.priority} onChange={e => updateMajor(m.key, 'priority', e.target.value)} className="mb-select" title="Priority">
                      <option value="low">Low</option>
                      <option value="medium">Med</option>
                      <option value="high">High</option>
                      <option value="critical">Crit</option>
                    </select>
                    <input
                      type="date"
                      value={m.due_date}
                      onChange={e => updateMajor(m.key, 'due_date', e.target.value)}
                      className="mb-date-input"
                      title="Due date"
                    />
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeMajor(m.key)}>✕</button>
                  </div>
                  <div className="mb-children">
                    {m.children.map(c => (
                      <div key={c.key} className="mb-child-row">
                        <span className="mb-type-badge minor">Minor</span>
                        <input
                          type="text"
                          placeholder="Sub-milestone title"
                          value={c.title}
                          onChange={e => updateSub(m.key, c.key, 'title', e.target.value)}
                          className="mb-title-input"
                        />
                        <select value={c.priority} onChange={e => updateSub(m.key, c.key, 'priority', e.target.value)} className="mb-select" title="Priority">
                          <option value="low">Low</option>
                          <option value="medium">Med</option>
                          <option value="high">High</option>
                          <option value="critical">Crit</option>
                        </select>
                        <input
                          type="date"
                          value={c.due_date}
                          onChange={e => updateSub(m.key, c.key, 'due_date', e.target.value)}
                          className="mb-date-input"
                          title="Due date"
                        />
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => removeSub(m.key, c.key)}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-sm mb-add-child" onClick={() => addSub(m.key)}>
                      + Sub-milestone
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
