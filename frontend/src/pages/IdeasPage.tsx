import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Idea, IdeaStatus } from '../types';
import { IDEA_STATUS_LABELS, IDEA_STATUS_ORDER } from '../types';
import { useIdeas } from '../hooks/useIdeas';
import { getIdeaSummary } from '../lib/ideaFields';
import IdeaListView from '../components/IdeaListView';
import IdeaBoardView from '../components/IdeaBoardView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type ViewMode = 'list' | 'board';

interface FilterState {
  search: string;
  status: '' | IdeaStatus;
  sort: string;
}

export default function IdeasPage() {
  const navigate = useNavigate();
  const { ideas, loading, create } = useIdeas();

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [filters, setFilters] = useState<FilterState>({ search: '', status: '', sort: 'updated_at' });
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create modal state
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newTags, setNewTags] = useState('');

  const filteredIdeas = useMemo(() => {
    let result = [...ideas];
    if (filters.status) {
      result = result.filter(i => i.status === filters.status);
    }
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        getIdeaSummary(i).toLowerCase().includes(q) ||
        i.current_state.toLowerCase().includes(q) ||
        i.proposed_change.toLowerCase().includes(q) ||
        i.why_it_matters.toLowerCase().includes(q) ||
        i.notes.toLowerCase().includes(q) ||
        i.tags.toLowerCase().includes(q)
      );
    }
    if (filters.sort === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    } else if (filters.sort === 'created_at') {
      result.sort((a, b) => b.created_at.localeCompare(a.created_at));
    } else {
      result.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    return result;
  }, [ideas, filters]);

  const handleCreateIdea = async () => {
    if (!newTitle.trim()) return;
    const created = await create({
      title: newTitle.trim(),
      summary: newSummary,
      tags: newTags,
    });
    setShowCreateModal(false);
    setNewTitle('');
    setNewSummary('');
    setNewTags('');
    navigate(`/ideas/${created.id}`);
  };

  return (
    <div className="idea-hub-page">
      {/* Toolbar */}
      <div className="idea-hub-toolbar">
        <div className="idea-hub-toolbar-left">
          <h2 className="idea-hub-title">Idea Hub</h2>
          <span className="idea-hub-count">{ideas.length} ideas</span>
        </div>
        <div className="idea-hub-toolbar-right">
          <Input
            placeholder="Search ideas…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="idea-hub-search"
          />
          <Select value={filters.status || 'all'} onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? '' : v as IdeaStatus }))}>
            <SelectTrigger className="idea-hub-filter-select"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {IDEA_STATUS_ORDER.map(s => (
                <SelectItem key={s} value={s}>{IDEA_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={v => setFilters(f => ({ ...f, sort: v }))}>
            <SelectTrigger className="idea-hub-filter-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_at">Last updated</SelectItem>
              <SelectItem value="created_at">Newest first</SelectItem>
              <SelectItem value="title">Title A–Z</SelectItem>
            </SelectContent>
          </Select>
          <ToggleGroup type="single" value={viewMode} onValueChange={v => v && setViewMode(v as ViewMode)} className="idea-hub-view-toggle">
            <ToggleGroupItem value="list" aria-label="List view" className="text-xs px-2">List</ToggleGroupItem>
            <ToggleGroupItem value="board" aria-label="Board view" className="text-xs px-2">Board</ToggleGroupItem>
          </ToggleGroup>
          <Button size="sm" onClick={() => setShowCreateModal(true)}>+ Idea</Button>
        </div>
      </div>

      {/* Main content area */}
      <div className="idea-hub-body">
        <div className="idea-hub-main">
          {loading && ideas.length === 0 ? (
            <div className="idea-list-empty"><p>Loading ideas…</p></div>
          ) : viewMode === 'board' ? (
            <IdeaBoardView ideas={filteredIdeas} onSelect={(idea: Idea) => navigate(`/ideas/${idea.id}`)} />
          ) : (
            <IdeaListView ideas={filteredIdeas} onSelect={(idea: Idea) => navigate(`/ideas/${idea.id}`)} />
          )}
        </div>
      </div>

      {/* Create Idea Dialog */}
      <Dialog open={showCreateModal} onOpenChange={v => { if (!v) setShowCreateModal(false); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Capture Idea</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="What's the idea?" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Summary</label>
              <Textarea value={newSummary} onChange={e => setNewSummary(e.target.value)} placeholder="Brief 1-2 line summary..." rows={3} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags</label>
              <Input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="tag1, tag2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreateIdea} disabled={!newTitle.trim()}>Capture</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
