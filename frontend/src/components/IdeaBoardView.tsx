import type { Idea, IdeaStatus } from '../types';
import { IDEA_STATUS_LABELS, IDEA_STATUS_ORDER } from '../types';
import IdeaCard from './IdeaCard';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IdeaBoardViewProps {
  ideas: Idea[];
  onSelect: (idea: Idea) => void;
}

export default function IdeaBoardView({ ideas, onSelect }: IdeaBoardViewProps) {
  const columns = IDEA_STATUS_ORDER.map(status => ({
    status,
    label: IDEA_STATUS_LABELS[status],
    items: ideas.filter(i => i.status === status),
  }));

  return (
    <div className="idea-board">
      {columns.map(col => (
        <div key={col.status} className={`idea-board-col idea-board-col-${col.status}`}>
          <div className="idea-board-col-header">
            <span className="idea-board-col-title">{col.label}</span>
            <span className="idea-board-col-count">{col.items.length}</span>
          </div>
          <ScrollArea className="idea-board-col-body">
            {col.items.length === 0 && (
              <div className="idea-board-col-empty">No ideas</div>
            )}
            {col.items.map(idea => (
              <IdeaCard key={idea.id} idea={idea} onClick={() => onSelect(idea)} compact />
            ))}
          </ScrollArea>
        </div>
      ))}
    </div>
  );
}
