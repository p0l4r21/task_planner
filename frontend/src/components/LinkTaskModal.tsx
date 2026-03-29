import { useState } from 'react';
import type { Task } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

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
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Link Existing Task</DialogTitle>
        </DialogHeader>
        <Input
          type="text"
          placeholder="Search tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <ScrollArea className="link-list">
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
              <Button
                variant="default"
                size="xs"
                onClick={() => handleLink(t.id)}
                disabled={linking === t.id}
              >
                {linking === t.id ? '…' : 'Link'}
              </Button>
            </div>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
