import { useState } from 'react';
import type { Milestone, MilestoneCreate, MilestoneUpdate, InlineMilestoneCreate } from '../types';

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
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content${showSubBuilder ? ' modal-wide' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Milestone' : forceMinor ? 'New Sub-Milestone' : 'New Milestone'}</h3>
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
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label>
              Due Date
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </label>
          </div>
          {!forceMinor && (
            <div className="form-row">
              <label className="checkbox-label">
                <span>Major Milestone</span>
                <input
                  type="checkbox"
                  checked={isMajor}
                  onChange={e => handleMajorToggle(e.target.checked)}
                />
              </label>
              {!isMajor && (
                <label>
                  Parent Milestone
                  <select value={parentId} onChange={e => setParentId(e.target.value)}>
                    <option value="">— None —</option>
                    {validParents.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {/* Sub-milestone builder for new major milestones */}
          {showSubBuilder && (
            <div className="milestone-builder">
              <div className="milestone-builder-header">
                <h4>Sub-Milestones</h4>
                <button type="button" className="btn btn-sm btn-primary" onClick={addSub}>+ Sub-milestone</button>
              </div>
              {subRows.length === 0 && (
                <div className="milestone-builder-empty">No sub-milestones. You can add them now or later.</div>
              )}
              {subRows.map(r => (
                <div key={r.key} className="mb-child-row">
                  <span className="mb-type-badge minor">Minor</span>
                  <input
                    type="text"
                    placeholder="Sub-milestone title"
                    value={r.title}
                    onChange={e => updateSub(r.key, 'title', e.target.value)}
                    className="mb-title-input"
                  />
                  <select value={r.priority} onChange={e => updateSub(r.key, 'priority', e.target.value)} className="mb-select" title="Priority">
                    <option value="low">Low</option>
                    <option value="medium">Med</option>
                    <option value="high">High</option>
                    <option value="critical">Crit</option>
                  </select>
                  <input
                    type="date"
                    value={r.due_date}
                    onChange={e => updateSub(r.key, 'due_date', e.target.value)}
                    className="mb-date-input"
                    title="Due date"
                  />
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => removeSub(r.key)}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !title.trim()}>
              {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
