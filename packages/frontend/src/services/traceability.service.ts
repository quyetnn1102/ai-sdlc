import { api } from '@/lib/api';

export interface TraceChain {
  epic: { id: string; key: string; title: string; status: string };
  stories: Array<{ id: string; key: string; title: string; status: string }>;
  pullRequests: Array<{ id: string; number: string; title: string; status: string; branch: string; linkedIssueKey: string | null }>;
  builds: Array<{ id: string; name: string | null; status: string; coverage: number | null }>;
  deployments: Array<{ id: string; environment: string; status: string; deployedAt: string }>;
  unlinkedPrs: Array<{ id: string; number: string; title: string; branch: string }>;
}
export interface TraceLink {
  id: string; projectId: string;
  sourceType: string; sourceId: string;
  targetType: string; targetId: string;
  linkMechanism: string; createdAt: string;
}
export interface CreateLinkPayload {
  sourceType: string; sourceId: string;
  targetType: string; targetId: string;
  linkMechanism?: string;
}

export const traceabilityService = {
  getTrace: (projectId: string, epicKey: string) =>
    api.get<TraceChain>(`/projects/${projectId}/trace`, { epicKey }),

  listLinks: (projectId: string, sourceType?: string, sourceId?: string) =>
    api.get<TraceLink[]>(`/projects/${projectId}/trace/links`, { sourceType, sourceId }),

  createLink: (projectId: string, data: CreateLinkPayload) =>
    api.post<TraceLink>(`/projects/${projectId}/trace/links`, data),

  deleteLink: (projectId: string, linkId: string) =>
    api.delete<void>(`/projects/${projectId}/trace/links/${linkId}`),
};
