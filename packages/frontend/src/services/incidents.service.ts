import { api } from '@/lib/api';

export type Severity = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export interface Incident {
  id: string; projectId: string; title: string;
  severity: Severity; status: IncidentStatus;
  startAt?: string; endAt?: string;
  affectedService?: string; rootCauseCommitId?: string;
  linkedDeploymentId?: string; rootCauseNotes?: string;
  timeline?: Array<{ timestamp: string; description: string }>;
  externalId?: string; createdAt: string; updatedAt: string;
}
export interface IncidentStats {
  period: string; total: number; open: number; resolved: number;
  bySeverity: Record<string, number>;
  mttr: { avgMinutes: number | null; p50Minutes: number | null; p90Minutes: number | null; samples: number };
  changeFailureRate: { rate: number; deploymentsWithIncidents: number; totalDeployments: number };
}
export interface CreateIncidentPayload {
  title: string; severity: Severity;
  startAt?: string; endAt?: string;
  affectedService?: string; rootCauseCommitId?: string;
  linkedDeploymentId?: string; rootCauseNotes?: string;
}

export const incidentsService = {
  list: (projectId: string, params?: { severity?: string; status?: string }) =>
    api.get<Incident[]>(`/projects/${projectId}/incidents`, params),

  get: (projectId: string, id: string) =>
    api.get<Incident>(`/projects/${projectId}/incidents/${id}`),

  stats: (projectId: string, period: '7d' | '30d' | '90d' = '30d') =>
    api.get<IncidentStats>(`/projects/${projectId}/incidents/stats`, { period }),

  create: (projectId: string, data: CreateIncidentPayload) =>
    api.post<Incident>(`/projects/${projectId}/incidents`, data),

  update: (projectId: string, id: string, data: Partial<CreateIncidentPayload>) =>
    api.put<Incident>(`/projects/${projectId}/incidents/${id}`, data),

  resolve: (projectId: string, id: string, endAt?: string) =>
    api.patch<Incident>(`/projects/${projectId}/incidents/${id}/resolve`, { endAt }),

  addTimeline: (projectId: string, id: string, description: string) =>
    api.patch<Incident>(`/projects/${projectId}/incidents/${id}/timeline`, { description }),

  delete: (projectId: string, id: string) =>
    api.delete<void>(`/projects/${projectId}/incidents/${id}`),
};
