import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api';
import type { Idea, IdeaEntry, IdeaEntryType, IdeaStatus, IdeaUpdate, Project } from '../types';
import { IDEA_ENTRY_TYPE_LABELS, IDEA_ENTRY_TYPE_ORDER, IDEA_STATUS_LABELS, IDEA_STATUS_ORDER } from '../types';
import { getIdeaSummary } from '../lib/ideaFields';
import { isAIConfigured, runIdeaWorkspaceAction } from '../lib/ai';
import type { IdeaWorkspaceAction } from '../lib/ai';
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

const AUTOSAVE_DELAY_MS = 1800;

const AI_ACTIONS: Array<{ action: IdeaWorkspaceAction; label: string; entryTitle: string }> = [
  { action: 'expand', label: 'Expand idea', entryTitle: 'AI Expansion' },
  { action: 'gaps', label: 'Find gaps', entryTitle: 'AI Gaps and Weak Points' },
  { action: 'tasks', label: 'Extract tasks', entryTitle: 'AI Candidate Tasks' },
  { action: 'risks', label: 'Identify risks', entryTitle: 'AI Risks' },
  { action: 'executive_summary', label: 'Executive summary', entryTitle: 'AI Executive Summary' },
  { action: 'child_ideas', label: 'Suggest child ideas', entryTitle: 'AI Child Idea Suggestions' },
  { action: 'project_outline', label: 'Project outline', entryTitle: 'AI Project Outline' },
];

interface IdeaFormState {
  title: string;
  summary: string;
  current_state: string;
  proposed_change: string;
  why_it_matters: string;
  body: string;
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
    // Local drafts are protective only; editing should continue if storage fails.
  }
}

function clearIdeaDraft(ideaId: string): void {
  try {
    window.localStorage.removeItem(draftKey(ideaId));
  } catch {
    // Ignore storage cleanup failures.
  }
}

function normalizeDraftForm(form: Partial<IdeaFormState>, fallback: IdeaFormState): IdeaFormState {
  return {
    title: form.title ?? fallback.title,
    summary: form.summary ?? fallback.summary,
    current_state: form.current_state ?? fallback.current_state,
    proposed_change: form.proposed_change ?? fallback.proposed_change,
    why_it_matters: form.why_it_matters ?? fallback.why_it_matters,
    body: form.body ?? fallback.body,
    notes: form.notes ?? fallback.notes,
    tags: form.tags ?? fallback.tags,
    status: form.status ?? fallback.status,
  };
}

function toFormState(idea: Idea): IdeaFormState {
  return {
    title: idea.title,
    summary: getIdeaSummary(idea),
    current_state: idea.current_state || '',
    proposed_change: idea.proposed_change || '',
    why_it_matters: idea.why_it_matters || '',
    body: idea.body || '',
    notes: idea.notes || '',
    tags: idea.tags || '',
    status: idea.status,
  };
}

function buildUpdatePayload(form: IdeaFormState): IdeaUpdate {
  return {
    title: form.title.trim(),
    summary: form.summary,
    description: form.summary,
    current_state: form.current_state,
    proposed_change: form.proposed_change,
    why_it_matters: form.why_it_matters,
    body: form.body,
    notes: form.notes,
    tags: form.tags,
    status: form.status,
  };
}

function formatDate(value: string): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value: string): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function sortEntries(entries: IdeaEntry[]): IdeaEntry[] {
  return [...entries].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function truncateForProject(value: string, maxLength = 1400): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}...`;
}

function buildProjectSeedDescription(form: IdeaFormState, entries: IdeaEntry[]): string {
  const recentEntries = sortEntries(entries).slice(0, 5);
  const sections = [
    ['Summary', form.summary],
    ['Current State', form.current_state],
    ['Proposed Change', form.proposed_change],
    ['Why It Matters', form.why_it_matters],
    ['Working Body', truncateForProject(form.body, 2400)],
    ['Notes', form.notes],
  ];

  const lines = sections
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `## ${label}\n\n${value?.trim()}`);

  if (recentEntries.length > 0) {
    const entryLines = recentEntries.map(entry => {
      const title = entry.title || IDEA_ENTRY_TYPE_LABELS[entry.type];
      return `### ${title} (${IDEA_ENTRY_TYPE_LABELS[entry.type]}, ${formatDateTime(entry.created_at)})\n\n${truncateForProject(entry.content)}`;
    });
    lines.push(`## Recent Idea Entries\n\n${entryLines.join('\n\n')}`);
  }

  return lines.join('\n\n');
}

