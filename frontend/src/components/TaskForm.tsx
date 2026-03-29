import { useState } from 'react';
import type { Task, TaskUpdate, TaskBucket, TaskPriority, ChecklistItem } from '../types';
import TaskChecklist, { parseChecklist, serializeChecklist } from './TaskChecklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="task-form">
          <label>
            Title
            <Input type="text" value={title} onChange={e => setTitle(e.target.value)} required />
          </label>
          <label>
            Description
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              Priority
              <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              Bucket
              <Select value={bucket} onValueChange={v => setBucket(v as TaskBucket)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="incoming">Incoming</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="backlog">Backlog</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              Due Date
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </label>
            <label>
              Scheduled Date
              <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              Project
              <Input type="text" value={project} onChange={e => setProject(e.target.value)} />
            </label>
            <label>
              Tags
              <Input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="comma separated" />
            </label>
          </div>
          {bucket === 'blocked' && (
            <label>
              Blocked Reason
              <Input type="text" value={blockedReason} onChange={e => setBlockedReason(e.target.value)} />
            </label>
          )}
          <label>
            Notes
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </label>
          <div className="form-section">
            <label>Checklist</label>
            <TaskChecklist items={checklist} onChange={setChecklist} />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="default" type="submit" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
