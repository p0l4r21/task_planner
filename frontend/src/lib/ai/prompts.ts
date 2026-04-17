/**
 * Prompt templates for AI-powered planner features.
 */

import type { Idea, IdeaEntry, Project, Task } from '../../types';
import { getIdeaSummary } from '../ideaFields';

export type IdeaWorkspaceAction =
  | 'expand'
  | 'gaps'
  | 'tasks'
  | 'risks'
  | 'executive_summary'
  | 'child_ideas'
  | 'project_outline';

const IDEA_ACTION_INSTRUCTIONS: Record<IdeaWorkspaceAction, string> = {
  expand: 'Expand this idea into a more complete, practical concept. Include useful angles, assumptions, and next questions.',
  gaps: 'Identify gaps, weak points, missing evidence, unclear assumptions, and decisions that need to be made.',
  tasks: 'Extract candidate implementation tasks. Return a concise grouped list. Do not invent excessive tasks.',
  risks: 'Identify the main risks and mitigations for pursuing this idea.',
  executive_summary: 'Write an executive summary suitable for a stakeholder. Keep it crisp and decision-oriented.',
  child_ideas: 'Suggest 5-8 child ideas or branches that could be split out from this idea. Include one sentence of rationale for each.',
  project_outline: 'Generate a project outline with objective, scope, non-goals, likely milestones, and first steps.',
};

function truncate(value: string, maxLength: number): string {
  const trimmed = value?.trim() || '';
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trim()}...`;
}

export function ideaWorkspaceActionPrompt(
  idea: Idea,
  entries: IdeaEntry[],
  relatedIdeas: Idea[],
  action: IdeaWorkspaceAction,
): string {
  const entrySummary = entries.slice(0, 8).map(entry => (
    `- ${entry.title || entry.type} (${entry.type}, ${entry.created_at}): ${truncate(entry.content, 700)}`
  )).join('\n');
  const relatedSummary = relatedIdeas.slice(0, 10).map(related => (
    `- ${related.title}: ${truncate(getIdeaSummary(related), 250)}`
  )).join('\n');

  return `Use the current stored idea workspace content below. ${IDEA_ACTION_INSTRUCTIONS[action]}

Keep the output directly usable in a planning workspace. Prefer clear headings and bullets. Do not mention that you are an AI.

Idea:
Title: ${idea.title}
Status: ${idea.status}
Summary: ${getIdeaSummary(idea)}
Current state: ${idea.current_state}
Proposed change: ${idea.proposed_change}
Why it matters: ${idea.why_it_matters}
Tags: ${idea.tags}

Body:
${truncate(idea.body, 5000)}

Notes:
${truncate(idea.notes, 1800)}

Recent entries:
${entrySummary || 'None'}

