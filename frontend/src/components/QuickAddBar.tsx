import { useState } from 'react';
import type { TaskCreate, TaskBucket, TaskPriority } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Quick add task… (Enter to save)"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="quick-add-input"
          autoFocus
        />
        <Button variant="ghost" size="sm" type="button" onClick={() => setExpanded(!expanded)}>
          {expanded ? '▴' : '▾'}
        </Button>
        <Button variant="default" size="sm" type="submit" disabled={!title.trim()}>
          Add
        </Button>
      </div>
      {expanded && (
        <div className="flex gap-2 mt-2 flex-wrap">
          <Input
            type="text"
            placeholder="Project"
            value={project}
            onChange={e => setProject(e.target.value)}
          />
          <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
            <SelectTrigger title="Priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bucket} onValueChange={v => setBucket(v as TaskBucket)}>
            <SelectTrigger title="Bucket">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="incoming">Incoming</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="backlog">Backlog</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </form>
  );
}
