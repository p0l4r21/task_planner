import { useState } from 'react';
import type { Milestone, MilestoneCreate, MilestoneUpdate, InlineMilestoneCreate } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface Props {
  milestone?: Milestone | null;
  parentOptions: { id: string; title: string }[];
  allMilestones: Milestone[];
  /** If true, the form is for a sub-milestone (is_major defaults false, parent required) */
  forceMinor?: boolean;
  onSave: (
    data: MilestoneCreate | { id: string; data: MilestoneUpdate },
    children?: InlineMilestoneCreate[],
  ) => Promise<void>;
  onClose: () => void;
}

interface SubRow {
  key: number;
  title: string;
  priority: string;
  due_date: string;
}

let _subRowKey = 0;

export default function MilestoneFormModal({ milestone, parentOptions, allMilestones, forceMinor, onSave, onClose }: Props) {
  const isEdit = !!milestone;
  const [title, setTitle] = useState(milestone?.title || '');
  const [description, setDescription] = useState(milestone?.description || '');
  const [priority, setPriority] = useState(milestone?.priority || 'medium');
  const [dueDate, setDueDate] = useState(milestone?.due_date?.slice(0, 10) || '');
  const [isMajor, setIsMajor] = useState(forceMinor ? false : (milestone?.is_major ?? true));
  const [parentId, setParentId] = useState(milestone?.parent_milestone_id || '');
  const [saving, setSaving] = useState(false);

  // Sub-milestone builder (only for new major milestones)
  const [subRows, setSubRows] = useState<SubRow[]>([]);

  const addSub = () => {
    setSubRows(prev => [...prev, { key: ++_subRowKey, title: '', priority: 'medium', due_date: '' }]);
  };
  const removeSub = (key: number) => {
    setSubRows(prev => prev.filter(r => r.key !== key));
  };
  const updateSub = (key: number, field: string, value: string) => {
    setSubRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r));
  };

  // When toggling to minor, clear sub-rows (minor milestones can't have children)
  const handleMajorToggle = (checked: boolean) => {
    setIsMajor(checked);
    if (!checked) setSubRows([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const children: InlineMilestoneCreate[] = subRows
        .filter(r => r.title.trim())
        .map(r => ({ title: r.title, priority: r.priority, due_date: r.due_date || null }));

      if (isEdit && milestone) {
        await onSave({
          id: milestone.id,
          data: {
            title, description, priority,
            due_date: dueDate || null,
            is_major: isMajor,
            parent_milestone_id: parentId || null,
          },
        });
      } else {
        await onSave(
          {
            title, description, priority,
            due_date: dueDate || null,
            is_major: isMajor,
            parent_milestone_id: parentId || null,
          } as MilestoneCreate,
          isMajor ? children : undefined,
        );
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const validParents = parentOptions.filter(p => !milestone || p.id !== milestone.id);
  const showSubBuilder = !isEdit && isMajor && !forceMinor;

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className={showSubBuilder ? 'sm:max-w-2xl' : 'sm:max-w-lg'}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Milestone' : forceMinor ? 'New Sub-Milestone' : 'New Milestone'}</DialogTitle>
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
          <div className="form-row">
            <label>
              Priority
              <Select value={priority} onValueChange={v => setPriority(v)}>
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
              Due Date
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </label>
          </div>
          {!forceMinor && (
            <div className="grid grid-cols-2 gap-3">
              <label className="checkbox-label">
                <span>Major Milestone</span>
                <Checkbox
                  checked={isMajor}
                  onCheckedChange={checked => handleMajorToggle(!!checked)}
                />
              </label>
              {!isMajor && (
                <label>
                  Parent Milestone
                  <Select value={parentId || 'none'} onValueChange={v => setParentId(v === 'none' ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {validParents.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              )}
            </div>
          )}

          {/* Sub-milestone builder for new major milestones */}
          {showSubBuilder && (
            <div className="milestone-builder">
              <div className="milestone-builder-header">
                <h4>Sub-Milestones</h4>
                <Button variant="default" size="sm" type="button" onClick={addSub}>+ Sub-milestone</Button>
              </div>
              {subRows.length === 0 && (
                <div className="milestone-builder-empty">No sub-milestones. You can add them now or later.</div>
              )}
              {subRows.map(r => (
                <div key={r.key} className="mb-child-row">
                  <span className="mb-type-badge minor">Minor</span>
                  <Input
                    type="text"
                    placeholder="Sub-milestone title"
                    value={r.title}
                    onChange={e => updateSub(r.key, 'title', e.target.value)}
                    className="mb-title-input"
                  />
                  <Select value={r.priority} onValueChange={v => updateSub(r.key, 'priority', v)}>
                    <SelectTrigger className="mb-select" title="Priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Med</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Crit</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={r.due_date}
                    onChange={e => updateSub(r.key, 'due_date', e.target.value)}
                    className="mb-date-input"
                    title="Due date"
                  />
                  <Button variant="destructive" size="sm" type="button" onClick={() => removeSub(r.key)}>✕</Button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button variant="default" type="submit" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
