import type { Task, TaskBucket, TaskPriority } from '../types';
import { PRIORITY_LABELS, BUCKET_LABELS } from '../types';
import { parseChecklist } from './TaskChecklist';

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
    <div className="task-card" data-priority={task.priority}>
      <div className="task-card-header">
        <span
          className="priority-dot"
          style={{ background: PRIORITY_COLORS[task.priority] }}
          title={PRIORITY_LABELS[task.priority]}
        />
        <span className="task-title" onClick={() => onEdit(task)}>{task.title}</span>
      </div>
      {task.description && <div className="task-desc">{task.description}</div>}
      <div className="task-meta">
        {task.project && <span className="tag tag-project">{task.project}</span>}
        {task.tags && task.tags.split(',').map(t => (
          <span key={t.trim()} className="tag">{t.trim()}</span>
        ))}
        {task.due_date && <span className="tag tag-due">Due: {task.due_date.slice(0, 10)}</span>}
        {task.scheduled_date && <span className="tag tag-sched">Sched: {task.scheduled_date.slice(0, 10)}</span>}
        {clTotal > 0 && <span className="tag tag-checklist">☑ {clDone}/{clTotal}</span>}
      </div>
      {task.blocked_reason && <div className="blocked-reason">⚠ {task.blocked_reason}</div>}
      <div className="task-actions">
        <button className="btn btn-xs btn-complete" onClick={() => onComplete(task.id)} title="Complete">✓</button>
        <select
          className="btn btn-xs"
          value={task.bucket}
          onChange={e => onMove(task.id, e.target.value as TaskBucket)}
          title="Move to bucket"
        >
          {buckets.map(b => (
            <option key={b} value={b}>{BUCKET_LABELS[b]}</option>
          ))}
        </select>
        <button className="btn btn-xs btn-danger" onClick={() => onDelete(task.id)} title="Delete">✕</button>
      </div>
    </div>
  );
}
