import type { Idea } from '../types';
import IdeaCard from './IdeaCard';

interface IdeaListViewProps {
  ideas: Idea[];
  onSelect: (idea: Idea) => void;
}

export default function IdeaListView({ ideas, onSelect }: IdeaListViewProps) {
  if (ideas.length === 0) {
    return (
      <div className="idea-list-empty">
        <p>No ideas yet. Capture your first idea to get started.</p>
      </div>
    );
  }

  return (
    <div className="idea-list">
      {ideas.map(idea => (
        <IdeaCard key={idea.id} idea={idea} onClick={() => onSelect(idea)} />
      ))}
    </div>
  );
}
