import { useState } from 'react';
import type { Milestone, Task } from '../types';
import { MILESTONE_STATUS_LABELS } from '../types';
import { TaskPanelList } from './TaskPanel';
import { Button } from '@/components/ui/button';

interface Props {
  milestone: Milestone;
  children: Milestone[];        // direct child milestones
  linkedMilestones: Milestone[];
  tasks: Task[];                // tasks linked to this milestone
  allTasks: Task[];             // all project tasks for linking
  depth?: number;
  defaultExpanded?: boolean;
  onEdit: (m: Milestone) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onLinkMilestone: (id: string) => void;
  onLinkTask: (id: string) => void;
  onUnlinkTask: (milestoneId: string, taskId: string) => Promise<void>;
  // Recursive rendering
  allMilestones: Milestone[];
  taskMap: Record<string, Task>;
}

export default function MilestoneNode({
  milestone, children, linkedMilestones, tasks,
  allTasks, depth = 0, defaultExpanded,
  onEdit, onDelete, onComplete, onAddChild, onLinkMilestone, onLinkTask, onUnlinkTask,
  allMilestones, taskMap,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? milestone.is_major);
  const [showActions, setShowActions] = useState(false);

  const isCompleted = milestone.status === 'completed';
  const taskIds = milestone.task_ids ? milestone.task_ids.split(',').filter(Boolean) : [];
  const completedTaskCount = taskIds.filter(id => !taskMap[id]).length; // not in active = completed

  const hasChildren = children.length > 0 || linkedMilestones.length > 0 || tasks.length > 0;

  return (
    <div className={`ms-node ${isCompleted ? 'ms-completed' : ''} ms-depth-${Math.min(depth, 2)}`}>
      <div
        className={`ms-node-header ${milestone.is_major ? 'ms-node-major' : 'ms-node-minor'}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <div className="ms-node-left">
          {hasChildren ? (
            <button className="ms-toggle" onClick={() => setExpanded(!expanded)}>
              {expanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="ms-toggle-spacer" />
          )}
          <span className={`ms-type-badge ${milestone.is_major ? 'ms-major' : 'ms-minor'}`}>
            {milestone.is_major ? 'Major' : 'Minor'}
          </span>
          <span className={`ms-status-dot ms-status-${milestone.status}`} />
          <span className={`ms-node-title ${isCompleted ? 'ms-struck' : ''}`}>
            {milestone.title}
          </span>
          {linkedMilestones.length > 0 && (
            <span className="ms-linked-badge" title="Has linked milestones">🔗 {linkedMilestones.length}</span>
          )}
          {taskIds.length > 0 && (
            <span className="ms-task-count">{completedTaskCount}/{taskIds.length} tasks</span>
          )}
          {milestone.due_date && (
            <span className="tag tag-due">Due: {milestone.due_date.slice(0, 10)}</span>
          )}
        </div>
        <div className={`ms-node-actions ${showActions ? 'visible' : ''}`}>
          <Button variant="ghost" size="xs" onClick={() => onEdit(milestone)} title="Edit">✎</Button>
          {!isCompleted && (
            <Button variant="ghost" size="xs" className="text-green-500 hover:bg-green-500/10" onClick={() => onComplete(milestone.id)} title="Complete">✓</Button>
          )}
          <Button variant="ghost" size="xs" onClick={() => onAddChild(milestone.id)} title="Add child milestone">+ Child</Button>
          <Button variant="ghost" size="xs" onClick={() => onLinkTask(milestone.id)} title="Link task">+ Task</Button>
          <Button variant="ghost" size="xs" onClick={() => onLinkMilestone(milestone.id)} title="Link milestone">🔗</Button>
          <Button variant="destructive" size="xs" onClick={() => onDelete(milestone.id)} title="Delete">✕</Button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="ms-node-children">
          {/* Tasks under this milestone */}
          {tasks.length > 0 && (
            <div className="ms-tasks-section">
              <TaskPanelList tasks={tasks} milestoneId={milestone.id} onUnlink={onUnlinkTask} />
            </div>
          )}

          {/* Child (minor) milestones */}
          {children.map(child => {
            const childChildren = allMilestones.filter(m => m.parent_milestone_id === child.id);
            const childLinked = child.linked_milestone_ids
              ? child.linked_milestone_ids.split(',').filter(Boolean).map(id => allMilestones.find(m => m.id === id)).filter(Boolean) as Milestone[]
              : [];
            const childTaskIds = child.task_ids ? child.task_ids.split(',').filter(Boolean) : [];
            const childTasks = childTaskIds.map(id => taskMap[id]).filter(Boolean);

            return (
              <MilestoneNode
                key={child.id}
                milestone={child}
                children={childChildren}
                linkedMilestones={childLinked}
                tasks={childTasks}
                allTasks={allTasks}
                depth={depth + 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onComplete={onComplete}
                onAddChild={onAddChild}
                onLinkMilestone={onLinkMilestone}
                onLinkTask={onLinkTask}
                onUnlinkTask={onUnlinkTask}
                allMilestones={allMilestones}
                taskMap={taskMap}
              />
            );
          })}

          {/* Linked milestones */}
          {linkedMilestones.map(lm => {
            const lmChildren = allMilestones.filter(m => m.parent_milestone_id === lm.id);
            const lmLinked: Milestone[] = []; // Don't recurse linked-of-linked
            const lmTaskIds = lm.task_ids ? lm.task_ids.split(',').filter(Boolean) : [];
            const lmTasks = lmTaskIds.map(id => taskMap[id]).filter(Boolean);

            return (
              <div key={lm.id} className="ms-linked-wrapper">
                <span className="ms-linked-indicator">🔗 Linked</span>
                <MilestoneNode
                  milestone={lm}
                  children={lmChildren}
                  linkedMilestones={lmLinked}
                  tasks={lmTasks}
                  allTasks={allTasks}
                  depth={depth + 1}
                  defaultExpanded={false}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onComplete={onComplete}
                  onAddChild={onAddChild}
                  onLinkMilestone={onLinkMilestone}
                  onLinkTask={onLinkTask}
                  onUnlinkTask={onUnlinkTask}
                  allMilestones={allMilestones}
                  taskMap={taskMap}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
