import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useMilestones, useProjectProgress, useProjectTasks } from '../hooks/useProjects';
import type { Project, Milestone, MilestoneCreate, MilestoneUpdate, Task, InlineMilestoneCreate } from '../types';
import { PROJECT_STATUS_LABELS, PRIORITY_LABELS } from '../types';
import MilestoneTree from '../components/MilestoneTree';
import MilestoneFormModal from '../components/MilestoneFormModal';
import LinkMilestoneModal from '../components/LinkMilestoneModal';
import LinkTaskModal from '../components/LinkTaskModal';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);

  const { milestones, refresh: refreshMs, create, update, remove, complete, linkTask, unlinkTask, linkMilestone } = useMilestones(projectId || '');
  const { progress, refresh: refreshProgress } = useProjectProgress(projectId || '');
  const { tasks: projectTasks, refresh: refreshTasks } = useProjectTasks(projectId || '');

  // All active tasks for linking (project-scoped + others)
  const [allActiveTasks, setAllActiveTasks] = useState<Task[]>([]);

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    setProject(await api.getProject(projectId));
  }, [projectId]);

  const loadAllTasks = useCallback(async () => {
    setAllActiveTasks(await api.listActive());
  }, []);

  useEffect(() => { loadProject(); }, [loadProject]);
  useEffect(() => { loadAllTasks(); }, [loadAllTasks]);

  // Modal state
  const [showMsForm, setShowMsForm] = useState(false);
  const [editingMs, setEditingMs] = useState<Milestone | null>(null);
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null);
  const [linkMsFor, setLinkMsFor] = useState<string | null>(null);   // milestone id to link TO
  const [linkTaskFor, setLinkTaskFor] = useState<string | null>(null); // milestone id to link task TO

  const refreshAll = async () => {
    await Promise.all([refreshMs(), refreshProgress(), refreshTasks(), loadAllTasks()]);
  };

  // Milestone form save handler
  const handleMsSave = async (
    data: MilestoneCreate | { id: string; data: MilestoneUpdate },
    children?: InlineMilestoneCreate[],
  ) => {
    if ('id' in data) {
      await update(data.id, data.data);
    } else {
      const createData = { ...data };
      if (parentIdForNew) {
        createData.parent_milestone_id = parentIdForNew;
        createData.is_major = false; // child of another -> minor
      }
      const created = await create(createData);
      // Batch-create sub-milestones if provided
      if (children && children.length > 0 && created) {
        await api.createMilestoneChildren(created.id, children);
      }
    }
    setParentIdForNew(null);
    await refreshAll();
  };

  // Handlers
  const handleEdit = (m: Milestone) => { setEditingMs(m); setShowMsForm(true); };
  const handleDelete = async (id: string) => { await remove(id); await refreshAll(); };
  const handleComplete = async (id: string) => { await complete(id); await refreshAll(); };
  const handleAddChild = (parentId: string) => {
    setParentIdForNew(parentId);
    setEditingMs(null);
    setShowMsForm(true);
  };

  const handleLinkTask = async (milestoneId: string, taskId: string) => {
    await linkTask(milestoneId, taskId);
    await refreshAll();
  };

  const handleUnlinkTask = async (milestoneId: string, taskId: string) => {
    await unlinkTask(milestoneId, taskId);
    await refreshAll();
  };

  const handleLinkMilestone = async (milestoneId: string, targetId: string) => {
    await linkMilestone(milestoneId, targetId);
    await refreshAll();
  };

  if (!project) {
    return <div className="page"><p>Loading project…</p></div>;
  }

  const statusColors: Record<string, string> = {
    planning: '#ca8a04',
    active: '#3b82f6',
    on_hold: '#ef4444',
    completed: '#22c55e',
  };

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link to="/projects">Projects</Link>
        <span className="breadcrumb-sep">›</span>
        <span>{project.name}</span>
      </div>

      {/* Project Header */}
      <div className="project-detail-header">
        <div className="project-detail-info">
          <h2>{project.name}</h2>
          <div className="project-detail-meta">
            <span className="project-status-badge" style={{ color: statusColors[project.status] }}>
              {PROJECT_STATUS_LABELS[project.status]}
            </span>
            <span className={`priority-badge priority-${project.priority}`}>
              {PRIORITY_LABELS[project.priority as keyof typeof PRIORITY_LABELS]}
            </span>
            {project.target_end_date && (
              <span className="tag tag-due">Target: {project.target_end_date.slice(0, 10)}</span>
            )}
          </div>
          {project.description && <p className="project-detail-desc">{project.description}</p>}
        </div>
      </div>

      {/* Progress Bar */}
      {progress && progress.total_major > 0 && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">
              Project Progress — {progress.completed_major}/{progress.total_major} major milestones
            </span>
            <span className="progress-percent">{progress.percent}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Milestone Tree */}
      <div className="ms-section">
        <div className="ms-section-header">
          <h3>Milestones</h3>
          <button className="btn btn-primary btn-sm" onClick={() => {
            setEditingMs(null);
            setParentIdForNew(null);
            setShowMsForm(true);
          }}>
            + New Milestone
          </button>
        </div>

        <MilestoneTree
          milestones={milestones}
          tasks={allActiveTasks}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onComplete={handleComplete}
          onAddChild={handleAddChild}
          onLinkMilestone={(id) => setLinkMsFor(id)}
          onLinkTask={(id) => setLinkTaskFor(id)}
          onUnlinkTask={handleUnlinkTask}
        />
      </div>

      {/* Discovered Tasks (tasks matching project name) */}
      {projectTasks.length > 0 && (
        <div className="ms-section">
          <div className="ms-section-header">
            <h3>Project Tasks ({projectTasks.length})</h3>
          </div>
          <div className="discovered-tasks">
            {projectTasks.map(t => (
              <div key={t.id} className="discovered-task">
                <span className={`priority-badge priority-${t.priority}`}>{t.priority}</span>
                <span className="discovered-task-title">{t.title}</span>
                <span className="tag">{t.bucket.replace('_', ' ')}</span>
                {t.due_date && <span className="tag tag-due">Due: {t.due_date.slice(0, 10)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {showMsForm && (
        <MilestoneFormModal
          milestone={editingMs}
          parentOptions={milestones.filter(m => m.is_major).map(m => ({ id: m.id, title: m.title }))}
          allMilestones={milestones}
          forceMinor={!!parentIdForNew}
          onSave={handleMsSave}
          onClose={() => { setShowMsForm(false); setEditingMs(null); setParentIdForNew(null); }}
        />
      )}

      {linkMsFor && (
        <LinkMilestoneModal
          milestones={milestones}
          currentMilestoneId={linkMsFor}
          onLink={(targetId) => handleLinkMilestone(linkMsFor, targetId)}
          onClose={() => setLinkMsFor(null)}
        />
      )}

      {linkTaskFor && (
        <LinkTaskModal
          tasks={allActiveTasks}
          linkedTaskIds={
            milestones.find(m => m.id === linkTaskFor)?.task_ids?.split(',').filter(Boolean) || []
          }
          onLink={async (taskId) => {
            await handleLinkTask(linkTaskFor, taskId);
          }}
          onClose={() => setLinkTaskFor(null)}
        />
      )}
    </div>
  );
}
