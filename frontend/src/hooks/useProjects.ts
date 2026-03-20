import { useState, useCallback, useEffect } from 'react';
import type {
  Project, ProjectCreate, ProjectUpdate, ProjectCreateWithMilestones,
  Milestone, MilestoneCreate, MilestoneUpdate, InlineMilestoneCreate,
  ProjectProgress, Task,
} from '../types';
import { api } from '../api';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setProjects(await api.listProjects());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data: ProjectCreate) => {
    const p = await api.createProject(data);
    setProjects(prev => [...prev, p]);
    return p;
  };

  const createWithMilestones = async (data: ProjectCreateWithMilestones) => {
    const result = await api.createProjectWithMilestones(data);
    setProjects(prev => [...prev, result.project]);
    return result;
  };

  const update = async (id: string, data: ProjectUpdate) => {
    const p = await api.updateProject(id, data);
    setProjects(prev => prev.map(x => x.id === id ? p : x));
    return p;
  };

  const remove = async (id: string) => {
    await api.deleteProject(id);
    setProjects(prev => prev.filter(x => x.id !== id));
  };

  return { projects, loading, refresh, create, createWithMilestones, update, remove };
}

export function useMilestones(projectId: string) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      setMilestones(await api.listMilestones(projectId));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data: MilestoneCreate) => {
    const m = await api.createMilestone(projectId, data);
    setMilestones(prev => [...prev, m]);
    return m;
  };

  const update = async (id: string, data: MilestoneUpdate) => {
    const m = await api.updateMilestone(id, data);
    setMilestones(prev => prev.map(x => x.id === id ? m : x));
    return m;
  };

  const remove = async (id: string) => {
    await api.deleteMilestone(id);
    setMilestones(prev => prev.filter(x => x.id !== id));
  };

  const complete = async (id: string) => {
    const m = await api.completeMilestone(id);
    setMilestones(prev => prev.map(x => x.id === id ? m : x));
    return m;
  };

  const linkTask = async (milestoneId: string, taskId: string) => {
    const m = await api.linkTask(milestoneId, taskId);
    setMilestones(prev => prev.map(x => x.id === milestoneId ? m : x));
    return m;
  };

  const unlinkTask = async (milestoneId: string, taskId: string) => {
    const m = await api.unlinkTask(milestoneId, taskId);
    setMilestones(prev => prev.map(x => x.id === milestoneId ? m : x));
    return m;
  };

  const linkMilestone = async (milestoneId: string, targetId: string) => {
    const m = await api.linkMilestone(milestoneId, targetId);
    setMilestones(prev => prev.map(x => x.id === milestoneId ? m : x));
    // Also refresh to get the bidirectional update
    await refresh();
    return m;
  };

  return { milestones, loading, refresh, create, update, remove, complete, linkTask, unlinkTask, linkMilestone };
}

export function useProjectProgress(projectId: string) {
  const [progress, setProgress] = useState<ProjectProgress | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setProgress(await api.getProjectProgress(projectId));
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { progress, refresh };
}

export function useProjectTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    setTasks(await api.discoverProjectTasks(projectId));
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { tasks, refresh };
}
