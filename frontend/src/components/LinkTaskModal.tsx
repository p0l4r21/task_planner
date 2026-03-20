import { useState } from 'react';
import type { Task } from '../types';

interface Props {
  tasks: Task[];
  linkedTaskIds: string[];
  onLink: (taskId: string) => Promise<void>;
  onClose: () => void;
}

export default function LinkTaskModal({ tasks, linkedTaskIds, onLink, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState<string | null>(null);

  const available = tasks.filter(t => {
    if (linkedTaskIds.includes(t.id)) return false;
    if (search) {
      return t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.project.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const handleLink = async (taskId: string) => {
    setLinking(taskId);
    try {
      await onLink(taskId);
    } finally {
      setLinking(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Link Existing Task</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <input
          type="text"
          className="quick-add-input"
          placeholder="Search tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <div className="link-list">
          {available.length === 0 && (
            <div className="link-list-empty">No tasks available to link</div>
          )}
          {available.map(t => (
            <div key={t.id} className="link-list-item">
              <div className="link-list-info">
                <span className={`priority-badge priority-${t.priority}`}>
                  {t.priority}
                </span>
                <span className="link-list-title">{t.title}</span>
                {t.project && <span className="tag tag-project">{t.project}</span>}
              </div>
              <button
                className="btn btn-xs btn-primary"
                onClick={() => handleLink(t.id)}
                disabled={linking === t.id}
              >
                {linking === t.id ? '…' : 'Link'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