Related ideas:
${relatedSummary || 'None'}`;
}

export function summarizeIdeaPrompt(idea: Idea): string {
  return `Summarize the following idea in 2-3 concise sentences suitable for a planning tool:\n\nTitle: ${idea.title}\nSummary: ${getIdeaSummary(idea)}\nCurrent state: ${idea.current_state}\nProposed change: ${idea.proposed_change}\nWhy it matters: ${idea.why_it_matters}\nNotes: ${idea.notes}`;
}

export function suggestTagsPrompt(idea: Idea): string {
  return `Suggest 3-5 short, relevant tags (single words or hyphenated) for this idea. Return only the tags as a comma-separated list, nothing else.\n\nTitle: ${idea.title}\nSummary: ${getIdeaSummary(idea)}\nCurrent state: ${idea.current_state}\nProposed change: ${idea.proposed_change}\nWhy it matters: ${idea.why_it_matters}\nNotes: ${idea.notes}`;
}

export function suggestRelatedPrompt(idea: Idea, projects: Project[], ideas: Idea[]): string {
  const projectList = projects.slice(0, 20).map(p => `- ${p.name}: ${p.description.slice(0, 100)}`).join('\n');
  const ideaList = ideas.filter(i => i.id !== idea.id).slice(0, 20).map(i => `- ${i.title}: ${getIdeaSummary(i).slice(0, 100)}`).join('\n');

  return `Given this idea, suggest which existing projects or ideas might be related. Return a brief list with reasoning.\n\nIdea: ${idea.title}\nSummary: ${getIdeaSummary(idea)}\nCurrent state: ${idea.current_state}\nProposed change: ${idea.proposed_change}\n\nExisting Projects:\n${projectList}\n\nExisting Ideas:\n${ideaList}`;
}

export function draftProjectScopePrompt(idea: Idea): string {
  return `Draft a concise project scope/description based on this idea. The output should be suitable for a project brief in a planning tool (3-5 sentences).\n\nTitle: ${idea.title}\nSummary: ${getIdeaSummary(idea)}\nCurrent state: ${idea.current_state}\nProposed change: ${idea.proposed_change}\nWhy it matters: ${idea.why_it_matters}\nNotes: ${idea.notes}`;
}

export function summarizeProjectPrompt(project: Project, tasks: Task[], milestoneCount: number): string {
  const taskList = tasks.slice(0, 15).map(t => `- [${t.priority}/${t.bucket}] ${t.title}`).join('\n');
  return `Write a brief 2-3 sentence status summary for this project suitable for a dashboard card.\n\nProject: ${project.name}\nDescription: ${project.description}\nStatus: ${project.status}\nPriority: ${project.priority}\nMilestones: ${milestoneCount}\nTarget end: ${project.target_end_date || 'None'}\n\nActive tasks:\n${taskList || 'No tasks yet'}`;
}

export function suggestMilestonesPrompt(project: Project, existingMilestones: string[]): string {
  const existing = existingMilestones.length > 0
    ? `\nExisting milestones:\n${existingMilestones.map(m => `- ${m}`).join('\n')}`
    : '';
  return `Suggest 3-5 milestones for this project. Return as a JSON array of objects with "title" and "description" fields. Only suggest milestones NOT already listed.${existing}\n\nProject: ${project.name}\nDescription: ${project.description}\nStatus: ${project.status}`;
}

export function identifyProjectRisksPrompt(project: Project, tasks: Task[], overdueMilestones: number): string {
  const taskSummary = tasks.length > 0
    ? `Active tasks: ${tasks.length} (${tasks.filter(t => t.bucket === 'blocked').length} blocked)`
    : 'No active tasks';
  return `Identify 2-4 potential risks or concerns for this project. Return as a JSON array of objects with "risk" and "mitigation" fields. Be concise.\n\nProject: ${project.name}\nDescription: ${project.description}\nStatus: ${project.status}\nPriority: ${project.priority}\nTarget end: ${project.target_end_date || 'None'}\n${taskSummary}\nOverdue milestones: ${overdueMilestones}`;
}

export function draftStatusUpdatePrompt(project: Project, tasks: Task[], completedMilestones: number, totalMilestones: number): string {
  const recentTasks = tasks.slice(0, 10).map(t => `- [${t.bucket}] ${t.title}`).join('\n');
  return `Draft a brief project status update (3-5 sentences) suitable for stakeholders.\n\nProject: ${project.name}\nStatus: ${project.status}\nProgress: ${totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0}% milestones complete (${completedMilestones}/${totalMilestones})\nTarget end: ${project.target_end_date || 'Not set'}\n\nRecent tasks:\n${recentTasks || 'None'}`;
}

export function plannerInsightsPrompt(
  projects: Project[],
  tasks: Task[],
  ideas: Idea[],
): string {
  const projectSummary = projects.slice(0, 15).map(p =>
    `- [${p.status}] ${p.name}: ${p.description.slice(0, 80)}`
  ).join('\n');

  const taskSummary = `${tasks.length} active tasks`;

  const ideaSummary = ideas.slice(0, 15).map(i =>
    `- [${i.status}] ${i.title}: ${getIdeaSummary(i).slice(0, 80)}`
  ).join('\n');

  return `You are a planning assistant. Based on the following workspace context, generate 3-5 brief, actionable insights. Each insight should be 1-2 sentences. Format as a JSON array of objects with "title" and "body" fields.\n\nProjects:\n${projectSummary}\n\nTasks: ${taskSummary}\n\nIdeas:\n${ideaSummary}\n\nFocus on:\n- Ideas that relate to active projects\n- Potential duplicate ideas\n- Stalled projects that might connect to an idea\n- Patterns worth reusing\n- Suggestions for next steps`;
}
