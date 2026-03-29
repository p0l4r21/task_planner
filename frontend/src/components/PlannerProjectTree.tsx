import { useMemo, useState } from 'react';
import type { Milestone, Project, Task } from '../types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(iso: string): boolean {
  return new Date(iso + 'T00:00:00') < new Date(new Date().toDateString());
}

function isDueSoon(iso: string): boolean {
  const due = new Date(iso + 'T00:00:00');
  const now = new Date(new Date().toDateString());
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 3;
}

function sortByDueDate(a: Milestone, b: Milestone): number {
  if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return a.title.localeCompare(b.title);
}

export type SelectionMode =
  | null
  | { type: 'add-sub' }      // select a major milestone as parent
  | { type: 'edit' };        // select any milestone to edit

interface Props {
  projects: Project[];
  milestonesByProject: Record<string, Milestone[]>;
  tasks: Task[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateTask: (projectId?: string, parentMilestoneId?: string | null) => void;
  onCreateMilestone: (projectId: string, parentMilestoneId?: string | null) => void;
  onEditProject: (project: Project) => void;
  onEditMilestone: (milestone: Milestone) => void;
  selectionMode?: SelectionMode;
  onMilestoneSelected?: (milestone: Milestone) => void;
  variant?: 'default' | 'embedded' | 'tree-only';
}

export default function PlannerProjectTree({
  projects,
  milestonesByProject,
  tasks,
  selectedProjectId,
  onSelectProject,
  onCreateTask,
  onCreateMilestone,
  onEditProject,
  onEditMilestone,
  selectionMode = null,
  onMilestoneSelected,
  variant = 'default',
}: Props) {
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      const projectId = task.project_id;
      if (!projectId) continue;
      counts[projectId] = (counts[projectId] || 0) + 1;
    }
    return counts;
  }, [tasks]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: prev[projectId] === undefined ? true : !prev[projectId],
    }));
  };

  const toggleMilestone = (milestoneId: string, defaultExpanded: boolean) => {
    setExpandedMilestones(prev => ({
      ...prev,
      [milestoneId]: !(prev[milestoneId] ?? defaultExpanded),
    }));
  };

  if (projects.length === 0) {
    return (
      <div className="planner-empty-state">
        <p>No active projects yet.</p>
        <Button variant="default" size="sm" onClick={() => onCreateTask()}>Quick task</Button>
      </div>
    );
  }

  return (
    <div className="planner-project-tree">
      {projects.map(project => {
        const isEmbedded = variant === 'embedded';
        const milestones = milestonesByProject[project.id] || [];
        const activeMilestones = milestones.filter(m => m.status !== 'archived');
        const completed = activeMilestones.filter(milestone => milestone.status === 'completed').length;
        const progress = activeMilestones.length ? Math.round((completed / activeMilestones.length) * 100) : 0;
        const isExpanded = expandedProjects[project.id] ?? project.id === selectedProjectId;
        const rootMilestones = activeMilestones
          .filter(milestone => !milestone.parent_milestone_id)
          .sort(sortByDueDate);

        const today = new Date(new Date().toDateString());
        const nextDueDate = activeMilestones
          .filter(m => m.status !== 'completed' && m.due_date && new Date(m.due_date.slice(0, 10) + 'T00:00:00') >= today)
          .map(m => m.due_date!.slice(0, 10))
          .sort()[0] || null;

        const milestoneTree = (
          <div className="planner-project-milestones">
            {rootMilestones.length === 0 ? (
              <div className="planner-project-empty">No milestones yet.</div>
            ) : (
              rootMilestones.map(milestone => (
                <MilestoneBranch
                  key={milestone.id}
                  milestone={milestone}
                  milestones={activeMilestones}
                  expandedMilestones={expandedMilestones}
                  onToggle={toggleMilestone}
                  selectionMode={selectionMode}
                  onMilestoneSelected={onMilestoneSelected}
                  nextDueDate={nextDueDate}
                />
              ))
            )}
          </div>
        );

        if (variant === 'tree-only') {
          return <div key={project.id}>{milestoneTree}</div>;
        }

        return (
          <Card
            key={project.id}
            className={`planner-project-card rounded-none ring-0 bg-transparent border-b border-border/20 py-3.5 px-3.5${selectedProjectId === project.id ? ' bg-white/[0.03]' : ''}${isEmbedded ? ' border-none p-0' : ''}`}
          >
            {!isEmbedded ? (
              <button
                className="planner-project-header"
                type="button"
                onClick={() => {
                  onSelectProject(project.id);
                  toggleProject(project.id);
                }}
              >
                <div className="planner-project-header-copy">
                  <div className="planner-project-title-row">
                    <span className="planner-project-title">{project.name}</span>
                    <span className={`planner-project-status planner-project-status-${project.status}`}>
                      {project.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="planner-project-meta-row">
                    <span>{taskCounts[project.id] || 0} active tasks</span>
                    <span>{completed}/{activeMilestones.length || 0} milestones</span>
                  </div>
                </div>
                <span className="planner-project-toggle">{isExpanded ? '−' : '+'}</span>
              </button>
            ) : (
              <div className="planner-project-embedded-head">
                <div className="planner-project-meta-row">
                  <span>{taskCounts[project.id] || 0} active tasks</span>
                  <span>{completed}/{activeMilestones.length || 0} milestones</span>
                </div>
                <div className="planner-project-actions embedded">
                  <Button variant="secondary" size="xs" onClick={() => onCreateTask(project.id, null)}>Task</Button>
                  <Button variant="ghost" size="xs" onClick={() => onCreateMilestone(project.id, null)}>Milestone</Button>
                  <Button variant="ghost" size="xs" onClick={() => onEditProject(project)}>Edit</Button>
                </div>
              </div>
            )}

            {!isEmbedded && (
              <div className="planner-project-progress flex items-center gap-2.5 text-xs text-muted-foreground">
                <Progress value={progress} className="h-1.5 flex-1" />
                <span>{progress}% mapped</span>
              </div>
            )}

            {!isEmbedded && (
              <div className="planner-project-actions">
                <Button variant="secondary" size="xs" onClick={() => onCreateTask(project.id, null)}>Task</Button>
                <Button variant="ghost" size="xs" onClick={() => onCreateMilestone(project.id, null)}>Milestone</Button>
                <Button variant="ghost" size="xs" onClick={() => onEditProject(project)}>Edit</Button>
              </div>
            )}

            {isExpanded && milestoneTree}
          </Card>
        );
      })}
    </div>
  );
}

