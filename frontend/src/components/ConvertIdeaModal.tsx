import { useState } from 'react';
import type { Idea, ProjectCreate, ProjectPriority } from '../types';
import { buildIdeaProjectDescription } from '../lib/ideaFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface ConvertIdeaModalProps {
  idea: Idea;
  open: boolean;
  onClose: () => void;
  onConvert: (ideaId: string, projectData: ProjectCreate) => Promise<void>;
}

export default function ConvertIdeaModal({ idea, open, onClose, onConvert }: ConvertIdeaModalProps) {
  const [name, setName] = useState(idea.title);
  const [description, setDescription] = useState(buildIdeaProjectDescription(idea));
  const [priority, setPriority] = useState<ProjectPriority>('medium');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onConvert(idea.id, {
        name: name.trim(),
        description,
        priority,
        tags: idea.tags,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Convert Idea to Project</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Project Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
            <Select value={priority} onValueChange={v => setPriority(v as ProjectPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || submitting}>
            {submitting ? 'Creating…' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
