import { useState, useCallback, useEffect } from 'react';
import type { Task, DashboardSummary, TaskCreate, TaskUpdate, TaskBucket } from '../types';
import { api } from '../api';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    try {
      const data = await api.listActive(params);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data: TaskCreate) => {
    const t = await api.createTask(data);
    setTasks(prev => [...prev, t]);
    return t;
  };

  const update = async (id: string, data: TaskUpdate) => {
    const t = await api.updateTask(id, data);
    setTasks(prev => prev.map(x => x.id === id ? t : x));
    return t;
  };

  const move = async (id: string, bucket: TaskBucket) => {
    const t = await api.moveTask(id, bucket);
    setTasks(prev => prev.map(x => x.id === id ? t : x));
    return t;
  };

  const complete = async (id: string) => {
    await api.completeTask(id);
    setTasks(prev => prev.filter(x => x.id !== id));
  };

  const remove = async (id: string) => {
    await api.deleteTask(id);
    setTasks(prev => prev.filter(x => x.id !== id));
  };

  return { tasks, loading, refresh, create, update, move, complete, remove };
}

export function useCompletedTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (params?: Record<string, string>) => {
    setLoading(true);
    try {
      setTasks(await api.listCompleted(params));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const restore = async (id: string) => {
    await api.restoreTask(id);
    setTasks(prev => prev.filter(x => x.id !== id));
  };

  return { tasks, loading, refresh, restore };
}

export function useSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const refresh = useCallback(async () => {
    setSummary(await api.getSummary());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { summary, refresh };
}
