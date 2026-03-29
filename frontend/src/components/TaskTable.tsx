import type { Task } from '../types';
import { PRIORITY_LABELS, BUCKET_LABELS } from '../types';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Priority</TableHead>
          {showBucket && <TableHead>Bucket</TableHead>}
          <TableHead>Project</TableHead>
          <TableHead>Due</TableHead>
          {showCompleted && <TableHead>Completed</TableHead>}
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.length === 0 && (
          <TableRow><TableCell colSpan={showCompleted ? 7 : 6} className="text-center text-muted-foreground py-8">No tasks found</TableCell></TableRow>
        )}
        {tasks.map(t => (
          <TableRow key={t.id} data-priority={t.priority}>
            <TableCell>
              <span className="table-title" onClick={() => onEdit?.(t)}>{t.title}</span>
              {t.tags && <span className="table-tags">{t.tags}</span>}
            </TableCell>
            <TableCell><span className={`priority-badge priority-${t.priority}`}>{PRIORITY_LABELS[t.priority]}</span></TableCell>
            {showBucket && <TableCell>{BUCKET_LABELS[t.bucket]}</TableCell>}
            <TableCell>{t.project || '—'}</TableCell>
            <TableCell>{t.due_date?.slice(0, 10) || '—'}</TableCell>
            {showCompleted && <TableCell>{t.completed_at?.slice(0, 10) || '—'}</TableCell>}
            <TableCell className="flex gap-1">
              {onComplete && <Button variant="ghost" size="xs" className="text-green-500 hover:bg-green-500/10" onClick={() => onComplete(t.id)} title="Complete">✓</Button>}
              {onRestore && <Button variant="default" size="xs" onClick={() => onRestore(t.id)} title="Restore">↩</Button>}
              {onDelete && <Button variant="destructive" size="xs" onClick={() => onDelete(t.id)} title="Delete">✕</Button>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
