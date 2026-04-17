/**
 * High-level AI service functions for the planner.
 * Uses the provider abstraction so the UI doesn't deal with raw prompts.
 */

import type { Idea, IdeaEntry, Milestone, Project, Task } from '../../types';
import { getAIProvider } from './provider';
import {
  ideaWorkspaceActionPrompt,
  summarizeIdeaPrompt,
  suggestTagsPrompt,
  suggestRelatedPrompt,
  draftProjectScopePrompt,
  summarizeProjectPrompt,
  suggestMilestonesPrompt,
  identifyProjectRisksPrompt,
  draftStatusUpdatePrompt,
  plannerInsightsPrompt,
} from './prompts';
import type { IdeaWorkspaceAction } from './prompts';

const SYSTEM_MSG = {
  role: 'system' as const,
  content: 'You are a concise, professional planning assistant integrated into a task planner workspace. Keep responses brief and actionable.',
};

async function ask(userContent: string): Promise<string> {
  const provider = getAIProvider();
  if (!provider) throw new Error('AI not configured. Add your API key in Settings.');
  return provider.complete({
    messages: [SYSTEM_MSG, { role: 'user', content: userContent }],
  });
}

export async function summarizeIdea(idea: Idea): Promise<string> {
  return ask(summarizeIdeaPrompt(idea));
}

export async function suggestTags(idea: Idea): Promise<string[]> {
  const raw = await ask(suggestTagsPrompt(idea));
  return raw.split(',').map(t => t.trim()).filter(Boolean);
}

export async function suggestRelated(
  idea: Idea, projects: Project[], ideas: Idea[]
): Promise<string> {
  return ask(suggestRelatedPrompt(idea, projects, ideas));
}

export async function draftProjectScope(idea: Idea): Promise<string> {
  return ask(draftProjectScopePrompt(idea));
}

export async function runIdeaWorkspaceAction(
  idea: Idea,
  entries: IdeaEntry[],
  relatedIdeas: Idea[],
  action: IdeaWorkspaceAction,
): Promise<string> {
  return ask(ideaWorkspaceActionPrompt(idea, entries, relatedIdeas, action));
}

// ===================================================================
// Project AI Functions
// ===================================================================

export async function summarizeProject(
  project: Project, tasks: Task[], milestoneCount: number,
): Promise<string> {
  return ask(summarizeProjectPrompt(project, tasks, milestoneCount));
}

export interface SuggestedMilestone {
  title: string;
  description: string;
}

export async function suggestProjectMilestones(
  project: Project, existingMilestones: string[],
): Promise<SuggestedMilestone[]> {
  const raw = await ask(suggestMilestonesPrompt(project, existingMilestones));
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fallback */ }
  return [{ title: 'Suggested milestone', description: raw }];
}

export interface ProjectRisk {
  risk: string;
  mitigation: string;
}

export async function identifyProjectRisks(
  project: Project, tasks: Task[], overdueMilestones: number,
): Promise<ProjectRisk[]> {
  const raw = await ask(identifyProjectRisksPrompt(project, tasks, overdueMilestones));
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fallback */ }
  return [{ risk: raw, mitigation: '' }];
}

export async function draftStatusUpdate(
  project: Project, tasks: Task[], completedMilestones: number, totalMilestones: number,
): Promise<string> {
  return ask(draftStatusUpdatePrompt(project, tasks, completedMilestones, totalMilestones));
}

export interface PlannerInsight {
  title: string;
  body: string;
}

export async function generatePlannerInsights(
  projects: Project[], tasks: Task[], ideas: Idea[]
): Promise<PlannerInsight[]> {
  const raw = await ask(plannerInsightsPrompt(projects, tasks, ideas));
  try {
    // Try to parse JSON from the response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback: return as single insight
  }
  return [{ title: 'Planner Insight', body: raw }];
}