interface MilestoneBranchProps {
  milestone: Milestone;
  milestones: Milestone[];
  expandedMilestones: Record<string, boolean>;
  onToggle: (milestoneId: string, defaultExpanded: boolean) => void;
  selectionMode: SelectionMode;
  onMilestoneSelected?: (milestone: Milestone) => void;
  nextDueDate: string | null;
}

function isValidTarget(mode: SelectionMode, milestone: Milestone): boolean {
  if (!mode) return false;
  if (mode.type === 'edit') return true;
  if (mode.type === 'add-sub') return milestone.is_major;
  return false;
}

function MilestoneBranch({
  milestone,
  milestones,
  expandedMilestones,
  onToggle,
  selectionMode,
  onMilestoneSelected,
  nextDueDate,
}: MilestoneBranchProps) {
  const children = milestones
    .filter(candidate => candidate.parent_milestone_id === milestone.id)
    .sort(sortByDueDate);
  const isExpanded = expandedMilestones[milestone.id] ?? milestone.is_major;
  const hasChildren = children.length > 0;
  const isMajor = milestone.is_major;
  const validTarget = isValidTarget(selectionMode, milestone);
  const inSelectionMode = selectionMode !== null;

  const handleRowClick = () => {
    if (inSelectionMode) {
      if (validTarget && onMilestoneSelected) {
        onMilestoneSelected(milestone);
      }
      return;
    }
    if (hasChildren) {
      onToggle(milestone.id, milestone.is_major);
    }
  };

  const dateStr = milestone.due_date?.slice(0, 10) || '';
  const overdue = dateStr && milestone.status !== 'completed' && isOverdue(dateStr);
  const dueSoon = dateStr && milestone.status !== 'completed' && isDueSoon(dateStr);
  const isNextUp = !overdue && milestone.status !== 'completed' && dateStr && nextDueDate && dateStr === nextDueDate;
  // Major: always show date. Sub: only on hover, overdue, or due-soon (via CSS)
  const showDateAlways = isMajor || overdue || dueSoon;

  const rowClassName = [
    'planner-milestone-row',
    isMajor ? 'major' : 'sub',
    hasChildren ? 'has-children' : '',
    inSelectionMode && validTarget ? 'selectable' : '',
    inSelectionMode && !validTarget ? 'disabled' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="planner-milestone-branch">
      <div
        className={rowClassName}
        onClick={handleRowClick}
        role={inSelectionMode && validTarget ? 'button' : undefined}
        tabIndex={inSelectionMode && validTarget ? 0 : undefined}
        onKeyDown={inSelectionMode && validTarget ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); } } : undefined}
      >
        <div className="planner-milestone-main">
          <span className="planner-milestone-leading">
            <span className={`planner-milestone-dot status-${milestone.status}${overdue ? ' overdue' : ''}${isNextUp ? ' next-up' : ''}`} />
            <span className="planner-milestone-title">{milestone.title}</span>
          </span>
          <span className="planner-milestone-trailing">
            {dateStr && (
              <span className={`planner-milestone-date${overdue ? ' overdue' : ''}${!showDateAlways ? ' reveal-on-hover' : ''}`}>
                {formatShortDate(dateStr)}
              </span>
            )}
          </span>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="planner-milestone-children">
          {children.map(child => (
            <MilestoneBranch
              key={child.id}
              milestone={child}
              milestones={milestones}
              expandedMilestones={expandedMilestones}
              onToggle={onToggle}
              selectionMode={selectionMode}
              onMilestoneSelected={onMilestoneSelected}
              nextDueDate={nextDueDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}