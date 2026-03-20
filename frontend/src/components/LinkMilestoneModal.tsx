import { useState } from 'react';
import type { Milestone } from '../types';

interface Props {
  milestones: Milestone[];
  currentMilestoneId: string;
  onLink: (targetId: string) => Promise<void>;
  onClose: () => void;
}

export default function LinkMilestoneModal({ milestones, currentMilestoneId, onLink, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState<string | null>(null);

  // Parse already-linked IDs from the current milestone
  const current = milestones.find(m => m.id === currentMilestoneId);
  const alreadyLinked = current?.linked_milestone_ids
    ? current.linked_milestone_ids.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const available = milestones.filter(m => {
    if (m.id === currentMilestoneId) return false;
    if (alreadyLinked.includes(m.id)) return false;
    if (search) {
      return m.title.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const handleLink = async (targetId: string) => {
    setLinking(targetId);
    try {
      await onLink(targetId);
      onClose();
    } finally {
      setLinking(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Link Milestone</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <input
          type="text"
          className="quick-add-input"
          placeholder="Search milestones…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <div className="link-list">
          {available.length === 0 && (
            <div className="link-list-empty">No milestones available to link</div>
          )}
          {available.map(m => (
            <div key={m.id} className="link-list-item">
              <div className="link-list-info">
                <span className={`ms-type-badge ${m.is_major ? 'ms-major' : 'ms-minor'}`}>
                  {m.is_major ? 'Major' : 'Minor'}
                </span>
                <span className="link-list-title">{m.title}</span>
              </div>
              <button
                className="btn btn-xs btn-primary"
                onClick={() => handleLink(m.id)}
                disabled={linking === m.id}
              >
                {linking === m.id ? '…' : 'Link'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
