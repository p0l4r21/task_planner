import type { Task, TaskBucket } from '../types';
import { BUCKET_LABELS } from '../types';
import TaskCard from './TaskCard';

interface Props {
  bucket: TaskBucket;
  tasks: Task[];
  onComplete: (id: string) => void;
  onMove: (id: string, bucket: TaskBucket) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const BUCKET_COLORS: Record<TaskBucket, string> = {
  today: '#2563eb',
  in_progress: '#7c3aed',
  blocked: '#dc2626',
  this_week: '#0891b2',
  incoming: '#ca8a04',
  backlog: '#6b7280',
  completed: '#16a34a',
};

export default function BucketColumn({ bucket, tasks, onComplete, onMove, onEdit, onDelete }: Props) {
  return (
    <div className="bucket-column">
      <div className="bucket-header" style={{ borderColor: BUCKET_COLORS[bucket] }}>
        <span className="bucket-label">{BUCKET_LABELS[bucket]}</span>
        <span className="bucket-count">{tasks.length}</span>
      </div>
      <div className="bucket-body">
        {tasks.length === 0 && <div className="bucket-empty">No tasks</div>}
        {tasks.map(t => (
          <TaskCard
            key={t.id}
            task={t}
            onComplete={onComplete}
            onMove={onMove}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
