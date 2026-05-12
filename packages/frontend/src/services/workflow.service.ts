import { api } from '@/lib/api';

export interface WorkflowPhase {
  id: string;
  name: string;
  order: number;
  color: string;
  projectId: string;
  statusMappings: StatusMapping[];
}
export interface StatusMapping {
  id: string;
  workflowPhaseId: string;
  externalStatus: string;
  source: string;
}
export interface CreatePhasePayload { name: string; order: number; color?: string; }
export interface CreateMappingPayload { externalStatus: string; source: string; }

export const workflowService = {
  listPhases: (projectId: string) =>
    api.get<WorkflowPhase[]>(`/projects/${projectId}/workflow/phases`),

  createPhase: (projectId: string, data: CreatePhasePayload) =>
    api.post<WorkflowPhase>(`/projects/${projectId}/workflow/phases`, data),

  updatePhase: (projectId: string, phaseId: string, data: Partial<CreatePhasePayload>) =>
    api.put<WorkflowPhase>(`/projects/${projectId}/workflow/phases/${phaseId}`, data),

  deletePhase: (projectId: string, phaseId: string) =>
    api.delete<void>(`/projects/${projectId}/workflow/phases/${phaseId}`),

  addMapping: (projectId: string, phaseId: string, data: CreateMappingPayload) =>
    api.post<StatusMapping>(
      `/projects/${projectId}/workflow/phases/${phaseId}/mappings`, data,
    ),

  removeMapping: (projectId: string, phaseId: string, mappingId: string) =>
    api.delete<void>(
      `/projects/${projectId}/workflow/phases/${phaseId}/mappings/${mappingId}`,
    ),
};
