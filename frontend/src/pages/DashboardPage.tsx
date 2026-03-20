import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTasks, useSummary } from '../hooks/useTasks';
import type { Task, TaskBucket, TaskCreate, ProjectsSummary } from '../types';
import { BUCKET_ORDER } from '../types';
import DashboardCards from '../components/DashboardCards';
import QuickAddBar from '../components/QuickAddBar';
import BucketColumn from '../components/BucketColumn';
import TaskForm from '../components/TaskForm';
import { api } from '../api';

export default function DashboardPage() {
  const { tasks, create, update, move, complete, remove, refresh } = useTasks();
  const { summary, refresh: refreshSummary } = useSummary();
  const [editing, setEditing] = useState<Task | null>(null);
  const [projSummary, setProjSummary] = useState<ProjectsSummary | null>(null);

  const fetchProjects = useCallback(async () => {
    setProjSummary(await api.getProjectsSummary());
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const bucketGroups = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const b of BUCKET_ORDER) groups[b] = [];
    for (const t of tasks) {
      if (groups[t.bucket]) groups[t.bucket].push(t);
    }
    return groups;
  }, [tasks]);

  const handleCreate = async (data: TaskCreate) => {
    await create(data);
    refreshSummary();
  };

  const handleComplete = async (id: string) => {
    await complete(id);
    refreshSummary();
  };

  const handleMove = async (id: string, bucket: TaskBucket) => {
    await move(id, bucket);
    refreshSummary();
  };

  const handleSave = async (id: string, data: any) => {
    await update(id, data);
    refreshSummary();
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    refreshSummary();
  };

  return (
    <div className="page">
      <h2>Dashboard</h2>
      <DashboardCards summary={summary} />

      {/* ── Project Overview ── */}
      {projSummary && (projSummary.active_projects > 0 || projSummary.upcoming_milestones.length > 0) && (
        <div className="dash-projects-section">
          <div className="dash-proj-header">
            <h3>Projects</h3>
            <Link to="/projects" className="btn btn-sm">View All →</Link>
          </div>
          <div className="dash-proj-cards">
            {projSummary.projects.map(p => {
              const pct = p.total_milestones > 0
                ? Math.round((p.completed_milestones / p.total_milestones) * 100)
                : 0;
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="dash-proj-card">
                  <div className="dash-proj-card-top">
                    <span className="dash-proj-name">{p.name}</span>
                    <span className={`dash-proj-status dash-proj-status-${p.status}`}>{p.status}</span>
                  </div>
                  <div className="dash-proj-bar-wrap">
                    <div className="dash-proj-bar" data-pct={`${pct}%`}>
                      <div className="dash-proj-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="dash-proj-meta">
                    <span>{p.completed_milestones}/{p.total_milestones} milestones</span>
                    <span>{p.active_tasks} tasks</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {projSummary.upcoming_milestones.length > 0 && (
            <div className="dash-upcoming">
              <h4>Upcoming Milestones</h4>
              <ul className="dash-upcoming-list">
                {projSummary.upcoming_milestones.slice(0, 8).map(m => (
                  <li key={m.id} className={`dash-upcoming-item${m.is_overdue ? ' dash-overdue' : ''}`}>
                    <span className="dash-ms-icon">{m.is_major ? '◆' : '◇'}</span>
                    <span className="dash-ms-title">{m.title}</span>
                    <span className="dash-ms-proj">{m.project_name}</span>
                    <span className="dash-ms-date">{m.is_overdue ? 'OVERDUE' : m.due_date}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <QuickAddBar onSubmit={handleCreate} />
      <div className="kanban">
        {BUCKET_ORDER.map(b => (
          <BucketColumn
            key={b}
            bucket={b}
            tasks={bucketGroups[b] || []}
            onComplete={handleComplete}
            onMove={handleMove}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        ))}
      </div>
      {editing && (
        <TaskForm task={editing} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
