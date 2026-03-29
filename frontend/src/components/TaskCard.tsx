import type { Task, TaskBucket, TaskPriority } from '../types';
import { PRIORITY_LABELS, BUCKET_LABELS } from '../types';
import { parseChecklist } from './TaskChecklist';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';

interface Props {
  task: Task;
  onComplete: (id: string) => void;
  onMove: (id: string, bucket: TaskBucket) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#2563eb',
  low: '#6b7280',
};

export default function TaskCard({ task, onComplete, onMove, onEdit, onDelete }: Props) {
  const buckets: TaskBucket[] = ['incoming', 'today', 'this_week', 'in_progress', 'blocked', 'backlog'];
  const clItems = parseChecklist(task.checklist_items);
  const clDone = clItems.filter(i => i.completed).length;
  const clTotal = clItems.length;

  return (
    <Card className="task-card bg-transparent py-0 ring-foreground/[0.06] hover:ring-foreground/[0.12] transition-[box-shadow]" data-priority={task.priority}>
      <div className="task-card-header">
        <span
          className="priority-dot"
          style={{ background: PRIORITY_COLORS[task.priority] }}
          title={PRIORITY_LABELS[task.priority]}
        />
        <span className="task-title" onClick={() => onEdit(task)}>{task.title}</span>
      </div>
      {task.description && <div className="task-desc">{task.description}</div>}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {task.project && <span className="tag tag-project">{task.project}</span>}
        {task.tags && task.tags.split(',').map(t => (
          <span key={t.trim()} className="tag">{t.trim()}</span>
        ))}
        {task.due_date && <span className="tag tag-due">Due: {task.due_date.slice(0, 10)}</span>}
        {task.scheduled_date && <span className="tag tag-sched">Sched: {task.scheduled_date.slice(0, 10)}</span>}
        {clTotal > 0 && <span className="tag tag-checklist">☑ {clDone}/{clTotal}</span>}
      </div>
      {task.blocked_reason && <div className="blocked-reason">⚠ {task.blocked_reason}</div>}
      <div className="flex flex-wrap gap-1 mt-2">
        <Button variant="ghost" size="xs" className="text-green-500 hover:bg-green-500/10" onClick={() => onComplete(task.id)} title="Complete">✓</Button>
        <Select value={task.bucket} onValueChange={v => onMove(task.id, v as TaskBucket)}>
          <SelectTrigger className="h-6 w-auto gap-1 border-border px-2 text-xs" title="Move to bucket">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {buckets.map(b => (
              <SelectItem key={b} value={b}>{BUCKET_LABELS[b]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="destructive" size="xs" onClick={() => onDelete(task.id)} title="Delete">✕</Button>
      </div>
    </Card>
  );
}
