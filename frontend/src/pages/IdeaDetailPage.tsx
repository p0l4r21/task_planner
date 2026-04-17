import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api';
import { useProjects } from '../hooks/useProjects';
import type { Idea, IdeaStatus, IdeaUpdate, ProjectCreate, Task } from '../types';
import { IDEA_STATUS_LABELS, IDEA_STATUS_ORDER } from '../types';
import { getIdeaSummary } from '../lib/ideaFields';
import { downloadMarkdown, ideaToMarkdown } from '../lib/markdown';
import ConvertIdeaModal from '../components/ConvertIdeaModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 2000;

interface IdeaFormState {
  title: string;
  summary: string;
  current_state: string;
  proposed_change: string;
  why_it_matters: string;
  notes: string;
  tags: string;
  status: IdeaStatus;
}

interface IdeaDraft {
  ideaId: string;
  form: IdeaFormState;
  localUpdatedAt: number;
  serverUpdatedAt: string;
}

function draftKey(ideaId: string): string {
  return `task-planner:idea-draft:${ideaId}`;
}

function getTimestamp(value: string): number {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function parseIds(value: string): string[] {
  return value.split(',').map(id => id.trim()).filter(Boolean);
}

function formsEqual(a: IdeaFormState, b: IdeaFormState): boolean {
  return Object.keys(a).every(key => {
    const field = key as keyof IdeaFormState;
    return a[field] === b[field];
  });
}

function readIdeaDraft(ideaId: string): IdeaDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(ideaId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IdeaDraft;
    if (parsed.ideaId !== ideaId || !parsed.form || typeof parsed.localUpdatedAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeIdeaDraft(ideaId: string, form: IdeaFormState, serverUpdatedAt: string): void {
  try {
    const draft: IdeaDraft = {
      ideaId,
      form,
      localUpdatedAt: Date.now(),
      serverUpdatedAt,
    };
    window.localStorage.setItem(draftKey(ideaId), JSON.stringify(draft));
  } catch {
    // Draft caching is protective, not required for editing to continue.
  }
}

function clearIdeaDraft(ideaId: string): void {
  try {
    window.localStorage.removeItem(draftKey(ideaId));
  } catch {
    // Ignore storage cleanup failures.
  }
}

function toFormState(idea: Idea): IdeaFormState {
  return {
    title: idea.title,
    summary: getIdeaSummary(idea),
    current_state: idea.current_state || '',
    proposed_change: idea.proposed_change || '',
    why_it_matters: idea.why_it_matters || '',
    notes: idea.notes || '',
    tags: idea.tags || '',
    status: idea.status,
  };
}

function updatePayload(form: IdeaFormState): IdeaUpdate {
  return {
    title: form.title.trim(),
    summary: form.summary,
    current_state: form.current_state,
    proposed_change: form.proposed_change,
    why_it_matters: form.why_it_matters,
    notes: form.notes,
    tags: form.tags,
    status: form.status,
  };
}

export default function IdeaDetailPage() {
  const { ideaId } = useParams<{ ideaId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const { projects, create: createProject } = useProjects();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [form, setForm] = useState<IdeaFormState | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [showConvert, setShowConvert] = useState(false);
  const latestIdeaRef = useRef<Idea | null>(null);
  const latestFormRef = useRef<IdeaFormState | null>(null);
  const initialLoadCompleteRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const activeSavePromiseRef = useRef<Promise<Idea | null> | null>(null);
  const pendingAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);

  const loadIdea = useCallback(async () => {
    if (!ideaId) return;
    setLoading(true);
    setInitialLoadComplete(false);
    initialLoadCompleteRef.current = false;
    setDraftNotice(null);
    try {
      const loaded = await api.getIdea(ideaId);
      const serverForm = toFormState(loaded);
      const localDraft = readIdeaDraft(ideaId);
      const shouldRestoreDraft =
        localDraft &&
        localDraft.localUpdatedAt > getTimestamp(loaded.updated_at) &&
        !formsEqual(localDraft.form, serverForm);

      setIdea(loaded);
      latestIdeaRef.current = loaded;

      if (shouldRestoreDraft) {
        setForm(localDraft.form);
        latestFormRef.current = localDraft.form;
        setSaveState('dirty');
        const notice = 'Restored a newer local draft. Save state is unsaved until it reaches the server.';
        setDraftNotice(notice);
        toast(notice);
      } else {
        setForm(serverForm);
        latestFormRef.current = serverForm;
        setSaveState('idle');
        if (localDraft) clearIdeaDraft(ideaId);
      }
    } catch (error) {
      setIdea(null);
      latestIdeaRef.current = null;
      setForm(null);
      latestFormRef.current = null;
      setSaveState('error');
      toast.error(error instanceof Error ? error.message : 'Failed to load idea');
    } finally {
      initialLoadCompleteRef.current = true;
      setInitialLoadComplete(true);
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => { loadIdea(); }, [loadIdea]);

  useEffect(() => {
    let ignore = false;
    async function loadRelated() {
      const [taskResult, ideaResult] = await Promise.all([
        api.listActive(),
        api.listIdeas(),
      ]);
      if (!ignore) {
        setTasks(taskResult);
        setIdeas(ideaResult);
      }
    }
    loadRelated().catch(() => {
      if (!ignore) {
        setTasks([]);
        setIdeas([]);
      }
    });
    return () => { ignore = true; };
  }, []);

  const hasChanges = useMemo(() => {
    if (!idea || !form) return false;
    const original = toFormState(idea);
    return Object.keys(original).some(key => {
      const field = key as keyof IdeaFormState;
      return form[field] !== original[field];
    });
  }, [idea, form]);

  const updateForm = <K extends keyof IdeaFormState>(key: K, value: IdeaFormState[K]) => {
    setForm(prev => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      latestFormRef.current = next;
      const currentIdea = latestIdeaRef.current;
      if (currentIdea && initialLoadCompleteRef.current) {
        writeIdeaDraft(currentIdea.id, next, currentIdea.updated_at);
      }
      return next;
    });
    setSaveState('dirty');
  };

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next);
  };

  const persistCurrentForm = useCallback(async (source: 'manual' | 'autosave'): Promise<Idea | null> => {
    const currentIdea = latestIdeaRef.current;
    const currentForm = latestFormRef.current;
    if (!currentIdea || !currentForm || !currentForm.title.trim()) return null;

    if (saveInFlightRef.current) {
      pendingAutosaveRef.current = true;
      await activeSavePromiseRef.current?.catch(() => null);
      if (source === 'manual') return persistCurrentForm(source);
      return null;
    }

    const formToSave = currentForm;
    saveInFlightRef.current = true;
    setSaveState('saving');

    const savePromise = api.updateIdea(currentIdea.id, updatePayload(formToSave));
    activeSavePromiseRef.current = savePromise;

    try {
      const updated = await savePromise;
      const latestForm = latestFormRef.current;
      const savedFormStillCurrent = !!latestForm && formsEqual(latestForm, formToSave);

      setIdea(updated);
      latestIdeaRef.current = updated;

      if (savedFormStillCurrent) {
        const serverForm = toFormState(updated);
        setForm(serverForm);
        latestFormRef.current = serverForm;
        clearIdeaDraft(updated.id);
        setDraftNotice(null);
        setSaveState('saved');
      } else {
        setSaveState('dirty');
        pendingAutosaveRef.current = true;
      }

      return updated;
    } catch (error) {
      setSaveState('error');
      if (source === 'manual') {
        toast.error(error instanceof Error ? error.message : 'Failed to save idea');
      }
      return null;
    } finally {
      activeSavePromiseRef.current = null;
      saveInFlightRef.current = false;

      if (pendingAutosaveRef.current) {
        pendingAutosaveRef.current = false;
        if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = window.setTimeout(() => {
          autosaveTimerRef.current = null;
          void persistCurrentForm('autosave');
        }, AUTOSAVE_DELAY_MS);
      }
    }
  }, []);

  const handleSave = async () => {
    await persistCurrentForm('manual');
  };

  const handleConvertToProject = async (ideaIdToConvert: string, projectData: ProjectCreate) => {
    if (form && hasChanges && form.title.trim()) {
      await persistCurrentForm('manual');
    }
    const project = await createProject(projectData);
    const updated = await api.convertIdea(ideaIdToConvert, project.id);
    setIdea(updated);
    latestIdeaRef.current = updated;
    setForm(toFormState(updated));
    latestFormRef.current = toFormState(updated);
    clearIdeaDraft(updated.id);
    setDraftNotice(null);
    setShowConvert(false);
    setSaveState('saved');
  };

  useEffect(() => {
    if (!initialLoadComplete || !idea || !form || !hasChanges || !form.title.trim()) return;
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void persistCurrentForm('autosave');
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [form, hasChanges, idea, initialLoadComplete, persistCurrentForm]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  const handleExportMarkdown = () => {
    if (!idea || !form) return;
    const exportIdea: Idea = { ...idea, ...updatePayload(form), description: form.summary };
    const filename = `${form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.md`;
    downloadMarkdown(filename || 'idea.md', ideaToMarkdown(exportIdea));
  };

  const linkedProjectIds = idea ? parseIds(idea.linked_project_ids) : [];
  const linkedTaskIds = idea ? parseIds(idea.linked_task_ids) : [];
  const linkedIdeaIds = idea ? parseIds(idea.linked_idea_ids) : [];

  const saveLabel = saveState === 'saving'
    ? 'Saving...'
    : saveState === 'dirty' || hasChanges
      ? 'Unsaved changes'
      : saveState === 'saved'
        ? 'Saved'
        : saveState === 'error'
          ? 'Save error'
          : 'No changes';

  if (loading) {
    return <div className="page"><p>Loading idea...</p></div>;
  }

  if (!idea || !form) {
    return (
      <div className="page">
        <Breadcrumb className="mb-3">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to="/ideas">Ideas</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>Not found</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="idea-detail-route-empty">
          <h2>Idea not found</h2>
          <p>The idea may have been deleted or the link is no longer valid.</p>
          <Button asChild><Link to="/ideas">Back to Ideas</Link></Button>
        </div>
      </div>
    );
  }

  const tagList = form.tags.split(',').map(tag => tag.trim()).filter(Boolean);

  return (
    <div className="idea-detail-route page">
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild><Link to="/ideas">Ideas</Link></BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{idea.title}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="idea-detail-route-header">
        <div className="idea-detail-title-block">
          <span className="idea-detail-route-kicker">Idea proposal</span>
          <Input
            value={form.title}
            onChange={event => updateForm('title', event.target.value)}
            className="idea-detail-title-input"
            aria-label="Idea title"
          />
          {draftNotice && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {draftNotice}
            </div>
          )}
        </div>
        <div className="idea-detail-save-row">
          <span className={`idea-save-state idea-save-state-${saveState}`}>{saveLabel}</span>
          <Button variant="outline" onClick={() => navigate('/ideas')}>Back</Button>
          <Button onClick={handleSave} disabled={!hasChanges || saveState === 'saving' || !form.title.trim()}>
            {saveState === 'saving' ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="idea-detail-layout">
        <section className="idea-detail-document">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList variant="line" className="idea-detail-tabs">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="related">Related Items</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="idea-detail-tab-content">
              <label className="idea-detail-doc-field">
                <span>Summary</span>
                <Textarea
                  value={form.summary}
                  onChange={event => updateForm('summary', event.target.value)}
                  rows={3}
                  placeholder="A compact 1-2 line summary for cards and lists."
                />
              </label>

              <label className="idea-detail-doc-field">
                <span>Current State</span>
                <Textarea
                  value={form.current_state}
                  onChange={event => updateForm('current_state', event.target.value)}
                  rows={5}
                  placeholder="What pain point, gap, risk, or situation is this idea responding to?"
                />
              </label>

              <label className="idea-detail-doc-field">
                <span>Proposed Change</span>
                <Textarea
                  value={form.proposed_change}
                  onChange={event => updateForm('proposed_change', event.target.value)}
                  rows={5}
                  placeholder="What should change? Make this actionable."
                />
              </label>

              <label className="idea-detail-doc-field">
                <span>Why It Matters</span>
                <Textarea
                  value={form.why_it_matters}
                  onChange={event => updateForm('why_it_matters', event.target.value)}
                  rows={4}
                  placeholder="Explain the value, risk, scale, or strategic relevance."
                />
              </label>
            </TabsContent>

            <TabsContent value="notes" className="idea-detail-tab-content">
              <label className="idea-detail-doc-field">
                <span>Notes</span>
                <Textarea
                  value={form.notes}
                  onChange={event => updateForm('notes', event.target.value)}
                  rows={16}
                  placeholder="Raw thinking, markdown, alternatives, objections, rollout thoughts, and incomplete ideas."
                />
              </label>
              <p className="idea-detail-help">Markdown is stored as plain text for now. Rendering/preview can come later.</p>
            </TabsContent>

            <TabsContent value="related" className="idea-detail-tab-content">
              <RelatedItems
                linkedProjectIds={linkedProjectIds}
                linkedTaskIds={linkedTaskIds}
                linkedIdeaIds={linkedIdeaIds}
                projects={projects}
                tasks={tasks}
                ideas={ideas}
                convertedProjectId={idea.converted_project_id}
              />
            </TabsContent>
          </Tabs>
        </section>

        <aside className="idea-detail-metadata">
          <div className="idea-metadata-card">
            <h3>Metadata</h3>
            <label className="idea-metadata-field">
              <span>Status</span>
              <Select value={form.status} onValueChange={value => updateForm('status', value as IdeaStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IDEA_STATUS_ORDER.map(status => (
                    <SelectItem key={status} value={status}>{IDEA_STATUS_LABELS[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="idea-metadata-field">
              <span>Tags</span>
              <Input value={form.tags} onChange={event => updateForm('tags', event.target.value)} placeholder="tag1, tag2" />
            </label>
            {tagList.length > 0 && (
              <div className="idea-tag-stack">
                {tagList.map(tag => <span key={tag} className="tag">{tag}</span>)}
              </div>
            )}
            <div className="idea-metadata-list">
              <div><span>Created</span><strong>{idea.created_at.slice(0, 10)}</strong></div>
              <div><span>Updated</span><strong>{idea.updated_at.slice(0, 10)}</strong></div>
              <div><span>Related</span><strong>{linkedProjectIds.length + linkedTaskIds.length + linkedIdeaIds.length}</strong></div>
            </div>
          </div>

          <div className="idea-metadata-card">
            <h3>Actions</h3>
            {idea.status !== 'converted' ? (
              <Button className="w-full" onClick={() => setShowConvert(true)}>Convert to Project</Button>
            ) : (
              <div className="idea-detail-converted">Converted to project</div>
            )}
            <Button variant="outline" className="w-full" onClick={handleExportMarkdown}>Export .md</Button>
          </div>
        </aside>
      </div>

      {showConvert && (
        <ConvertIdeaModal
          idea={{ ...idea, ...updatePayload(form), description: form.summary }}
          open
          onClose={() => setShowConvert(false)}
          onConvert={handleConvertToProject}
        />
      )}
    </div>
  );
}

function RelatedItems({
  linkedProjectIds,
  linkedTaskIds,
  linkedIdeaIds,
  projects,
  tasks,
  ideas,
  convertedProjectId,
}: {
  linkedProjectIds: string[];
  linkedTaskIds: string[];
  linkedIdeaIds: string[];
  projects: { id: string; name: string }[];
  tasks: Task[];
  ideas: Idea[];
  convertedProjectId: string | null;
}) {
  const taskMap = new Map(tasks.map(task => [task.id, task]));
  const ideaMap = new Map(ideas.map(idea => [idea.id, idea]));
  const projectMap = new Map(projects.map(project => [project.id, project]));

  const hasRelated = convertedProjectId || linkedProjectIds.length || linkedTaskIds.length || linkedIdeaIds.length;

  if (!hasRelated) {
    return (
      <div className="idea-related-empty">
        <h3>No related items yet</h3>
        <p>Related projects, tasks, and ideas will appear here as this proposal turns into work.</p>
      </div>
    );
  }

  return (
    <div className="idea-related-sections">
      {convertedProjectId && (
        <div className="idea-related-section">
          <h3>Converted Project</h3>
          <Link to={`/projects/${convertedProjectId}`} className="idea-related-row">
            {projectMap.get(convertedProjectId)?.name || convertedProjectId.slice(0, 8)}
          </Link>
        </div>
      )}

      {linkedProjectIds.length > 0 && (
        <div className="idea-related-section">
          <h3>Projects</h3>
          {linkedProjectIds.map(id => (
            <Link key={id} to={`/projects/${id}`} className="idea-related-row">
              {projectMap.get(id)?.name || id.slice(0, 8)}
            </Link>
          ))}
        </div>
      )}

      {linkedTaskIds.length > 0 && (
        <div className="idea-related-section">
          <h3>Tasks</h3>
          {linkedTaskIds.map(id => (
            <div key={id} className="idea-related-row">
              {taskMap.get(id)?.title || id.slice(0, 8)}
            </div>
          ))}
        </div>
      )}

      {linkedIdeaIds.length > 0 && (
        <div className="idea-related-section">
          <h3>Ideas</h3>
          {linkedIdeaIds.map(id => (
            <Link key={id} to={`/ideas/${id}`} className="idea-related-row">
              {ideaMap.get(id)?.title || id.slice(0, 8)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
