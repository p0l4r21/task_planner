import { useState, useMemo, useEffect } from 'react';
import { useCompletedTasks } from '../hooks/useTasks';
import type { Task } from '../types';
import TaskTable from '../components/TaskTable';
import TaskForm from '../components/TaskForm';
import { api } from '../api';

export default function CompletedTasksPage() {
  const { tasks, restore, refresh } = useCompletedTasks();
  const [search, setSearch] = useState('');
  const [project, setProject] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (project) params.project = project;
    refresh(params);
  }, [search, project, refresh]);

  const projects = useMemo(() => {
    const set = new Set(tasks.map(t => t.project).filter(Boolean));
    return Array.from(set).sort();
  }, [tasks]);

  const handleRestore = async (id: string) => {
    await restore(id);
  };

  return (
    <div className="page">
      <h2>Completed Tasks</h2>
      <div className="task-filters">
        <div className="filter-controls">
          <input
            type="text"
            placeholder="Search completed…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={project} onChange={e => setProject(e.target.value)} title="Filter by project">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <TaskTable
        tasks={tasks}
        onRestore={handleRestore}
        onEdit={setEditing}
        showBucket={false}
        showCompleted
      />
      {editing && (
        <TaskForm task={editing} onSave={async (id, data) => { await api.updateTask(id, data); refresh(); }} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
