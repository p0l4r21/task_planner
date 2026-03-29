import { useState } from 'react';
import type { TaskPriority, TaskBucket } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      <form onSubmit={handleSearch} className="flex gap-2 mb-2 flex-wrap">
        <Input
          type="text"
          placeholder="Search tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Button variant="ghost" size="sm" type="submit">Search</Button>
        {filters.search && (
          <Button variant="ghost" size="sm" type="button" onClick={() => { setSearch(''); set('search', ''); }}>
            Clear
          </Button>
        )}
      </form>
      <div className="flex gap-2 flex-wrap">
        <Select value={filters.priority || 'all'} onValueChange={v => set('priority', v === 'all' ? '' : v)}>
          <SelectTrigger title="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.bucket || 'all'} onValueChange={v => set('bucket', v === 'all' ? '' : v)}>
          <SelectTrigger title="Filter by bucket">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buckets</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="incoming">Incoming</SelectItem>
            <SelectItem value="backlog">Backlog</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.project || 'all'} onValueChange={v => set('project', v === 'all' ? '' : v)}>
          <SelectTrigger title="Filter by project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.sort_by || 'all'} onValueChange={v => set('sort_by', v === 'all' ? '' : v)}>
          <SelectTrigger title="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Default Sort</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="due_date">Due Date</SelectItem>
            <SelectItem value="scheduled_date">Scheduled Date</SelectItem>
            <SelectItem value="created_at">Created</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.sort_dir} onValueChange={v => set('sort_dir', v)}>
          <SelectTrigger title="Sort direction">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">Asc</SelectItem>
            <SelectItem value="desc">Desc</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
