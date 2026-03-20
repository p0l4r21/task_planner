import type { Milestone, Task } from '../types';
import { MILESTONE_STATUS_LABELS } from '../types';

interface Props {
  task: Task;
  milestone: Milestone;
  onUnlink: (milestoneId: string, taskId: string) => Promise<void>;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#2563eb',
  low: '#6b7280',
};

export default function TaskPanel({ task, milestone, onUnlink }: Props) {
  return null; // This is a placeholder — real task panel is inline in ProjectDetailPage
}

// Standalone TaskPanel list used in ProjectDetailPage
interface TaskPanelListProps {
  tasks: Task[];
  milestoneId: string;
  onUnlink: (milestoneId: string, taskId: string) => Promise<void>;
}

export function TaskPanelList({ tasks, milestoneId, onUnlink }: TaskPanelListProps) {
  if (tasks.length === 0) {
    return <div className="tp-empty">No tasks linked</div>;
  }

  return (
    <div className="tp-list">
      {tasks.map(t => (
        <div key={t.id} className="tp-task">
          <span
            className="priority-dot"
            style={{ background: PRIORITY_COLORS[t.priority] || '#6b7280' }}
          />
          <div className="tp-task-info">
            <span className="tp-task-title">{t.title}</span>
            <span className="tp-task-meta">
              {t.bucket.replace('_', ' ')}
              {t.due_date && ` · Due ${t.due_date.slice(0, 10)}`}
            </span>
          </div>
          <button
            className="btn btn-xs"
            onClick={() => onUnlink(milestoneId, t.id)}
            title="Unlink task"
          >✕</button>
        </div>
      ))}
    </div>
  );
}
