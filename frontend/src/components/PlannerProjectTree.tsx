import { useMemo, useState } from 'react';
import type { Milestone, Project, Task } from '../types';

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
  variant?: 'default' | 'embedded';
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

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones(prev => ({
      ...prev,
      [milestoneId]: !prev[milestoneId],
    }));
  };

  if (projects.length === 0) {
    return (
      <div className="planner-empty-state">
        <p>No active projects yet.</p>
        <button className="btn btn-sm btn-primary" onClick={() => onCreateTask()}>Quick task</button>
      </div>
    );
  }

  return (
    <div className="planner-project-tree">
      {projects.map(project => {
        const isEmbedded = variant === 'embedded';
        const milestones = milestonesByProject[project.id] || [];
        const completed = milestones.filter(milestone => milestone.status === 'completed').length;
        const progress = milestones.length ? Math.round((completed / milestones.length) * 100) : 0;
        const isExpanded = expandedProjects[project.id] ?? project.id === selectedProjectId;
        const rootMilestones = milestones
          .filter(milestone => !milestone.parent_milestone_id)
          .sort((left, right) => {
            if (left.is_major !== right.is_major) return left.is_major ? -1 : 1;
            return left.order_index - right.order_index;
          });

        return (
          <section
            key={project.id}
            className={`planner-project-card${selectedProjectId === project.id ? ' selected' : ''}${isEmbedded ? ' embedded' : ''}`}
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
                    <span>{completed}/{milestones.length || 0} milestones</span>
                  </div>
                </div>
                <span className="planner-project-toggle">{isExpanded ? '−' : '+'}</span>
              </button>
            ) : (
              <div className="planner-project-embedded-head">
                <div className="planner-project-meta-row">
                  <span>{taskCounts[project.id] || 0} active tasks</span>
                  <span>{completed}/{milestones.length || 0} milestones</span>
                </div>
                <div className="planner-project-actions embedded">
                  <button className="btn btn-xs btn-secondary" onClick={() => onCreateTask(project.id, null)}>Task</button>
                  <button className="btn btn-xs btn-ghost" onClick={() => onCreateMilestone(project.id, null)}>Milestone</button>
                  <button className="btn btn-xs btn-ghost" onClick={() => onEditProject(project)}>Edit</button>
                </div>
              </div>
            )}

            {!isEmbedded && (
              <div className="planner-project-progress">
                <div className="planner-project-progress-bar">
                  <div className="planner-project-progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span>{progress}% mapped</span>
              </div>
            )}

            {!isEmbedded && (
              <div className="planner-project-actions">
                <button className="btn btn-xs btn-secondary" onClick={() => onCreateTask(project.id, null)}>Task</button>
                <button className="btn btn-xs btn-ghost" onClick={() => onCreateMilestone(project.id, null)}>Milestone</button>
                <button className="btn btn-xs btn-ghost" onClick={() => onEditProject(project)}>Edit</button>
              </div>
            )}

            {isExpanded && (
              <div className="planner-project-milestones">
                {rootMilestones.length === 0 ? (
                  <div className="planner-project-empty">No milestones yet.</div>
                ) : (
                  rootMilestones.map(milestone => (
                    <MilestoneBranch
                      key={milestone.id}
                      milestone={milestone}
                      milestones={milestones}
                      expandedMilestones={expandedMilestones}
                      onToggle={toggleMilestone}
                      onEdit={onEditMilestone}
                      onCreateTask={() => onCreateTask(project.id, milestone.id)}
                      onCreateChild={() => onCreateMilestone(project.id, milestone.id)}
                    />
                  ))
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

interface MilestoneBranchProps {
  milestone: Milestone;
  milestones: Milestone[];
  expandedMilestones: Record<string, boolean>;
  onToggle: (milestoneId: string) => void;
  onEdit: (milestone: Milestone) => void;
  onCreateTask: (milestoneId: string) => void;
  onCreateChild: (milestoneId: string) => void;
}

function MilestoneBranch({
  milestone,
  milestones,
  expandedMilestones,
  onToggle,
  onEdit,
  onCreateTask,
  onCreateChild,
}: MilestoneBranchProps) {
  const children = milestones
    .filter(candidate => candidate.parent_milestone_id === milestone.id)
    .sort((left, right) => left.order_index - right.order_index);
  const isExpanded = expandedMilestones[milestone.id] ?? milestone.is_major;
  const hasChildren = children.length > 0;

  return (
    <div className="planner-milestone-branch">
      <div className="planner-milestone-row">
        <button
          type="button"
          className="planner-milestone-main"
          onClick={() => onEdit(milestone)}
        >
          <span className="planner-milestone-leading">
            <span className={`planner-milestone-dot status-${milestone.status}`} />
            <span className={`planner-milestone-badge ${milestone.is_major ? 'major' : 'minor'}`}>
              {milestone.is_major ? 'Major' : 'Sub'}
            </span>
            <span className="planner-milestone-title">{milestone.title}</span>
          </span>
          <span className="planner-milestone-trailing">
            {milestone.due_date && <span className="planner-milestone-date">{milestone.due_date.slice(0, 10)}</span>}
          </span>
        </button>
        <div className="planner-milestone-actions">
          <button className="btn btn-utility" onClick={() => onCreateTask(milestone.id)} aria-label={`Add task under ${milestone.title}`}>+</button>
          <button className="btn btn-utility" onClick={() => onCreateChild(milestone.id)} aria-label={`Add child milestone under ${milestone.title}`}>⋯</button>
          {hasChildren && (
            <button className="btn btn-utility" onClick={() => onToggle(milestone.id)} aria-label={isExpanded ? `Collapse ${milestone.title}` : `Expand ${milestone.title}`}>
              {isExpanded ? '−' : '+'}
            </button>
          )}
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
              onEdit={onEdit}
              onCreateTask={onCreateTask}
              onCreateChild={onCreateChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}