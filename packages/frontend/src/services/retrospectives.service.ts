import { api } from '@/lib/api';

export interface ActionItem { text: string; owner?: string; dueDate?: string; completed: boolean; }
export interface Retrospective {
  id: string; projectId: string; title: string;
  sprintName?: string; participants?: string[];
  wentWell?: string; wentWrong?: string;
  actionItems?: ActionItem[]; tags: string[];
  incidentId?: string; createdAt: string; updatedAt: string;
}
export interface CreateRetroPayload {
  title: string; sprintName?: string; participants?: string[];
  wentWell?: string; wentWrong?: string;
  actionItems?: ActionItem[]; tags?: string[];
}

export const retrospectivesService = {
  list: (projectId: string, tag?: string) =>
    api.get<Retrospective[]>(`/projects/${projectId}/retros`, tag ? { tag } : undefined),

  get: (projectId: string, id: string) =>
    api.get<Retrospective>(`/projects/${projectId}/retros/${id}`),

  create: (projectId: string, data: CreateRetroPayload) =>
    api.post<Retrospective>(`/projects/${projectId}/retros`, data),

  update: (projectId: string, id: string, data: Partial<CreateRetroPayload>) =>
    api.put<Retrospective>(`/projects/${projectId}/retros/${id}`, data),

  delete: (projectId: string, id: string) =>
    api.delete<void>(`/projects/${projectId}/retros/${id}`),
};
