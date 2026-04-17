import { useState } from 'react';
import { toast } from 'sonner';
import type { Idea, IdeaUpdate, IdeaStatus, Project } from '../types';
import { IDEA_STATUS_LABELS, IDEA_STATUS_ORDER } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ideaToMarkdown, downloadMarkdown } from '../lib/markdown';
import { isAIConfigured, summarizeIdea, suggestTags, draftProjectScope } from '../lib/ai';

interface IdeaDetailPanelProps {
  idea: Idea;
  projects: Project[];
  onUpdate: (id: string, data: IdeaUpdate) => Promise<Idea>;
  onConvert: (ideaId: string) => void;
  onClose: () => void;
}

export default function IdeaDetailPanel({ idea, projects, onUpdate, onConvert, onClose }: IdeaDetailPanelProps) {
  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.description);
  const [notes, setNotes] = useState(idea.notes);
  const [tags, setTags] = useState(idea.tags);
  const [status, setStatus] = useState<IdeaStatus>(idea.status);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const hasChanges =
    title !== idea.title ||
    description !== idea.description ||
    notes !== idea.notes ||
    tags !== idea.tags ||
    status !== idea.status;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(idea.id, { title, description, notes, tags, status });
    } finally {
      setSaving(false);
    }
  };

  const handleExportMarkdown = () => {
    const updated = { ...idea, title, description, notes, tags, status };
    const md = ideaToMarkdown(updated);
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.md`;
    downloadMarkdown(filename, md);
  };

  const linkedCount =
    (idea.linked_project_ids ? idea.linked_project_ids.split(',').filter(Boolean).length : 0) +
    (idea.linked_task_ids ? idea.linked_task_ids.split(',').filter(Boolean).length : 0) +
    (idea.linked_milestone_ids ? idea.linked_milestone_ids.split(',').filter(Boolean).length : 0) +
    (idea.linked_idea_ids ? idea.linked_idea_ids.split(',').filter(Boolean).length : 0);

  const linkedProjectNames = idea.linked_project_ids
    ? idea.linked_project_ids.split(',').filter(Boolean).map(id => {
        const p = projects.find(proj => proj.id === id);
        return p ? p.name : id.slice(0, 8);
      })
    : [];

  const handleAISummarize = async () => {
    setAiLoading('summarize');
    try {
      const summary = await summarizeIdea({ ...idea, title, description, notes });
      setDescription(summary);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setAiLoading(null);
    }
  };

  const handleAISuggestTags = async () => {
    setAiLoading('tags');
    try {
      const suggested = await suggestTags({ ...idea, title, description, notes });
      const existing = tags.split(',').map(t => t.trim()).filter(Boolean);
      const merged = [...new Set([...existing, ...suggested])];
      setTags(merged.join(', '));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setAiLoading(null);
    }
  };

  const handleAIDraftScope = async () => {
    setAiLoading('scope');
    try {
      const scope = await draftProjectScope({ ...idea, title, description, notes });
      setNotes(prev => prev ? `${prev}\n\n---\nAI Draft Scope:\n${scope}` : `AI Draft Scope:\n${scope}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setAiLoading(null);
    }
  };

  const aiEnabled = isAIConfigured();

  return (
    <div className="idea-detail-panel">
      <div className="idea-detail-header">
        <div className="idea-detail-header-top">
          <span className={`idea-status-dot idea-status-${idea.status}`} />
          <span className="idea-detail-label">Idea</span>
          <Button variant="ghost" size="sm" onClick={onClose} className="ml-auto text-muted-foreground">✕</Button>
        </div>
      </div>

      <div className="idea-detail-body">
        <div className="idea-detail-field">
          <label className="idea-detail-field-label">Title</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} className="idea-detail-input" />
        </div>

        <div className="idea-detail-field">
          <label className="idea-detail-field-label">Status</label>
          <Select value={status} onValueChange={v => setStatus(v as IdeaStatus)}>
            <SelectTrigger className="idea-detail-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {IDEA_STATUS_ORDER.map(s => (
                <SelectItem key={s} value={s}>{IDEA_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="idea-detail-field">
          <label className="idea-detail-field-label">Description</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="idea-detail-textarea" />
        </div>

        <div className="idea-detail-field">
          <label className="idea-detail-field-label">Tags</label>
          <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="tag1, tag2, tag3" className="idea-detail-input" />
        </div>

        <div className="idea-detail-field">
          <label className="idea-detail-field-label">Notes</label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} className="idea-detail-textarea" />
        </div>

        {/* Linked items summary */}
        {linkedCount > 0 && (
          <div className="idea-detail-field">
            <label className="idea-detail-field-label">Linked Items ({linkedCount})</label>
            <div className="idea-linked-items">
              {linkedProjectNames.map((name, i) => (
                <span key={i} className="tag tag-project">{name}</span>
              ))}
            </div>
          </div>
        )}

        {idea.converted_project_id && (
          <div className="idea-detail-converted">
            Converted to project
          </div>
        )}

        {/* AI Actions */}
        {aiEnabled && (
          <div className="idea-detail-ai-section">
            <label className="idea-detail-field-label idea-ai-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline-block mr-1"><path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-1v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4H8a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z"/></svg>
              AI Assist
            </label>
            <div className="idea-ai-actions">
              <Button variant="outline" size="sm" onClick={handleAISummarize} disabled={!!aiLoading}>
                {aiLoading === 'summarize' ? 'Thinking…' : 'Summarize'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleAISuggestTags} disabled={!!aiLoading}>
                {aiLoading === 'tags' ? 'Thinking…' : 'Suggest Tags'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleAIDraftScope} disabled={!!aiLoading}>
                {aiLoading === 'scope' ? 'Thinking…' : 'Draft Scope'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="idea-detail-footer">
        <Button variant="default" size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {idea.status !== 'converted' && (
          <Button variant="outline" size="sm" onClick={() => onConvert(idea.id)}>
            Convert to Project
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={handleExportMarkdown}>
          Export .md
        </Button>
      </div>
    </div>
  );
}
