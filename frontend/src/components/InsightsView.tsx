import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Idea, Milestone, Project, Task, ProjectHealth } from '../types';
import { api } from '../api';
import { isAIConfigured, generatePlannerInsights, identifyProjectRisks, type PlannerInsight, type ProjectRisk } from '../lib/ai';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface InsightsViewProps {
  projects: Project[];
  tasks: Task[];
  milestonesByProject: Record<string, Milestone[]>;
}

export default function InsightsView({ projects, tasks, milestonesByProject }: InsightsViewProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [aiInsights, setAiInsights] = useState<PlannerInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [riskProject, setRiskProject] = useState<string | null>(null);
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [loadingRisks, setLoadingRisks] = useState(false);
  const aiReady = isAIConfigured();

  useEffect(() => {
    let cancelled = false;
    api.listIdeas().then(data => { if (!cancelled) setIdeas(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  // Stalled projects — active but no tasks
  const stalledProjects = useMemo(() => {
    return projects.filter(p => {
      if (p.status !== 'active') return false;
      return tasks.filter(t => t.project_id === p.id).length === 0;
    });
  }, [projects, tasks]);

  // Overdue milestones across all projects
  const overdueMilestones = useMemo(() => {
    const result: { milestone: Milestone; projectName: string }[] = [];
    for (const project of projects) {
      const ms = milestonesByProject[project.id] || [];
      for (const m of ms) {
        if (m.status !== 'completed' && m.due_date && m.due_date.slice(0, 10) < today) {
          result.push({ milestone: m, projectName: project.name });
        }
      }
    }
    return result.sort((a, b) => (a.milestone.due_date || '').localeCompare(b.milestone.due_date || ''));
  }, [projects, milestonesByProject, today]);

  // Project health overview
  const healthSummary = useMemo(() => {
    const counts: Record<ProjectHealth, number> = { on_track: 0, at_risk: 0, off_track: 0, unknown: 0 };
    for (const p of projects) {
      if (p.status === 'completed') { counts.on_track++; continue; }
      const ms = milestonesByProject[p.id] || [];
      const odMs = ms.filter(m => m.status !== 'completed' && m.due_date && m.due_date.slice(0, 10) < today);
      const blocked = tasks.filter(t => t.project_id === p.id && t.bucket === 'blocked');
      if (odMs.length > 2 || (p.target_end_date && p.target_end_date.slice(0, 10) < today)) {
        counts.off_track++;
      } else if (odMs.length > 0 || blocked.length > 0) {
        counts.at_risk++;
      } else if (ms.length > 0 || tasks.filter(t => t.project_id === p.id).length > 0) {
        counts.on_track++;
      } else {
        counts.unknown++;
      }
    }
    return counts;
  }, [projects, tasks, milestonesByProject, today]);

  // Blocked tasks
  const blockedTasks = useMemo(() => tasks.filter(t => t.bucket === 'blocked'), [tasks]);

  // Unlinked ideas
  const unlinkedIdeas = useMemo(
    () => ideas.filter(i => i.status !== 'archived' && i.status !== 'converted' && !i.linked_project_ids),
    [ideas],
  );

  const fetchAI = useCallback(async () => {
    if (!aiReady) return;
    setLoading(true);
    try {
      const result = await generatePlannerInsights(projects, tasks, ideas);
      setAiInsights(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  }, [aiReady, projects, tasks, ideas]);

  const fetchRisks = useCallback(async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !aiReady) return;
    setRiskProject(projectId);
    setLoadingRisks(true);
    try {
      const projectTasks = tasks.filter(t => t.project_id === projectId);
      const ms = milestonesByProject[projectId] || [];
      const odMs = ms.filter(m => m.status !== 'completed' && m.due_date && m.due_date.slice(0, 10) < today);
      const result = await identifyProjectRisks(project, projectTasks, odMs.length);
      setRisks(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to identify risks');
    } finally {
      setLoadingRisks(false);
    }
  }, [aiReady, projects, tasks, milestonesByProject, today]);

  const totalMs = Object.values(milestonesByProject).flat().length;
  const completedMs = Object.values(milestonesByProject).flat().filter(m => m.status === 'completed').length;
  const overallProgress = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;

  return (
    <div className="insights-view">
      {/* Portfolio health strip */}
      <div className="insights-view-health-strip">
        <div className="insights-view-health-item">
          <span className="health-dot" style={{ background: '#4ade80' }} />
          <strong>{healthSummary.on_track}</strong>
          <label>On Track</label>
        </div>
        <div className="insights-view-health-item">
          <span className="health-dot" style={{ background: '#f59e0b' }} />
          <strong>{healthSummary.at_risk}</strong>
          <label>At Risk</label>
        </div>
        <div className="insights-view-health-item">
          <span className="health-dot" style={{ background: '#ef4444' }} />
          <strong>{healthSummary.off_track}</strong>
          <label>Off Track</label>
        </div>
        <div className="insights-view-progress">
          <span>{overallProgress}% milestones complete</span>
          <Progress value={overallProgress} className="h-1.5 flex-1" />
        </div>
      </div>

      <div className="insights-view-grid">
        {/* Overdue milestones */}
        <section className="insights-view-card">
          <h4>Overdue Milestones <span className="insights-view-badge">{overdueMilestones.length}</span></h4>
          {overdueMilestones.length === 0 && <p className="insights-view-empty">All milestones are on schedule.</p>}
          {overdueMilestones.slice(0, 8).map(({ milestone, projectName }) => (
            <div key={milestone.id} className="insights-view-row">
              <span className="insights-view-row-dot overdue" />
              <span className="insights-view-row-title">{milestone.title}</span>
              <span className="insights-view-row-meta">{projectName}</span>
              <span className="insights-view-row-date">{milestone.due_date?.slice(0, 10)}</span>
            </div>
          ))}
        </section>

        {/* Stalled projects */}
        <section className="insights-view-card">
          <h4>Stalled Projects <span className="insights-view-badge">{stalledProjects.length}</span></h4>
          {stalledProjects.length === 0 && <p className="insights-view-empty">All active projects have tasks.</p>}
          {stalledProjects.map(p => (
            <div key={p.id} className="insights-view-row">
              <span className="insights-view-row-dot stalled" />
              <span className="insights-view-row-title">{p.name}</span>
              <span className="insights-view-row-meta">{p.status}</span>
            </div>
          ))}
        </section>

        {/* Blocked tasks */}
        <section className="insights-view-card">
          <h4>Blocked Tasks <span className="insights-view-badge">{blockedTasks.length}</span></h4>
          {blockedTasks.length === 0 && <p className="insights-view-empty">No blocked tasks.</p>}
          {blockedTasks.slice(0, 8).map(t => (
            <div key={t.id} className="insights-view-row">
              <span className="insights-view-row-dot blocked" />
              <span className="insights-view-row-title">{t.title}</span>
              <span className="insights-view-row-meta">{t.project || 'No project'}</span>
            </div>
          ))}
        </section>

        {/* Unlinked ideas */}
        <section className="insights-view-card">
          <h4>Unlinked Ideas <span className="insights-view-badge">{unlinkedIdeas.length}</span></h4>
          {unlinkedIdeas.length === 0 && <p className="insights-view-empty">All active ideas are linked.</p>}
          {unlinkedIdeas.slice(0, 6).map(i => (
            <div key={i.id} className="insights-view-row">
              <span className="insights-view-row-dot idea" />
              <span className="insights-view-row-title">{i.title}</span>
              <span className="insights-view-row-meta">{i.status}</span>
            </div>
          ))}
        </section>
      </div>

      {/* AI section */}
      <section className="insights-view-ai">
        <div className="insights-view-ai-header">
          <span className="insights-badge-ai">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
            AI Insights
          </span>
          {aiReady && (
            <Button variant="ghost" size="sm" onClick={fetchAI} disabled={loading} className="text-xs">
              {loading ? 'Generating…' : aiInsights.length ? 'Refresh' : 'Generate'}
            </Button>
          )}
        </div>
        {!aiReady && <p className="insights-view-empty">Add an OpenAI API key in Settings to unlock AI insights.</p>}
        {aiInsights.map((insight, i) => (
          <div key={i} className="insight-card">
            <div className="insight-card-title">{insight.title}</div>
            <div className="insight-card-body">{insight.body}</div>
          </div>
        ))}

        {/* Project risk analysis */}
        {aiReady && projects.filter(p => p.status !== 'completed').length > 0 && (
          <div className="insights-view-risk-section">
            <h4>Risk Analysis</h4>
            <div className="insights-view-risk-projects">
              {projects.filter(p => p.status !== 'completed').map(p => (
                <Button
                  key={p.id}
                  variant={riskProject === p.id ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => fetchRisks(p.id)}
                  disabled={loadingRisks}
                >
                  {p.name}
                </Button>
              ))}
            </div>
            {loadingRisks && <p className="insights-view-empty">Analyzing…</p>}
            {risks.length > 0 && !loadingRisks && (
              <div className="insights-view-risks">
                {risks.map((r, i) => (
                  <div key={i} className="insights-view-risk-card">
                    <div className="insights-view-risk-title">{r.risk}</div>
                    {r.mitigation && <div className="insights-view-risk-mitigation">{r.mitigation}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
