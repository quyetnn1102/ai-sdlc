import { api } from '@/lib/api';

export type IntegrationType =
  | 'JIRA' | 'GITHUB' | 'GITLAB' | 'GITHUB_ACTIONS'
  | 'GITLAB_CI' | 'JENKINS' | 'SONARQUBE' | 'SAST' | 'PAGERDUTY';

export interface Integration {
  id: string;
  projectId: string;
  type: IntegrationType;
  status: 'ACTIVE' | 'DEGRADED' | 'DISCONNECTED';
  lastSyncAt?: string;
  settings: Array<{ key: string; value: string }>;
}
export interface CreateIntegrationPayload {
  type: IntegrationType;
  settings?: Record<string, string>;
}

export const integrationsService = {
  list: (projectId: string) =>
    api.get<Integration[]>('/integrations', { projectId }),

  create: (projectId: string, data: CreateIntegrationPayload) =>
    api.post<Integration>('/integrations', data, { projectId }),

  update: (id: string, data: { status?: string; settings?: Record<string, string> }) =>
    api.put<Integration>(`/integrations/${id}`, data),

  test: (id: string) =>
    api.post<{ integrationId: string; type: string; status: string }>(
      `/integrations/${id}/test`,
    ),

  delete: (id: string) => api.delete<void>(`/integrations/${id}`),
};
