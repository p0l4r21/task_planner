import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Idea, Project, Task } from '../types';
import { api } from '../api';
import { isAIConfigured, generatePlannerInsights, type PlannerInsight } from '../lib/ai';
import { Button } from '@/components/ui/button';

interface InsightsPanelProps {
  projects: Project[];
  tasks: Task[];
}

export default function InsightsPanel({ projects, tasks }: InsightsPanelProps) {
  const [insights, setInsights] = useState<PlannerInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideasLoaded, setIdeasLoaded] = useState(false);
  const aiReady = isAIConfigured();

  // Lazy-load ideas only once, only when panel is rendered
  useEffect(() => {
    let cancelled = false;
    api.listIdeas().then(data => {
      if (!cancelled) { setIdeas(data); setIdeasLoaded(true); }
    }).catch(() => { if (!cancelled) setIdeasLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const fetchInsights = useCallback(async () => {
    if (!aiReady) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generatePlannerInsights(projects, tasks, ideas);
      setInsights(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate insights.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [aiReady, projects, tasks, ideas]);

  // Static insights when AI is not configured
  const staticInsights = useStaticInsights(projects, tasks, ideas);

  const displayInsights = aiReady ? insights : staticInsights;

  return (
    <div className="insights-panel">
      <div className="insights-header">
        <div className="insights-header-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="insights-icon">
            <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-1v4a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-4H8a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z"/>
          </svg>
          <span className="insights-title">Insights</span>
          {aiReady && (
            <span className="insights-badge-ai">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
              ChatGPT
            </span>
          )}
        </div>
        {aiReady && (
          <Button variant="ghost" size="sm" onClick={fetchInsights} disabled={loading} className="text-xs">
            {loading ? 'Generating…' : insights.length ? 'Refresh' : 'Generate'}
          </Button>
        )}
      </div>

      <div className="insights-body">
        {error && <p className="insights-error">{error}</p>}
        {displayInsights.length === 0 && !loading && (
          <p className="insights-empty">
            {aiReady
              ? 'Click Generate to get AI-powered insights about your workspace.'
              : 'Add an OpenAI API key in Settings to unlock AI insights.'}
          </p>
        )}
        {displayInsights.map((insight, i) => (
          <div key={i} className="insight-card">
            <div className="insight-card-title">{insight.title}</div>
            <div className="insight-card-body">{insight.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Generate basic static insights from planner data when AI is not configured. */
function useStaticInsights(projects: Project[], tasks: Task[], ideas: Idea[]): PlannerInsight[] {
  return useMemo(() => {
    const result: PlannerInsight[] = [];

    // Captured ideas count
    const captured = ideas.filter(i => i.status === 'captured').length;
    if (captured > 0) {
      result.push({
        title: `${captured} idea${captured > 1 ? 's' : ''} waiting`,
        body: `You have ${captured} captured idea${captured > 1 ? 's' : ''} that could be explored or linked to active work.`,
      });
    }

    // Active projects without recent tasks
    const activeProjects = projects.filter(p => p.status === 'active');
    if (activeProjects.length > 0 && tasks.length === 0) {
      result.push({
        title: 'Active projects with no tasks',
        body: 'Some active projects may need tasks to make progress.',
      });
    }

    // Ideas that match project names (potential duplicates/connections)
    for (const idea of ideas.slice(0, 5)) {
      const match = projects.find(p =>
        p.name.toLowerCase().includes(idea.title.toLowerCase()) ||
        idea.title.toLowerCase().includes(p.name.toLowerCase())
      );
      if (match && !idea.linked_project_ids?.includes(match.id)) {
        result.push({
          title: `Idea may relate to "${match.name}"`,
          body: `"${idea.title}" looks similar to project "${match.name}". Consider linking them.`,
        });
        break; // Only show one of these
      }
    }

    if (result.length === 0 && (projects.length > 0 || ideas.length > 0)) {
      result.push({
        title: 'Your workspace is looking clean',
        body: 'Keep capturing ideas and linking them to projects for a structured planning workflow.',
      });
    }

    return result;
  }, [projects, tasks, ideas]);
}
