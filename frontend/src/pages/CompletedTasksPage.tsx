import { useState, useMemo, useEffect } from 'react';
import { useCompletedTasks } from '../hooks/useTasks';
import type { Task } from '../types';
import TaskTable from '../components/TaskTable';
import TaskForm from '../components/TaskForm';
import { api } from '../api';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
        <div className="flex gap-2 flex-wrap">
          <Input
            type="text"
            placeholder="Search completed…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Select value={project || 'all'} onValueChange={v => setProject(v === 'all' ? '' : v)}>
            <SelectTrigger title="Filter by project">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
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
