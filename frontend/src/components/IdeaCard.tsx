import type { Idea } from '../types';
import { IDEA_STATUS_LABELS } from '../types';
import { getIdeaSummary } from '../lib/ideaFields';

interface IdeaCardProps {
  idea: Idea;
  onClick: () => void;
  compact?: boolean;
}

export default function IdeaCard({ idea, onClick, compact }: IdeaCardProps) {
  const tagList = idea.tags ? idea.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const summary = getIdeaSummary(idea);
  const linkedCount =
    (idea.linked_project_ids ? idea.linked_project_ids.split(',').filter(Boolean).length : 0) +
    (idea.linked_task_ids ? idea.linked_task_ids.split(',').filter(Boolean).length : 0) +
    (idea.linked_milestone_ids ? idea.linked_milestone_ids.split(',').filter(Boolean).length : 0) +
    (idea.linked_idea_ids ? idea.linked_idea_ids.split(',').filter(Boolean).length : 0);

  const updatedLabel = idea.updated_at
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(idea.updated_at))
    : '';

  return (
    <article className={`idea-card idea-card-${idea.status}${compact ? ' idea-card-compact' : ''}`} onClick={onClick}>
      <div className="idea-card-header">
        <span className={`idea-status-dot idea-status-${idea.status}`} />
        <span className="idea-card-title">{idea.title}</span>
      </div>
      {!compact && summary && (
        <p className="idea-card-desc">{summary.slice(0, 120)}{summary.length > 120 ? '...' : ''}</p>
      )}
      <div className="idea-card-meta">
        <span className="idea-card-status-label">{IDEA_STATUS_LABELS[idea.status]}</span>
        {tagList.slice(0, 3).map(tag => (
          <span key={tag} className="tag">{tag}</span>
        ))}
        {tagList.length > 3 && <span className="tag">+{tagList.length - 3}</span>}
        {linkedCount > 0 && <span className="idea-card-links">🔗 {linkedCount}</span>}
        {updatedLabel && <span className="idea-card-date">{updatedLabel}</span>}
      </div>
    </article>
  );
}
