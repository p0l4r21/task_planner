import { useState } from 'react';
import type { TaskPriority, TaskBucket } from '../types';

interface Filters {
  search: string;
  priority: string;
  bucket: string;
  project: string;
  sort_by: string;
  sort_dir: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  projects: string[];
}

export default function TaskFilters({ filters, onChange, projects }: Props) {
  const [search, setSearch] = useState(filters.search);

  const set = (key: keyof Filters, val: string) => {
    onChange({ ...filters, [key]: val });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    set('search', search);
  };

  return (
    <div className="task-filters">
      <form onSubmit={handleSearch} className="filter-search">
        <input
          type="text"
          placeholder="Search tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button type="submit" className="btn btn-sm">Search</button>
        {filters.search && (
          <button type="button" className="btn btn-sm" onClick={() => { setSearch(''); set('search', ''); }}>
            Clear
          </button>
        )}
      </form>
      <div className="filter-controls">
        <select value={filters.priority} onChange={e => set('priority', e.target.value)} title="Filter by priority">
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={filters.bucket} onChange={e => set('bucket', e.target.value)} title="Filter by bucket">
          <option value="">All Buckets</option>
          <option value="today">Today</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="this_week">This Week</option>
          <option value="incoming">Incoming</option>
          <option value="backlog">Backlog</option>
        </select>
        <select value={filters.project} onChange={e => set('project', e.target.value)} title="Filter by project">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.sort_by} onChange={e => set('sort_by', e.target.value)} title="Sort by">
          <option value="">Default Sort</option>
          <option value="priority">Priority</option>
          <option value="due_date">Due Date</option>
          <option value="scheduled_date">Scheduled Date</option>
          <option value="created_at">Created</option>
        </select>
        <select value={filters.sort_dir} onChange={e => set('sort_dir', e.target.value)} title="Sort direction">
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>
      </div>
    </div>
  );
}
