import type { Idea } from '../types';
import { IDEA_STATUS_LABELS } from '../types';
import { getIdeaSummary } from './ideaFields';

export function ideaToMarkdown(idea: Idea): string {
  const lines: string[] = [];

  lines.push(`# ${idea.title}`);
  lines.push('');

  const summary = getIdeaSummary(idea);
  if (summary) {
    lines.push(summary);
    lines.push('');
  }

  lines.push(`**Status:** ${IDEA_STATUS_LABELS[idea.status] || idea.status}`);

  if (idea.tags) {
    const tagList = idea.tags.split(',').map(t => t.trim()).filter(Boolean);
    lines.push(`**Tags:** ${tagList.map(t => `\`${t}\``).join(', ')}`);
  }

  lines.push(`**Created:** ${idea.created_at.slice(0, 10)}`);
  lines.push(`**Updated:** ${idea.updated_at.slice(0, 10)}`);
  lines.push('');

  if (idea.current_state) {
    lines.push('## Current State');
    lines.push('');
    lines.push(idea.current_state);
    lines.push('');
  }

  if (idea.proposed_change) {
    lines.push('## Proposed Change');
    lines.push('');
    lines.push(idea.proposed_change);
    lines.push('');
  }

  if (idea.why_it_matters) {
    lines.push('## Why It Matters');
    lines.push('');
    lines.push(idea.why_it_matters);
    lines.push('');
  }

  if (idea.notes) {
    lines.push('## Notes');
    lines.push('');
    lines.push(idea.notes);
    lines.push('');
  }

  const linkedProjectIds = idea.linked_project_ids?.split(',').filter(Boolean) || [];
  const linkedTaskIds = idea.linked_task_ids?.split(',').filter(Boolean) || [];
  const linkedMilestoneIds = idea.linked_milestone_ids?.split(',').filter(Boolean) || [];
  const linkedIdeaIds = idea.linked_idea_ids?.split(',').filter(Boolean) || [];

  const hasLinks = linkedProjectIds.length + linkedTaskIds.length + linkedMilestoneIds.length + linkedIdeaIds.length > 0;

  if (hasLinks) {
    lines.push('## Linked Items');
    lines.push('');
    if (linkedProjectIds.length) lines.push(`- **Projects:** ${linkedProjectIds.join(', ')}`);
    if (linkedTaskIds.length) lines.push(`- **Tasks:** ${linkedTaskIds.join(', ')}`);
    if (linkedMilestoneIds.length) lines.push(`- **Milestones:** ${linkedMilestoneIds.join(', ')}`);
    if (linkedIdeaIds.length) lines.push(`- **Related Ideas:** ${linkedIdeaIds.join(', ')}`);
    lines.push('');
  }

  if (idea.converted_project_id) {
    lines.push(`**Converted to Project:** ${idea.converted_project_id}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
