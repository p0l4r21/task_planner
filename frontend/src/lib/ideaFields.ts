import type { Idea } from '../types';

export function getIdeaSummary(idea: Pick<Idea, 'summary' | 'description'>): string {
  return idea.summary?.trim() || idea.description?.trim() || '';
}

export function buildIdeaProjectDescription(
  idea: Pick<Idea, 'summary' | 'description' | 'current_state' | 'proposed_change' | 'why_it_matters' | 'notes'>,
): string {
  const sections = [
    ['Summary', getIdeaSummary(idea)],
    ['Current State', idea.current_state],
    ['Proposed Change', idea.proposed_change],
    ['Why It Matters', idea.why_it_matters],
    ['Notes', idea.notes],
  ];

  return sections
    .filter(([, value]) => value?.trim())
    .map(([label, value]) => `${label}:\n${value}`)
    .join('\n\n');
}
