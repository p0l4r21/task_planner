import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Milestone, Project, Task, ProjectHealth, ProjectWithHealth } from '../types';
import { PROJECT_STATUS_LABELS, PRIORITY_LABELS } from '../types';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { isAIConfigured, summarizeProject } from '../lib/ai';
import type { PlannerDrawerState } from './PlannerDrawer';

interface ProjectsViewProps {
  projects: Project[];
  tasks: Task[];
  milestonesByProject: Record<string, Milestone[]>;
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onSetDrawerState: (state: PlannerDrawerState) => void;
}

function computeHealth(
  project: Project,
  tasks: Task[],
  milestones: Milestone[],
): ProjectWithHealth {
  const projectTasks = tasks.filter(t => t.project_id === project.id);
  const completedTasks = projectTasks.filter(t => t.bucket === 'completed');
  const completedMs = milestones.filter(m => m.status === 'completed');
  const today = new Date().toISOString().slice(0, 10);
  const overdueMs = milestones.filter(
    m => m.status !== 'completed' && m.due_date && m.due_date.slice(0, 10) < today,
  );
  const nextMs = [...milestones]
    .filter(m => m.status !== 'completed' && m.due_date)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))[0];
  const progressPercent = milestones.length
    ? Math.round((completedMs.length / milestones.length) * 100)
    : 0;

  let health: ProjectHealth = 'unknown';
  if (project.status === 'completed') {
    health = 'on_track';
  } else if (overdueMs.length > 2 || (project.target_end_date && project.target_end_date.slice(0, 10) < today)) {
    health = 'off_track';
  } else if (overdueMs.length > 0 || projectTasks.some(t => t.bucket === 'blocked')) {
    health = 'at_risk';
  } else if (milestones.length > 0 || projectTasks.length > 0) {
    health = 'on_track';
  }

  return {
    ...project,
    health,
    taskCount: projectTasks.length,
    completedTaskCount: completedTasks.length,
    milestoneCount: milestones.length,
    completedMilestoneCount: completedMs.length,
    overdueMilestoneCount: overdueMs.length,
    progressPercent,
    nextMilestoneDue: nextMs?.due_date?.slice(0, 10) || null,
  };
}

const STATUS_ORDER: string[] = ['active', 'planning', 'on_hold', 'completed'];

export default function ProjectsView({
  projects,
  tasks,
  milestonesByProject,
  selectedProjectId,
  onSelectProject,
  onSetDrawerState,
}: ProjectsViewProps) {
  const enrichedProjects = useMemo(() => {
    return projects
      .map(p => computeHealth(p, tasks, milestonesByProject[p.id] || []))
      .sort((a, b) => {
        const si = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
        if (si !== 0) return si;
        return a.name.localeCompare(b.name);
      });
  }, [projects, tasks, milestonesByProject]);

  const activeCount = enrichedProjects.filter(p => p.status === 'active').length;
  const atRiskCount = enrichedProjects.filter(p => p.health === 'at_risk' || p.health === 'off_track').length;

  return (
    <div className="projects-view">
      <div className="projects-view-summary">
        <span>{enrichedProjects.length} project{enrichedProjects.length !== 1 ? 's' : ''}</span>
        <span className="projects-view-sep">·</span>
        <span>{activeCount} active</span>
        {atRiskCount > 0 && (
          <>
            <span className="projects-view-sep">·</span>
            <span className="projects-view-risk">{atRiskCount} at risk</span>
          </>
        )}
        <Button
          variant="outline"
          size="xs"
          className="ml-auto"
          onClick={() => onSetDrawerState({ type: 'project-create' })}
        >
          + Project
        </Button>
      </div>
      <div className="projects-view-grid">
        {enrichedProjects.map(p => (
          <ProjectCard
            key={p.id}
            project={p}
            isSelected={p.id === selectedProjectId}
            onSelect={() => onSelectProject(p.id)}
            onEdit={() => onSetDrawerState({ type: 'project-edit', project: p })}
          />
        ))}
        {enrichedProjects.length === 0 && (
          <div className="projects-view-empty">
            No projects yet. Create one to start planning.
          </div>
        )}
      </div>
    </div>
  );
}

const HEALTH_COLORS: Record<ProjectHealth, string> = {
  on_track: '#4ade80',
  at_risk: '#f59e0b',
  off_track: '#ef4444',
  unknown: '#71717a',
};

function ProjectCard({
  project,
  isSelected,
  onSelect,
  onEdit,
}: {
  project: ProjectWithHealth;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const aiReady = isAIConfigured();

  const handleSummarize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!aiReady) return;
    setLoadingSummary(true);
    try {
      const summary = await summarizeProject(project, [], project.milestoneCount);
      setAiSummary(summary);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <article
      className={`project-card-rich${isSelected ? ' project-card-selected' : ''}`}
      onClick={onSelect}
    >
      <div className="project-card-rich-header">
        <div className="project-card-rich-title-row">
          <span
            className="project-card-health-dot"
            style={{ background: HEALTH_COLORS[project.health] }}
            title={project.health.replace('_', ' ')}
          />
          <span className="project-card-rich-name">{project.name}</span>
        </div>
        <span className={`planner-project-status planner-project-status-${project.status}`}>
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
      </div>

      {project.description && (
        <p className="project-card-rich-desc">{project.description}</p>
      )}

      {aiSummary && (
        <p className="project-card-ai-summary">{aiSummary}</p>
      )}

      <div className="project-card-rich-metrics">
        <div className="project-card-rich-metric">
          <span>{project.milestoneCount}</span>
          <label>milestones</label>
        </div>
        <div className="project-card-rich-metric">
          <span>{project.taskCount}</span>
          <label>tasks</label>
        </div>
        <div className="project-card-rich-metric">
          <span>{project.progressPercent}%</span>
          <label>progress</label>
        </div>
      </div>

      <Progress value={project.progressPercent} className="h-1.5" />

      <div className="project-card-rich-footer">
        <span className={`priority-badge priority-${project.priority}`}>
          {PRIORITY_LABELS[project.priority]}
        </span>
        {project.nextMilestoneDue && (
          <span className="project-card-rich-date">
            Next: {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
              new Date(`${project.nextMilestoneDue}T00:00:00`),
            )}
          </span>
        )}
        {project.overdueMilestoneCount > 0 && (
          <span className="project-card-rich-overdue">
            {project.overdueMilestoneCount} overdue
          </span>
        )}
        <div className="project-card-rich-actions">
          {aiReady && !aiSummary && (
            <Button variant="ghost" size="xs" onClick={handleSummarize} disabled={loadingSummary}>
              {loadingSummary ? '…' : 'AI'}
            </Button>
          )}
          <Button variant="ghost" size="xs" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            Edit
          </Button>
        </div>
      </div>
    </article>
  );
}
