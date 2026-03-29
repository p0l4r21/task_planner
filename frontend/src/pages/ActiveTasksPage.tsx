import { useState, useMemo, useEffect } from 'react';
import { useTasks } from '../hooks/useTasks';
import type { Task, TaskBucket } from '../types';
import { BUCKET_ORDER } from '../types';
import QuickAddBar from '../components/QuickAddBar';
import BucketColumn from '../components/BucketColumn';
import TaskTable from '../components/TaskTable';
import TaskFilters from '../components/TaskFilters';
import TaskForm from '../components/TaskForm';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type ViewMode = 'kanban' | 'table';

interface Filters {
  search: string;
  priority: string;
  bucket: string;
  project: string;
  sort_by: string;
  sort_dir: string;
}

const EMPTY_FILTERS: Filters = { search: '', priority: '', bucket: '', project: '', sort_by: '', sort_dir: 'asc' };

export default function ActiveTasksPage() {
  const { tasks, create, update, move, complete, remove, refresh } = useTasks();
  const [editing, setEditing] = useState<Task | null>(null);
  const [view, setView] = useState<ViewMode>('kanban');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.search) params.search = filters.search;
    if (filters.priority) params.priority = filters.priority;
    if (filters.bucket) params.bucket = filters.bucket;
    if (filters.project) params.project = filters.project;
    if (filters.sort_by) params.sort_by = filters.sort_by;
    if (filters.sort_dir) params.sort_dir = filters.sort_dir;
    refresh(params);
  }, [filters, refresh]);

  const projects = useMemo(() => {
    const set = new Set(tasks.map(t => t.project).filter(Boolean));
    return Array.from(set).sort();
  }, [tasks]);

  const bucketGroups = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const b of BUCKET_ORDER) groups[b] = [];
    for (const t of tasks) {
      if (groups[t.bucket]) groups[t.bucket].push(t);
    }
    return groups;
  }, [tasks]);

  return (
    <div className="page">
      <div className="page-header">
        <h2>Active Tasks</h2>
        <ToggleGroup type="single" value={view} onValueChange={v => { if (v) setView(v as ViewMode); }} variant="outline" size="sm">
          <ToggleGroupItem value="kanban">Board</ToggleGroupItem>
          <ToggleGroupItem value="table">Table</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <QuickAddBar onSubmit={async (data) => { await create(data); }} />
      <TaskFilters filters={filters} onChange={setFilters} projects={projects} />
      {view === 'kanban' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 pb-4">
          {BUCKET_ORDER.map(b => (
            <BucketColumn
              key={b}
              bucket={b}
              tasks={bucketGroups[b] || []}
              onComplete={complete}
              onMove={move}
              onEdit={setEditing}
              onDelete={remove}
            />
          ))}
        </div>
      ) : (
        <TaskTable
          tasks={tasks}
          onComplete={complete}
          onEdit={setEditing}
          onDelete={remove}
        />
      )}
      {editing && (
        <TaskForm task={editing} onSave={async (id, data) => { await update(id, data); }} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
