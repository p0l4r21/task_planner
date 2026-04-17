import { useState, useCallback, useEffect } from 'react';
import type { Idea, IdeaCreate, IdeaUpdate } from '../types';
import { api } from '../api';

export function useIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    try {
      setIdeas(await api.listIdeas(params));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data: IdeaCreate) => {
    const idea = await api.createIdea(data);
    setIdeas(prev => [idea, ...prev]);
    return idea;
  };

  const update = async (id: string, data: IdeaUpdate) => {
    const idea = await api.updateIdea(id, data);
    setIdeas(prev => prev.map(x => x.id === id ? idea : x));
    return idea;
  };

  const remove = async (id: string) => {
    await api.deleteIdea(id);
    setIdeas(prev => prev.filter(x => x.id !== id));
  };

  const convert = async (id: string, projectId: string) => {
    const idea = await api.convertIdea(id, projectId);
    setIdeas(prev => prev.map(x => x.id === id ? idea : x));
    return idea;
  };

  return { ideas, loading, refresh, create, update, remove, convert };
}
