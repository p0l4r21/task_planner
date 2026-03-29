export type TaskStatus = 'incoming' | 'this_week' | 'today' | 'in_progress' | 'blocked' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskBucket = 'incoming' | 'this_week' | 'today' | 'in_progress' | 'blocked' | 'backlog' | 'completed';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  bucket: TaskBucket;
  due_date: string | null;
  scheduled_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  tags: string;
  project_id: string | null;
  project: string;
  parent_milestone_id: string | null;
  hierarchy_level: number;
  owner: string;
  blocked_reason: string;
  notes: string;
  checklist_items: string; // JSON string of ChecklistItem[]
}

export interface TaskCreate {
  title: string;
  description?: string;
  priority?: TaskPriority;
  due_date?: string | null;
  scheduled_date?: string | null;
  tags?: string;
  project_id?: string | null;
  project?: string;
  parent_milestone_id?: string | null;
  hierarchy_level?: number;
  bucket?: TaskBucket;
  blocked_reason?: string;
  notes?: string;
  checklist_items?: string;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  bucket?: TaskBucket;
  due_date?: string | null;
  scheduled_date?: string | null;
  tags?: string;
  project_id?: string | null;
  project?: string;
  parent_milestone_id?: string | null;
  hierarchy_level?: number;
  owner?: string;
  blocked_reason?: string;
  notes?: string;
  checklist_items?: string;
}

export interface DashboardSummary {
  active_count: number;
  today_count: number;
  in_progress_count: number;
  blocked_count: number;
  completed_this_week: number;
  incoming_count: number;
  this_week_count: number;
  backlog_count: number;
}

export const BUCKET_LABELS: Record<TaskBucket, string> = {
  incoming: 'Incoming',
  today: 'Today',
  this_week: 'This Week',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  backlog: 'Backlog',
  completed: 'Completed',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const BUCKET_ORDER: TaskBucket[] = [
  'today',
  'in_progress',
  'blocked',
  'this_week',
  'incoming',
  'backlog',
];

// ===================================================================
// Project Planner Types
// ===================================================================

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  start_date: string | null;
  target_end_date: string | null;
  owner: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  start_date?: string | null;
  target_end_date?: string | null;
  owner?: string;
  tags?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  start_date?: string | null;
  target_end_date?: string | null;
  owner?: string;
  tags?: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description: string;
  priority: string;
  due_date: string | null;
  status: MilestoneStatus;
  is_major: boolean;
  parent_milestone_id: string | null;
  linked_milestone_ids: string;
  task_ids: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface MilestoneCreate {
  title: string;
  description?: string;
  priority?: string;
  due_date?: string | null;
  is_major?: boolean;
  parent_milestone_id?: string | null;
  linked_milestone_ids?: string;
  task_ids?: string;
  order_index?: number;
}

export interface MilestoneUpdate {
  title?: string;
  description?: string;
  priority?: string;
  due_date?: string | null;
  status?: MilestoneStatus;
  is_major?: boolean;
  parent_milestone_id?: string | null;
  linked_milestone_ids?: string;
  task_ids?: string;
  order_index?: number;
}

// Inline milestone for batch creation (with nested children)
export interface InlineMilestoneCreate {
  title: string;
  description?: string;
  priority?: string;
  due_date?: string | null;
  children?: InlineMilestoneCreate[];
}

export interface ProjectCreateWithMilestones {
  name: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  start_date?: string | null;
  target_end_date?: string | null;
  owner?: string;
  tags?: string;
  milestones?: InlineMilestoneCreate[];
}

export interface MilestoneProgress {
  milestone_id: string;
  title: string;
  is_major: boolean;
  status: MilestoneStatus;
  total_tasks: number;
  completed_tasks: number;
  child_milestones: MilestoneProgress[];
}

export interface ProjectProgress {
  project_id: string;
  project_name: string;
  total_major: number;
  completed_major: number;
  percent: number;
  milestones: MilestoneProgress[];
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};

// ===================================================================
// Calendar / Dashboard integration types
// ===================================================================

export interface CalendarMilestone {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  due_date: string | null;
  status: MilestoneStatus;
  is_major: boolean;
  priority: string;
}

export interface ProjectSummaryItem {
  id: string;
  name: string;
  status: string;
  priority: string;
  total_milestones: number;
  completed_milestones: number;
  active_tasks: number;
  target_end_date: string | null;
}

export interface UpcomingMilestone {
  id: string;
  title: string;
  due_date: string;
  project_name: string;
  is_major: boolean;
  is_overdue: boolean;
}

export interface ProjectsSummary {
  total_projects: number;
  active_projects: number;
  total_milestones: number;
  completed_milestones: number;
  pending_milestones: number;
  upcoming_milestones: UpcomingMilestone[];
  projects: ProjectSummaryItem[];
}