function ideaFromForm(idea: Idea, form: IdeaFormState): Idea {
  return {
    ...idea,
    title: form.title,
    summary: form.summary,
    description: form.summary,
    current_state: form.current_state,
    proposed_change: form.proposed_change,
    why_it_matters: form.why_it_matters,
    body: form.body,
    notes: form.notes,
    tags: form.tags,
    status: form.status,
  };
}

function parseIds(value: string): string[] {
  return value.split(',').map(id => id.trim()).filter(Boolean);
}

function serializeIds(ids: string[]): string {
  return Array.from(new Set(ids.filter(Boolean))).join(',');
}

export default function IdeaDetailPage() {
  const { ideaId } = useParams<{ ideaId: string }>();
  const navigate = useNavigate();

  const [idea, setIdea] = useState<Idea | null>(null);
  const [form, setForm] = useState<IdeaFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [entries, setEntries] = useState<IdeaEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entrySaving, setEntrySaving] = useState(false);
  const [newEntryTitle, setNewEntryTitle] = useState('');
  const [newEntryContent, setNewEntryContent] = useState('');
  const [newEntryType, setNewEntryType] = useState<IdeaEntryType>('note');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryTitle, setEditEntryTitle] = useState('');
  const [editEntryContent, setEditEntryContent] = useState('');
  const [editEntryType, setEditEntryType] = useState<IdeaEntryType>('note');
  const [allIdeas, setAllIdeas] = useState<Idea[]>([]);
  const [relationshipsLoading, setRelationshipsLoading] = useState(true);
  const [relationshipSaving, setRelationshipSaving] = useState(false);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [linkIdeaId, setLinkIdeaId] = useState('');
  const [generatedProject, setGeneratedProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectGenerating, setProjectGenerating] = useState(false);
  const [aiAction, setAiAction] = useState<IdeaWorkspaceAction | null>(null);
  const [aiLastAction, setAiLastAction] = useState<IdeaWorkspaceAction | null>(null);
  const [aiOutput, setAiOutput] = useState('');
  const [aiSavingOutput, setAiSavingOutput] = useState(false);
  const latestIdeaRef = useRef<Idea | null>(null);
  const latestFormRef = useRef<IdeaFormState | null>(null);
  const initialLoadCompleteRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const activeSavePromiseRef = useRef<Promise<Idea> | null>(null);
  const pendingAutosaveRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadIdea() {
      if (!ideaId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setInitialLoadComplete(false);
      initialLoadCompleteRef.current = false;
      setSaveState('idle');
      setDraftNotice(null);
      try {
        const loaded = await api.getIdea(ideaId);
        if (ignore) return;
        const serverForm = toFormState(loaded);
        const localDraft = readIdeaDraft(ideaId);
        const draftForm = localDraft ? normalizeDraftForm(localDraft.form, serverForm) : null;
        const shouldRestoreDraft =
          localDraft &&
          draftForm &&
          !formsEqual(draftForm, serverForm);

        setIdea(loaded);
        latestIdeaRef.current = loaded;

        if (shouldRestoreDraft) {
          setForm(draftForm);
          latestFormRef.current = draftForm;
          setSaveState('dirty');
          const notice = 'Restored a local draft. It will autosave when editing settles.';
          setDraftNotice(notice);
          toast(notice);
        } else {
          setForm(serverForm);
          latestFormRef.current = serverForm;
          if (localDraft) clearIdeaDraft(ideaId);
        }
      } catch (error) {
        if (ignore) return;
        setIdea(null);
        latestIdeaRef.current = null;
        setForm(null);
        latestFormRef.current = null;
        setSaveState('error');
        toast.error(error instanceof Error ? error.message : 'Failed to load idea');
      } finally {
        if (!ignore) {
          initialLoadCompleteRef.current = true;
          setInitialLoadComplete(true);
          setLoading(false);
        }
      }
    }

    loadIdea();
    return () => { ignore = true; };
  }, [ideaId]);

  useEffect(() => {
    let ignore = false;

    async function loadEntries() {
      if (!ideaId) {
        setEntries([]);
        setEntriesLoading(false);
        return;
      }
      setEntriesLoading(true);
      try {
        const loaded = await api.listIdeaEntries(ideaId);
        if (!ignore) setEntries(sortEntries(loaded));
      } catch (error) {
        if (!ignore) {
          setEntries([]);
          toast.error(error instanceof Error ? error.message : 'Failed to load entries');
        }
      } finally {
        if (!ignore) setEntriesLoading(false);
      }
    }

    loadEntries();
    return () => { ignore = true; };
  }, [ideaId]);

  useEffect(() => {
    let ignore = false;

    async function loadRelationships() {
      setRelationshipsLoading(true);
      try {
        const loaded = await api.listIdeas();
        if (!ignore) setAllIdeas(loaded);
      } catch (error) {
        if (!ignore) {
          setAllIdeas([]);
          toast.error(error instanceof Error ? error.message : 'Failed to load related ideas');
        }
      } finally {
        if (!ignore) setRelationshipsLoading(false);
      }
    }

    loadRelationships();
    return () => { ignore = true; };
  }, [ideaId]);

  useEffect(() => {
    let ignore = false;

    async function loadGeneratedProject() {
      if (!idea?.converted_project_id) {
        setGeneratedProject(null);
        setProjectLoading(false);
        return;
      }
      setProjectLoading(true);
      try {
        const project = await api.getProject(idea.converted_project_id);
        if (!ignore) setGeneratedProject(project);
      } catch {
        if (!ignore) setGeneratedProject(null);
      } finally {
        if (!ignore) setProjectLoading(false);
      }
    }

    loadGeneratedProject();
    return () => { ignore = true; };
  }, [idea?.converted_project_id]);

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

    const savePromise = api.updateIdea(currentIdea.id, buildUpdatePayload(formToSave));
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
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    await persistCurrentForm('manual');
  };

  const markIdeaUpdated = (updatedAt: string) => {
    setIdea(prev => {
      if (!prev) return prev;
      const next = { ...prev, updated_at: updatedAt };
      latestIdeaRef.current = next;
      return next;
    });
  };

  const handleCreateEntry = async () => {
    if (!ideaId || !newEntryContent.trim()) return;
    setEntrySaving(true);
    try {
      const entry = await api.createIdeaEntry(ideaId, {
        title: newEntryTitle.trim(),
        content: newEntryContent,
        type: newEntryType,
      });
      setEntries(prev => sortEntries([entry, ...prev]));
      setNewEntryTitle('');
      setNewEntryContent('');
      setNewEntryType('note');
      markIdeaUpdated(entry.updated_at);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create entry');
    } finally {
      setEntrySaving(false);
    }
  };

  const beginEditEntry = (entry: IdeaEntry) => {
    setEditingEntryId(entry.id);
    setEditEntryTitle(entry.title);
    setEditEntryContent(entry.content);
    setEditEntryType(entry.type);
  };

  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setEditEntryTitle('');
    setEditEntryContent('');
    setEditEntryType('note');
  };

  const handleUpdateEntry = async (entryId: string) => {
    if (!ideaId || !editEntryContent.trim()) return;
    setEntrySaving(true);
    try {
      const updated = await api.updateIdeaEntry(ideaId, entryId, {
        title: editEntryTitle.trim(),
        content: editEntryContent,
        type: editEntryType,
      });
      setEntries(prev => sortEntries(prev.map(entry => entry.id === entryId ? updated : entry)));
      cancelEditEntry();
      markIdeaUpdated(updated.updated_at);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update entry');
    } finally {
      setEntrySaving(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!ideaId) return;
    if (!window.confirm('Delete this entry?')) return;
    setEntrySaving(true);
    try {
      await api.deleteIdeaEntry(ideaId, entryId);
      setEntries(prev => prev.filter(entry => entry.id !== entryId));
      if (editingEntryId === entryId) cancelEditEntry();
      markIdeaUpdated(new Date().toISOString());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete entry');
    } finally {
      setEntrySaving(false);
    }
  };

  const refreshRelationshipIdea = (updated: Idea) => {
    setAllIdeas(prev => {
      const exists = prev.some(item => item.id === updated.id);
      return exists
        ? prev.map(item => item.id === updated.id ? updated : item)
        : [updated, ...prev];
    });
    if (updated.id === ideaId) {
      setIdea(updated);
      latestIdeaRef.current = updated;
    }
  };

  const handleCreateChildIdea = async () => {
    if (!ideaId || !newChildTitle.trim()) return;
    setRelationshipSaving(true);
    try {
      const child = await api.createIdea({
        title: newChildTitle.trim(),
        parent_idea_id: ideaId,
      });
      setNewChildTitle('');
      setAllIdeas(prev => [child, ...prev]);
      navigate(`/ideas/${child.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create child idea');
    } finally {
      setRelationshipSaving(false);
    }
  };

  const handleLinkIdea = async () => {
    if (!idea || !linkIdeaId || linkIdeaId === idea.id) return;
    const target = allIdeas.find(item => item.id === linkIdeaId);
    if (!target) return;
    setRelationshipSaving(true);
    try {
      const currentLinkedIds = serializeIds([...parseIds(idea.linked_idea_ids), target.id]);
      const targetLinkedIds = serializeIds([...parseIds(target.linked_idea_ids), idea.id]);
      const [updatedCurrent, updatedTarget] = await Promise.all([
        api.updateIdea(idea.id, { linked_idea_ids: currentLinkedIds }),
        api.updateIdea(target.id, { linked_idea_ids: targetLinkedIds }),
      ]);
      refreshRelationshipIdea(updatedCurrent);
      refreshRelationshipIdea(updatedTarget);
      setLinkIdeaId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to link idea');
    } finally {
      setRelationshipSaving(false);
    }
  };

  const handleUnlinkIdea = async (targetId: string) => {
    if (!idea) return;
    const target = allIdeas.find(item => item.id === targetId);
    setRelationshipSaving(true);
    try {
      const currentLinkedIds = serializeIds(parseIds(idea.linked_idea_ids).filter(id => id !== targetId));
      const updatedCurrent = await api.updateIdea(idea.id, { linked_idea_ids: currentLinkedIds });
      refreshRelationshipIdea(updatedCurrent);
      if (target) {
        const targetLinkedIds = serializeIds(parseIds(target.linked_idea_ids).filter(id => id !== idea.id));
        const updatedTarget = await api.updateIdea(target.id, { linked_idea_ids: targetLinkedIds });
        refreshRelationshipIdea(updatedTarget);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unlink idea');
    } finally {
      setRelationshipSaving(false);
    }
  };

  const handleGenerateProject = async () => {
    const currentIdea = latestIdeaRef.current;
    const currentForm = latestFormRef.current;
    if (!currentIdea || !currentForm || !currentForm.title.trim()) return;

    if (hasChanges) {
      const saved = await persistCurrentForm('manual');
      if (!saved) return;
    }

    setProjectGenerating(true);
    try {
      const project = await api.createProject({
        name: currentForm.title.trim(),
        description: buildProjectSeedDescription(currentForm, entries),
        status: 'planning',
        priority: 'medium',
        tags: currentForm.tags,
        source_idea_id: currentIdea.id,
      });
      const updatedIdea = await api.convertIdea(currentIdea.id, project.id);
      setGeneratedProject(project);
      setIdea(updatedIdea);
      latestIdeaRef.current = updatedIdea;
      const serverForm = toFormState(updatedIdea);
      setForm(serverForm);
      latestFormRef.current = serverForm;
      clearIdeaDraft(updatedIdea.id);
      setDraftNotice(null);
      setSaveState('saved');
      toast('Project generated from idea');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate project');
    } finally {
      setProjectGenerating(false);
    }
  };

  const handleRunAIAction = async (action: IdeaWorkspaceAction) => {
    if (!idea || !form) return;
    setAiAction(action);
    setAiLastAction(action);
    setAiOutput('');
    try {
      const currentIdea = ideaFromForm(idea, form);
      const relatedIdeas = allIdeas.filter(item => {
        if (item.id === currentIdea.id) return false;
        const linked = parseIds(currentIdea.linked_idea_ids).includes(item.id) || parseIds(item.linked_idea_ids).includes(currentIdea.id);
        const parent = item.id === currentIdea.parent_idea_id;
        const child = item.parent_idea_id === currentIdea.id;
        return linked || parent || child;
      });
      const result = await runIdeaWorkspaceAction(currentIdea, entries, relatedIdeas, action);
      setAiOutput(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI action failed');
    } finally {
      setAiAction(null);
    }
  };

  const handleSaveAIOutputAsEntry = async () => {
    if (!ideaId || !aiOutput.trim()) return;
    const action = AI_ACTIONS.find(item => item.action === aiLastAction);
    const title = action?.entryTitle || 'AI Workspace Output';
    setAiSavingOutput(true);
    try {
      const entry = await api.createIdeaEntry(ideaId, {
        title,
        content: aiOutput,
        type: 'note',
      });
      setEntries(prev => sortEntries([entry, ...prev]));
      markIdeaUpdated(entry.updated_at);
      toast('AI output saved as an entry');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save AI output');
    } finally {
      setAiSavingOutput(false);
    }
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

  const saveLabel = saveState === 'saving'
    ? 'Saving'
    : saveState === 'error'
      ? 'Error'
      : hasChanges
        ? 'Unsaved'
        : saveState === 'saved'
          ? 'Saved'
          : 'Saved';
  const saveStateClass = saveState === 'idle' ? 'saved' : saveState;

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
  const currentLinkedIds = parseIds(idea.linked_idea_ids);
  const linkedIdeas = allIdeas.filter(item => (
    item.id !== idea.id &&
    (currentLinkedIds.includes(item.id) || parseIds(item.linked_idea_ids).includes(idea.id))
  ));
  const childIdeas = allIdeas.filter(item => item.parent_idea_id === idea.id);
  const parentIdea = idea.parent_idea_id
    ? allIdeas.find(item => item.id === idea.parent_idea_id) || null
    : null;
  const linkableIdeas = allIdeas.filter(item => (
    item.id !== idea.id &&
    item.parent_idea_id !== idea.id &&
    !currentLinkedIds.includes(item.id) &&
    !parseIds(item.linked_idea_ids).includes(idea.id)
  ));

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
          <span className="idea-detail-route-kicker">Idea workspace</span>
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
          <span className={`idea-save-state idea-save-state-${saveStateClass}`}>{saveLabel}</span>
          <Button variant="outline" onClick={() => navigate('/ideas')}>Back</Button>
          <Button onClick={handleSave} disabled={!hasChanges || saveState === 'saving' || !form.title.trim()}>
            {saveState === 'saving' ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="idea-detail-layout">
        <section className="idea-detail-document">
          <Tabs defaultValue="body">
            <TabsList variant="line" className="idea-detail-tabs">
              <TabsTrigger value="body">Body</TabsTrigger>
              <TabsTrigger value="entries">Entries</TabsTrigger>
              <TabsTrigger value="relationships">Relationships</TabsTrigger>
              <TabsTrigger value="ai">AI Actions</TabsTrigger>
              <TabsTrigger value="proposal">Proposal</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="body" className="idea-detail-tab-content">
              <label className="idea-detail-doc-field">
                <span>Body</span>
                <Textarea
                  value={form.body}
                  onChange={event => updateForm('body', event.target.value)}
                  rows={24}
                  className="idea-body-textarea"
                  placeholder="Write freely in Markdown: drafts, research notes, examples, arguments, links, decisions, and deeper exploration."
                />
              </label>
              <p className="idea-detail-help">Markdown-friendly plain text. Autosaves after you pause typing.</p>
            </TabsContent>

            <TabsContent value="entries" className="idea-detail-tab-content">
              <div className="idea-entry-composer">
                <div className="idea-entry-composer-row">
                  <Input
                    value={newEntryTitle}
                    onChange={event => setNewEntryTitle(event.target.value)}
                    placeholder="Optional entry title"
                    className="idea-entry-title-input"
                  />
                  <Select value={newEntryType} onValueChange={value => setNewEntryType(value as IdeaEntryType)}>
                    <SelectTrigger className="idea-entry-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IDEA_ENTRY_TYPE_ORDER.map(type => (
                        <SelectItem key={type} value={type}>{IDEA_ENTRY_TYPE_LABELS[type]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  value={newEntryContent}
                  onChange={event => setNewEntryContent(event.target.value)}
                  rows={4}
                  placeholder="Add a follow-up, meeting note, research finding, objection, or decision."
                />
                <div className="idea-entry-composer-actions">
                  <Button onClick={handleCreateEntry} disabled={entrySaving || !newEntryContent.trim()}>
                    {entrySaving ? 'Saving...' : 'Add Entry'}
                  </Button>
                </div>
              </div>

              <div className="idea-entry-list">
                {entriesLoading ? (
                  <div className="idea-entry-empty">Loading entries...</div>
                ) : entries.length === 0 ? (
                  <div className="idea-entry-empty">No entries yet. Add a quick note when this idea changes.</div>
                ) : entries.map(entry => (
                  <article key={entry.id} className="idea-entry-card">
                    {editingEntryId === entry.id ? (
                      <div className="idea-entry-edit">
                        <div className="idea-entry-composer-row">
                          <Input
                            value={editEntryTitle}
                            onChange={event => setEditEntryTitle(event.target.value)}
                            placeholder="Optional entry title"
                            className="idea-entry-title-input"
                          />
                          <Select value={editEntryType} onValueChange={value => setEditEntryType(value as IdeaEntryType)}>
                            <SelectTrigger className="idea-entry-type-select"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {IDEA_ENTRY_TYPE_ORDER.map(type => (
                                <SelectItem key={type} value={type}>{IDEA_ENTRY_TYPE_LABELS[type]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Textarea
                          value={editEntryContent}
                          onChange={event => setEditEntryContent(event.target.value)}
                          rows={6}
                        />
                        <div className="idea-entry-actions">
                          <Button size="sm" onClick={() => handleUpdateEntry(entry.id)} disabled={entrySaving || !editEntryContent.trim()}>
                            {entrySaving ? 'Saving...' : 'Save Entry'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditEntry} disabled={entrySaving}>Cancel</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteEntry(entry.id)} disabled={entrySaving}>Delete</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="idea-entry-card-header">
                          <div>
                            <h3>{entry.title || IDEA_ENTRY_TYPE_LABELS[entry.type]}</h3>
                            <div className="idea-entry-meta">
                              <span>{IDEA_ENTRY_TYPE_LABELS[entry.type]}</span>
                              <span>{formatDateTime(entry.created_at)}</span>
                              {entry.updated_at !== entry.created_at && <span>Edited {formatDateTime(entry.updated_at)}</span>}
                            </div>
                          </div>
                          <div className="idea-entry-actions">
                            <Button size="sm" variant="ghost" onClick={() => beginEditEntry(entry)}>Edit</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteEntry(entry.id)} disabled={entrySaving}>Delete</Button>
                          </div>
                        </div>
                        <div className="idea-entry-content">{entry.content}</div>
                      </>
                    )}
                  </article>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="relationships" className="idea-detail-tab-content">
              <div className="idea-relationship-panel">
                <div className="idea-relationship-section">
                  <h3>Parent Idea</h3>
                  {idea.parent_idea_id ? (
                    parentIdea ? (
                      <Link to={`/ideas/${parentIdea.id}`} className="idea-related-row">
                        {parentIdea.title}
                      </Link>
                    ) : (
                      <div className="idea-entry-empty">Parent idea not found.</div>
                    )
                  ) : (
                    <div className="idea-entry-empty">This is a root idea.</div>
                  )}
                </div>

                <div className="idea-relationship-section">
                  <div className="idea-relationship-heading">
                    <h3>Child Ideas</h3>
                    <span>{childIdeas.length}</span>
                  </div>
                  <div className="idea-relationship-create">
                    <Input
                      value={newChildTitle}
                      onChange={event => setNewChildTitle(event.target.value)}
                      placeholder="New child idea title"
                    />
                    <Button onClick={handleCreateChildIdea} disabled={relationshipSaving || !newChildTitle.trim()}>
                      Create Child
                    </Button>
                  </div>
                  {relationshipsLoading ? (
                    <div className="idea-entry-empty">Loading child ideas...</div>
                  ) : childIdeas.length === 0 ? (
                    <div className="idea-entry-empty">No child ideas yet.</div>
                  ) : (
                    <div className="idea-relationship-list">
                      {childIdeas.map(child => (
                        <Link key={child.id} to={`/ideas/${child.id}`} className="idea-related-row">
                          {child.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <div className="idea-relationship-section">
                  <div className="idea-relationship-heading">
                    <h3>Linked Ideas</h3>
                    <span>{linkedIdeas.length}</span>
                  </div>
                  <div className="idea-relationship-create">
                    <Select value={linkIdeaId || 'none'} onValueChange={value => setLinkIdeaId(value === 'none' ? '' : value)}>
                      <SelectTrigger className="idea-link-select"><SelectValue placeholder="Choose an idea" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Choose an idea</SelectItem>
                        {linkableIdeas.map(candidate => (
                          <SelectItem key={candidate.id} value={candidate.id}>{candidate.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleLinkIdea} disabled={relationshipSaving || !linkIdeaId}>
                      Link Idea
                    </Button>
                  </div>
                  {relationshipsLoading ? (
                    <div className="idea-entry-empty">Loading linked ideas...</div>
                  ) : linkedIdeas.length === 0 ? (
                    <div className="idea-entry-empty">No linked ideas yet.</div>
                  ) : (
                    <div className="idea-relationship-list">
                      {linkedIdeas.map(linked => (
                        <div key={linked.id} className="idea-relationship-row">
                          <Link to={`/ideas/${linked.id}`} className="idea-relationship-link">
                            {linked.title}
                          </Link>
                          <Button size="sm" variant="ghost" onClick={() => handleUnlinkIdea(linked.id)} disabled={relationshipSaving}>
                            Unlink
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ai" className="idea-detail-tab-content">
              <div className="idea-ai-panel">
                <div className="idea-ai-intro">
                  <h3>AI Actions</h3>
                  <p>Run focused actions against the current idea, including body, proposal fields, entries, and related ideas.</p>
                </div>

                {!isAIConfigured() ? (
                  <div className="idea-entry-empty">
                    AI is not configured. Add an API key in Settings to enable these actions.
                  </div>
                ) : (
                  <>
                    <div className="idea-ai-action-grid">
                      {AI_ACTIONS.map(item => (
                        <Button
                          key={item.action}
                          variant="outline"
                          onClick={() => handleRunAIAction(item.action)}
                          disabled={!!aiAction || aiSavingOutput}
                        >
                          {aiAction === item.action ? 'Working...' : item.label}
                        </Button>
                      ))}
                    </div>

                    <label className="idea-detail-doc-field">
                      <span>Output</span>
                      <Textarea
                        value={aiOutput}
                        onChange={event => setAiOutput(event.target.value)}
                        rows={14}
                        placeholder="AI output will appear here. Edit it before saving if needed."
                      />
                    </label>

                    <div className="idea-ai-output-actions">
                      <Button
                        onClick={handleSaveAIOutputAsEntry}
                        disabled={!aiOutput.trim() || aiSavingOutput || !!aiAction}
                      >
                        {aiSavingOutput ? 'Saving...' : 'Save Output as Entry'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="proposal" className="idea-detail-tab-content">
              <label className="idea-detail-doc-field">
                <span>Summary</span>
                <Textarea
                  value={form.summary}
                  onChange={event => updateForm('summary', event.target.value)}
                  rows={3}
                  placeholder="Short, scan-friendly description for cards and lists."
                />
              </label>

              <label className="idea-detail-doc-field">
                <span>Current State</span>
                <Textarea
                  value={form.current_state}
                  onChange={event => updateForm('current_state', event.target.value)}
                  rows={5}
                  placeholder="Describe the problem, opportunity, gap, or current workflow this idea responds to."
                />
              </label>

              <label className="idea-detail-doc-field">
                <span>Proposed Change</span>
                <Textarea
                  value={form.proposed_change}
                  onChange={event => updateForm('proposed_change', event.target.value)}
                  rows={5}
                  placeholder="Describe the recommendation or change this idea proposes."
                />
              </label>

              <label className="idea-detail-doc-field">
                <span>Why It Matters</span>
                <Textarea
                  value={form.why_it_matters}
                  onChange={event => updateForm('why_it_matters', event.target.value)}
                  rows={4}
                  placeholder="Capture the business value, risk, relevance, or reason to prioritize this."
                />
              </label>
            </TabsContent>

            <TabsContent value="notes" className="idea-detail-tab-content">
              <label className="idea-detail-doc-field">
                <span>Notes</span>
                <Textarea
                  value={form.notes}
                  onChange={event => updateForm('notes', event.target.value)}
                  rows={12}
                  placeholder="Less-structured thinking, rough context, alternatives, caveats, and open questions."
                />
              </label>
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
              <div><span>Created</span><strong>{formatDate(idea.created_at)}</strong></div>
              <div><span>Updated</span><strong>{formatDate(idea.updated_at)}</strong></div>
              <div><span>Children</span><strong>{childIdeas.length}</strong></div>
              <div><span>Linked</span><strong>{linkedIdeas.length}</strong></div>
            </div>
          </div>

          <div className="idea-metadata-card">
            <h3>Project Seed</h3>
            {idea.converted_project_id ? (
              projectLoading ? (
                <div className="idea-project-seed-note">Loading generated project...</div>
              ) : (
                <Link to={`/projects/${idea.converted_project_id}`} className="idea-project-seed-link">
                  {generatedProject?.name || 'Generated project'}
                </Link>
              )
            ) : (
              <>
                <p className="idea-project-seed-note">
                  Create a planning project from this idea's structured fields, body, notes, and recent entries.
                </p>
                <Button
                  className="w-full"
                  onClick={handleGenerateProject}
                  disabled={projectGenerating || saveState === 'saving' || !form.title.trim()}
                >
                  {projectGenerating ? 'Generating...' : 'Generate Project'}
                </Button>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
