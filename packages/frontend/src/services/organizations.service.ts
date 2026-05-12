import { api } from '@/lib/api';

export interface Organization {
  id: string;
  name: string;
  key: string;
  description?: string;
  createdAt: string;
  _count?: { memberships: number; projects: number };
}

export interface OrgDetail extends Organization {
  memberships: Array<{ id: string; role: string; user: { id: string; email: string; name: string } }>;
  projects: Project[];
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  timezone: string;
  organizationId: string;
  createdAt: string;
}

export interface CreateOrgPayload { name: string; key: string; description?: string; }
export interface CreateProjectPayload { name: string; key: string; description?: string; timezone?: string; }

export const organizationsService = {
  list: () => api.get<Organization[]>('/organizations'),

  get: (id: string) => api.get<OrgDetail>(`/organizations/${id}`),

  create: (payload: CreateOrgPayload) => api.post<Organization>('/organizations', payload),

  createProject: (orgId: string, payload: CreateProjectPayload) =>
    api.post<Project>('/projects', payload, { organizationId: orgId }),

  listProjects: (orgId: string) =>
    api.get<Project[]>('/projects', { organizationId: orgId }),
};
