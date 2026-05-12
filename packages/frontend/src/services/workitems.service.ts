import { api } from '@/lib/api';

export interface WorkItem {
  id: string;
  externalId: string;
  externalUrl?: string;
  title: string;
  type: string;
  status: string;
  phase?: string;
  assignee?: string;
  labels: string[];
  priority?: string;
  parentId?: string;
  sprintName?: string;
  updatedAt: string;
}
export interface WipByPhase { phase: string; count: number; }
export interface WorkItemFilters {
  projectId: string;
  phase?: string;
  type?: string;
  assignee?: string;
  label?: string;
  sprintName?: string;
}

export const workItemsService = {
  list: (filters: WorkItemFilters) =>
    api.get<WorkItem[]>('/work-items', filters as Record<string, string | undefined>),

  wipByPhase: (projectId: string) =>
    api.get<WipByPhase[]>('/work-items/by-phase', { projectId }),

  aging: (projectId: string, thresholdDays?: number) =>
    api.get<WorkItem[]>('/work-items/aging', {
      projectId,
      thresholdDays: thresholdDays?.toString(),
    }),
};
