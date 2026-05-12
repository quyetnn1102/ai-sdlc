import { api } from '@/lib/api';

export interface AgentProfile {
  id: string;
  projectId?: string;
  name: string;
  role: string;
  description?: string;
  skillSet: string[];
  supportedPhases: string[];
  isDefault: boolean;
  config?: Record<string, unknown>;
  createdAt: string;
  _count?: { phaseMappings: number };
}

export interface PhaseAgentMapping {
  id: string;
  projectId: string;
  phaseId: string;
  agentProfileId: string;
  priority: number;
  agentProfile: Pick<AgentProfile, 'id' | 'name' | 'role' | 'skillSet'>;
}

export interface CreateAgentProfilePayload {
  name: string;
  role: string;
  description?: string;
  skillSet?: string[];
  supportedPhases?: string[];
  config?: Record<string, unknown>;
}

export interface CreateMappingPayload {
  phaseId: string;
  agentProfileId: string;
  priority?: number;
}

export const agentsService = {
  seedDefaults: (projectId: string) =>
    api.post<{ seeded: number }>(`/projects/${projectId}/agents/seed`),

  listProfiles: (projectId: string) =>
    api.get<AgentProfile[]>(`/projects/${projectId}/agents/profiles`),

  getProfile: (projectId: string, id: string) =>
    api.get<AgentProfile>(`/projects/${projectId}/agents/profiles/${id}`),

  createProfile: (projectId: string, data: CreateAgentProfilePayload) =>
    api.post<AgentProfile>(`/projects/${projectId}/agents/profiles`, data),

  updateProfile: (projectId: string, id: string, data: Partial<CreateAgentProfilePayload>) =>
    api.put<AgentProfile>(`/projects/${projectId}/agents/profiles/${id}`, data),

  deleteProfile: (projectId: string, id: string) =>
    api.delete<void>(`/projects/${projectId}/agents/profiles/${id}`),

  listMappings: (projectId: string) =>
    api.get<PhaseAgentMapping[]>(`/projects/${projectId}/agents/mappings`),

  createMapping: (projectId: string, data: CreateMappingPayload) =>
    api.post<PhaseAgentMapping>(`/projects/${projectId}/agents/mappings`, data),

  deleteMapping: (projectId: string, id: string) =>
    api.delete<void>(`/projects/${projectId}/agents/mappings/${id}`),

  validateMappings: (projectId: string) =>
    api.post<{
      valid: boolean;
      issues: Array<{ phaseId: string; phaseName: string; agentProfileId?: string; issue: string; message: string }>;
    }>(`/projects/${projectId}/agents/mappings/validate`),

  getLlmProviders: (projectId: string) =>
    api.get<{ available: string[]; default: string }>(
      `/projects/${projectId}/agents/llm-providers`,
    ),
};
