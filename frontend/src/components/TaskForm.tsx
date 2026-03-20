import { useState } from 'react';
import type { Task, TaskUpdate, TaskBucket, TaskPriority, ChecklistItem } from '../types';
import TaskChecklist, { parseChecklist, serializeChecklist } from './TaskChecklist';

interface Props {
  task: Task;
  onSave: (id: string, data: TaskUpdate) => Promise<void>;
  onClose: () => void;
}

export default function TaskForm({ task, onSave, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [bucket, setBucket] = useState<TaskBucket>(task.bucket);
  const [dueDate, setDueDate] = useState(task.due_date?.slice(0, 10) || '');
  const [scheduledDate, setScheduledDate] = useState(task.scheduled_date?.slice(0, 10) || '');
  const [project, setProject] = useState(task.project);
  const [tags, setTags] = useState(task.tags);
  const [blockedReason, setBlockedReason] = useState(task.blocked_reason);
  const [notes, setNotes] = useState(task.notes);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(parseChecklist(task.checklist_items));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(task.id, {
        title, description, priority, bucket,
        due_date: dueDate || null,
        scheduled_date: scheduledDate || null,
        project, tags, blocked_reason: blockedReason, notes,
        checklist_items: serializeChecklist(checklist),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Task</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="task-form">
          <label>
            Title
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </label>
          <div className="form-row">
            <label>
              Priority
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label>
              Bucket
              <select value={bucket} onChange={e => setBucket(e.target.value as TaskBucket)}>
                <option value="incoming">Incoming</option>
                <option value="today">Today</option>
                <option value="this_week">This Week</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="backlog">Backlog</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Due Date
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </label>
            <label>
              Scheduled Date
              <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Project
              <input type="text" value={project} onChange={e => setProject(e.target.value)} />
            </label>
            <label>
              Tags
              <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="comma separated" />
            </label>
          </div>
          {bucket === 'blocked' && (
            <label>
              Blocked Reason
              <input type="text" value={blockedReason} onChange={e => setBlockedReason(e.target.value)} />
            </label>
          )}
          <label>
            Notes
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </label>
          <div className="form-section">
            <label>Checklist</label>
            <TaskChecklist items={checklist} onChange={setChecklist} />
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
