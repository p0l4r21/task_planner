import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import type { Project, ProjectCreate, ProjectStatus, ProjectPriority, InlineMilestoneCreate, ProjectCreateWithMilestones } from '../types';
import { PROJECT_STATUS_LABELS, PRIORITY_LABELS } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardAction, CardContent, CardFooter } from '@/components/ui/card';

export default function ProjectsPage() {
  const { projects, create, createWithMilestones, update, remove } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Projects</h2>
        <Button variant="default" onClick={() => { setEditing(null); setShowForm(true); }}>
          + New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="ms-tree-empty">No projects yet. Create your first project to get started.</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3 mt-4">
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
    <Card className="hover:ring-foreground/20 transition-[box-shadow]">
      <CardHeader>
        <CardTitle>
          <Link to={`/projects/${project.id}`} className="text-foreground no-underline hover:text-foreground">
            {project.name}
          </Link>
        </CardTitle>
        <CardAction>
          <span className="project-status-badge" style={{ color: statusColors[project.status] }}>
            {PROJECT_STATUS_LABELS[project.status]}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
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
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="default" size="sm" asChild>
          <Link to={`/projects/${project.id}`}>Open</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
      </CardFooter>
    </Card>
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
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Project' : 'New Project'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="task-form">
          <label>
            Name
            <Input type="text" value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label>
            Description
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </label>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              Start Date
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </label>
            <label>
              Target End Date
              <Input type="date" value={targetEnd} onChange={e => setTargetEnd(e.target.value)} />
            </label>
          </div>
          <label>
            Tags
            <Input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="comma separated" />
          </label>

          {/* Milestone Builder (new projects only) */}
          {!isEdit && (
            <div className="milestone-builder">
              <div className="milestone-builder-header">
                <h4>Milestones</h4>
                <Button type="button" variant="default" size="sm" onClick={addMajor}>+ Major Milestone</Button>
              </div>
              {milestones.length === 0 && (
                <div className="milestone-builder-empty">No milestones yet. You can add them now or later.</div>
              )}
              {milestones.map(m => (
                <div key={m.key} className="mb-major">
                  <div className="mb-major-header">
                    <span className="mb-type-badge major">Major</span>
                    <Input
                      type="text"
                      placeholder="Milestone title"
                      value={m.title}
                      onChange={e => updateMajor(m.key, 'title', e.target.value)}
                      className="mb-title-input"
                    />
                    <Select value={m.priority} onValueChange={v => updateMajor(m.key, 'priority', v)}>
                      <SelectTrigger className="mb-select" title="Priority"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Med</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Crit</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="date"
                      value={m.due_date}
                      onChange={e => updateMajor(m.key, 'due_date', e.target.value)}
                      className="mb-date-input"
                      title="Due date"
                    />
                    <Button type="button" variant="destructive" size="sm" onClick={() => removeMajor(m.key)}>✕</Button>
                  </div>
                  <div className="mb-children">
                    {m.children.map(c => (
                      <div key={c.key} className="mb-child-row">
                        <span className="mb-type-badge minor">Minor</span>
                        <Input
                          type="text"
                          placeholder="Sub-milestone title"
                          value={c.title}
                          onChange={e => updateSub(m.key, c.key, 'title', e.target.value)}
                          className="mb-title-input"
                        />
                        <Select value={c.priority} onValueChange={v => updateSub(m.key, c.key, 'priority', v)}>
                          <SelectTrigger className="mb-select" title="Priority"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Med</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Crit</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="date"
                          value={c.due_date}
                          onChange={e => updateSub(m.key, c.key, 'due_date', e.target.value)}
                          className="mb-date-input"
                          title="Due date"
                        />
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeSub(m.key, c.key)}>✕</Button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => addSub(m.key)}>
                      + Sub-milestone
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="default" disabled={saving || !name.trim()}>
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
