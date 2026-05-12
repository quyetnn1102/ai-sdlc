import { api } from '@/lib/api';
import type { Project } from './organizations.service';

export interface ProjectDetail extends Project {
  organization: { id: string; name: string; key: string };
}

export const projectsService = {
  get: (id: string) => api.get<ProjectDetail>(`/projects/${id}`),

  update: (id: string, data: Partial<Project>) => api.put<Project>(`/projects/${id}`, data),

  delete: (id: string) => api.delete<void>(`/projects/${id}`),
};
