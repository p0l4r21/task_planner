import { useState } from 'react';
import type { Milestone } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Link Milestone</DialogTitle>
        </DialogHeader>
        <Input
          type="text"
          placeholder="Search milestones…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <ScrollArea className="link-list">
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
              <Button
                variant="default"
                size="xs"
                onClick={() => handleLink(m.id)}
                disabled={linking === m.id}
              >
                {linking === m.id ? '…' : 'Link'}
              </Button>
            </div>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
