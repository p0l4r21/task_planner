import type { Task } from '../types';
import { PRIORITY_LABELS, BUCKET_LABELS } from '../types';

interface Props {
  tasks: Task[];
  onRestore?: (id: string) => void;
  onEdit?: (task: Task) => void;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  showBucket?: boolean;
  showCompleted?: boolean;
}

export default function TaskTable({ tasks, onRestore, onEdit, onComplete, onDelete, showBucket = true, showCompleted = false }: Props) {
  return (
    <div className="task-table-wrap">
      <table className="task-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Priority</th>
            {showBucket && <th>Bucket</th>}
            <th>Project</th>
            <th>Due</th>
            {showCompleted && <th>Completed</th>}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr><td colSpan={showCompleted ? 7 : 6} className="empty-row">No tasks found</td></tr>
          )}
          {tasks.map(t => (
            <tr key={t.id} data-priority={t.priority}>
              <td>
                <span className="table-title" onClick={() => onEdit?.(t)}>{t.title}</span>
                {t.tags && <span className="table-tags">{t.tags}</span>}
              </td>
              <td><span className={`priority-badge priority-${t.priority}`}>{PRIORITY_LABELS[t.priority]}</span></td>
              {showBucket && <td>{BUCKET_LABELS[t.bucket]}</td>}
              <td>{t.project || '—'}</td>
              <td>{t.due_date?.slice(0, 10) || '—'}</td>
              {showCompleted && <td>{t.completed_at?.slice(0, 10) || '—'}</td>}
              <td className="action-cell">
                {onComplete && <button className="btn btn-xs btn-complete" onClick={() => onComplete(t.id)} title="Complete">✓</button>}
                {onRestore && <button className="btn btn-xs btn-primary" onClick={() => onRestore(t.id)} title="Restore">↩</button>}
                {onDelete && <button className="btn btn-xs btn-danger" onClick={() => onDelete(t.id)} title="Delete">✕</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
