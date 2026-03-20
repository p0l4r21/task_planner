import { useState } from 'react';
import type { TaskCreate, TaskBucket, TaskPriority } from '../types';

interface Props {
  onSubmit: (data: TaskCreate) => Promise<void>;
  defaultBucket?: TaskBucket;
}

export default function QuickAddBar({ onSubmit, defaultBucket = 'incoming' }: Props) {
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [bucket, setBucket] = useState<TaskBucket>(defaultBucket);
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onSubmit({ title: title.trim(), project, priority, bucket });
    setTitle('');
    setProject('');
    setPriority('medium');
    setBucket(defaultBucket);
    setExpanded(false);
  };

  return (
    <form className="quick-add" onSubmit={handleSubmit}>
      <div className="quick-add-row">
        <input
          type="text"
          placeholder="Quick add task… (Enter to save)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="quick-add-input"
          autoFocus
        />
        <button type="button" className="btn btn-sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? '▴' : '▾'}
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim()}>
          Add
        </button>
      </div>
      {expanded && (
        <div className="quick-add-extra">
          <input
            type="text"
            placeholder="Project"
            value={project}
            onChange={e => setProject(e.target.value)}
          />
          <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} title="Priority">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select value={bucket} onChange={e => setBucket(e.target.value as TaskBucket)} title="Bucket">
            <option value="incoming">Incoming</option>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="in_progress">In Progress</option>
            <option value="backlog">Backlog</option>
          </select>
        </div>
      )}
    </form>
  );
}
