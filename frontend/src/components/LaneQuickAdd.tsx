import { useState, useCallback } from 'react';
import type { TaskBucket, TaskCreate, TaskPriority } from '../types';

interface Props {
  defaultBucket: TaskBucket;
  defaultScheduledDate: string | null;
  defaultProjectId?: string;
  onCreateTask: (data: TaskCreate) => Promise<void>;
}

export default function LaneQuickAdd({
  defaultBucket,
  defaultScheduledDate,
  defaultProjectId,
  onCreateTask,
}: Props) {
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onCreateTask({
        title: trimmed,
        description: '',
        notes: '',
        priority: 'medium' as TaskPriority,
        bucket: defaultBucket,
        due_date: null,
        scheduled_date: defaultScheduledDate,
        project_id: defaultProjectId || null,
        project: '',
        parent_milestone_id: null,
        hierarchy_level: 0,
        tags: '',
        checklist_items: '',
      });
      setTitle('');
    } finally {
      setSaving(false);
    }
  }, [title, saving, defaultBucket, defaultScheduledDate, defaultProjectId, onCreateTask]);

  return (
    <form
      className="lane-quick-add"
      onSubmit={e => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <input
        type="text"
        className="lane-quick-add-input"
        placeholder="+ Add task…"
        value={title}
        onChange={e => setTitle(e.target.value)}
        disabled={saving}
      />
    </form>
  );
}
