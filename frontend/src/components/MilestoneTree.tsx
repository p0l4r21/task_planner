import { useMemo } from 'react';
import type { Milestone, Task } from '../types';
import MilestoneNode from './MilestoneNode';

interface Props {
  milestones: Milestone[];
  tasks: Task[];
  onEdit: (m: Milestone) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onLinkMilestone: (id: string) => void;
  onLinkTask: (id: string) => void;
  onUnlinkTask: (milestoneId: string, taskId: string) => Promise<void>;
}

export default function MilestoneTree({
  milestones, tasks,
  onEdit, onDelete, onComplete, onAddChild, onLinkMilestone, onLinkTask, onUnlinkTask,
}: Props) {
  const taskMap = useMemo(() => {
    const map: Record<string, Task> = {};
    for (const t of tasks) map[t.id] = t;
    return map;
  }, [tasks]);

  // Top-level milestones: major milestones without parent, plus orphan minors
  const topLevel = useMemo(() => {
    return milestones
      .filter(m => !m.parent_milestone_id)
      .sort((a, b) => {
        // Major first, then by order_index
        if (a.is_major !== b.is_major) return a.is_major ? -1 : 1;
        return a.order_index - b.order_index;
      });
  }, [milestones]);

  if (milestones.length === 0) {
    return (
      <div className="ms-tree-empty">
        No milestones yet. Create your first milestone to structure this project.
      </div>
    );
  }

  return (
    <div className="ms-tree">
      {topLevel.map(m => {
        const children = milestones.filter(c => c.parent_milestone_id === m.id);
        const linkedIds = m.linked_milestone_ids
          ? m.linked_milestone_ids.split(',').filter(Boolean)
          : [];
        const linkedMilestones = linkedIds
          .map(id => milestones.find(ms => ms.id === id))
          .filter(Boolean) as Milestone[];
        const mTaskIds = m.task_ids ? m.task_ids.split(',').filter(Boolean) : [];
        const mTasks = mTaskIds.map(id => taskMap[id]).filter(Boolean);

        return (
          <MilestoneNode
            key={m.id}
            milestone={m}
            children={children}
            linkedMilestones={linkedMilestones}
            tasks={mTasks}
            allTasks={tasks}
            depth={0}
            onEdit={onEdit}
            onDelete={onDelete}
            onComplete={onComplete}
            onAddChild={onAddChild}
            onLinkMilestone={onLinkMilestone}
            onLinkTask={onLinkTask}
            onUnlinkTask={onUnlinkTask}
            allMilestones={milestones}
            taskMap={taskMap}
          />
        );
      })}
    </div>
  );
}
