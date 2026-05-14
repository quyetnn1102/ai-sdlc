/**
 * Workspace API client service.
 * Provides typed functions for all workspace-related API calls.
 */
import { api } from '@/lib/api';

// ============================================
// Shared Types
// ============================================

export interface Skill {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  content: string;
  inputs: SkillIO[] | null;
  outputs: SkillIO[] | null;
  metadata: Record<string, unknown> | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillIO {
  name: string;
  type: string;
  description?: string;
}

export interface SkillTemplate {
  name: string;
  description: string;
  content: string;
}

export interface SkillValidationResult {
  valid: boolean;
  errors?: Array<{ field: string; message: string }>;
}

export interface CreateSkillPayload {
  name: string;
  description?: string;
  content: string;
  inputs?: SkillIO[];
  outputs?: SkillIO[];
  metadata?: Record<string, unknown>;
}

export interface UpdateSkillPayload {
  name?: string;
  description?: string;
  content?: string;
  inputs?: SkillIO[];
  outputs?: SkillIO[];
  metadata?: Record<string, unknown>;
  displayOrder?: number;
}

export interface Pipeline {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  steps: PipelineStep[];
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStep {
  id: string;
  pipelineId: string;
  agentProfileId: string;
  stepOrder: number;
  onFailure: 'stop' | 'continue';
}

export interface CreatePipelinePayload {
  name: string;
  description?: string;
  steps: Array<{ agentProfileId: string; onFailure?: 'stop' | 'continue' }>;
}

export interface UpdatePipelinePayload {
  name?: string;
  description?: string;
  displayOrder?: number;
}

export interface ReorderStepsPayload {
  stepIds: string[];
}

export interface EpicRun {
  id: string;
  projectId: string;
  pipelineId: string;
  workItemId: string;
  status: EpicRunStatus;
  currentStep: number;
  startedAt: string | null;
  completedAt: string | null;
  initiatedBy: string;
  steps: EpicRunStep[];
  createdAt: string;
  updatedAt: string;
}

export type EpicRunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface EpicRunStep {
  id: string;
  epicRunId: string;
  pipelineStepId: string;
  agentProfileId: string;
  stepOrder: number;
  status: EpicRunStepStatus;
  output: string | null;
  feedback: string | null;
  context: string | null;
  startedAt: string | null;
  completedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EpicRunStepStatus = 'pending' | 'running' | 'completed' | 'approved' | 'rejected' | 'failed' | 'skipped';

export interface CreateEpicRunPayload {
  pipelineId: string;
  workItemId: string;
}

export interface RejectStepPayload {
  feedback: string;
}

export interface RerunStepPayload {
  context?: string;
}

export interface EpicRunHistoryEntry {
  id: string;
  epicRunId: string;
  stepOrder: number;
  action: string;
  actor: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface WorkspaceConfig {
  id: string;
  projectId: string;
  slashCommands: SlashCommand[] | null;
  metadata: Record<string, unknown> | null;
  yamlContent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SlashCommand {
  name: string;
  description: string;
  action: string;
}

export interface UpdateWorkspaceConfigPayload {
  slashCommands?: SlashCommand[];
  metadata?: Record<string, unknown>;
}

export interface WorkspaceYamlResponse {
  yaml: string;
}

export interface InspectResult {
  valid: boolean;
  resolvedYaml?: string;
  entities?: {
    agents: number;
    skills: number;
    pipelines: number;
    slashCommands: number;
  };
  errors?: Array<{ line: number; message: string }>;
  warnings?: Array<{ variable: string; message: string }>;
}

export interface WorkspaceStatus {
  agents: number;
  skills: number;
  pipelines: number;
  activeRuns: Record<EpicRunStatus, number>;
  slashCommands: SlashCommand[];
}

export interface WorkspaceTemplate {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  isBuiltIn: boolean;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplatePayload {
  name: string;
  description?: string;
  projectId: string;
}

export interface ApplyTemplatePayload {
  projectId: string;
  conflictResolution?: 'skip' | 'rename' | 'overwrite';
}

export interface DemoLoadResult {
  success: boolean;
  message: string;
}

export interface DemoStatus {
  loaded: boolean;
  entityCounts?: {
    agents: number;
    skills: number;
    pipelines: number;
    epics: number;
  };
}

// ============================================
// Skills API
// ============================================

export const skillsApi = {
  list: (projectId: string) =>
    api.get<Skill[]>(`/projects/${projectId}/skills`),

  getById: (projectId: string, id: string) =>
    api.get<Skill>(`/projects/${projectId}/skills/${id}`),

  create: (projectId: string, data: CreateSkillPayload) =>
    api.post<Skill>(`/projects/${projectId}/skills`, data),

  update: (projectId: string, id: string, data: UpdateSkillPayload) =>
    api.put<Skill>(`/projects/${projectId}/skills/${id}`, data),

  delete: (projectId: string, id: string) =>
    api.delete<void>(`/projects/${projectId}/skills/${id}`),

  validate: (projectId: string, content: string) =>
    api.post<SkillValidationResult>(`/projects/${projectId}/skills/validate`, { content }),

  templates: (projectId: string) =>
    api.get<SkillTemplate[]>(`/projects/${projectId}/skills/templates`),
};

// ============================================
// Pipelines API
// ============================================

export const pipelinesApi = {
  list: (projectId: string) =>
    api.get<Pipeline[]>(`/projects/${projectId}/pipelines`),

  getById: (projectId: string, id: string) =>
    api.get<Pipeline>(`/projects/${projectId}/pipelines/${id}`),

  create: (projectId: string, data: CreatePipelinePayload) =>
    api.post<Pipeline>(`/projects/${projectId}/pipelines`, data),

  update: (projectId: string, id: string, data: UpdatePipelinePayload) =>
    api.put<Pipeline>(`/projects/${projectId}/pipelines/${id}`, data),

  reorderSteps: (projectId: string, id: string, stepIds: string[]) =>
    api.put<Pipeline>(`/projects/${projectId}/pipelines/${id}/steps`, { stepIds }),

  delete: (projectId: string, id: string) =>
    api.delete<void>(`/projects/${projectId}/pipelines/${id}`),
};

// ============================================
// Epic Runs API
// ============================================

export const epicRunsApi = {
  list: (projectId: string, status?: EpicRunStatus) =>
    api.get<EpicRun[]>(`/projects/${projectId}/epic-runs`, status ? { status } : undefined),

  getById: (projectId: string, id: string) =>
    api.get<EpicRun>(`/projects/${projectId}/epic-runs/${id}`),

  create: (projectId: string, data: CreateEpicRunPayload) =>
    api.post<EpicRun>(`/projects/${projectId}/epic-runs`, data),

  approveStep: (projectId: string, id: string, stepId: string) =>
    api.post<EpicRunStep>(`/projects/${projectId}/epic-runs/${id}/steps/${stepId}/approve`),

  rejectStep: (projectId: string, id: string, stepId: string, feedback: string) =>
    api.post<EpicRunStep>(`/projects/${projectId}/epic-runs/${id}/steps/${stepId}/reject`, { feedback }),

  rerunStep: (projectId: string, id: string, stepId: string, context?: string) =>
    api.post<EpicRunStep>(`/projects/${projectId}/epic-runs/${id}/steps/${stepId}/rerun`, { context }),

  history: (projectId: string, id: string) =>
    api.get<EpicRunHistoryEntry[]>(`/projects/${projectId}/epic-runs/${id}/history`),
};

// ============================================
// Workspace Config API
// ============================================

export const workspaceApi = {
  getConfig: (projectId: string) =>
    api.get<WorkspaceConfig>(`/projects/${projectId}/workspace/config`),

  updateConfig: (projectId: string, data: UpdateWorkspaceConfigPayload) =>
    api.put<WorkspaceConfig>(`/projects/${projectId}/workspace/config`, data),

  getYaml: (projectId: string) =>
    api.get<WorkspaceYamlResponse>(`/projects/${projectId}/workspace/yaml`),

  inspect: (projectId: string) =>
    api.post<InspectResult>(`/projects/${projectId}/workspace/inspect`),

  getStatus: (projectId: string) =>
    api.get<WorkspaceStatus>(`/projects/${projectId}/workspace/status`),
};

// ============================================
// Templates API
// ============================================

export const templatesApi = {
  list: (orgId: string) =>
    api.get<WorkspaceTemplate[]>(`/organizations/${orgId}/workspace-templates`),

  getById: (orgId: string, id: string) =>
    api.get<WorkspaceTemplate>(`/organizations/${orgId}/workspace-templates/${id}`),

  save: (orgId: string, data: CreateTemplatePayload) =>
    api.post<WorkspaceTemplate>(`/organizations/${orgId}/workspace-templates`, data),

  apply: (orgId: string, id: string, data: ApplyTemplatePayload) =>
    api.post<void>(`/organizations/${orgId}/workspace-templates/${id}/apply`, data),

  delete: (orgId: string, id: string) =>
    api.delete<void>(`/organizations/${orgId}/workspace-templates/${id}`),
};

// ============================================
// Demo API
// ============================================

export const demoApi = {
  load: (projectId: string) =>
    api.post<DemoLoadResult>(`/projects/${projectId}/workspace/demo/load`),

  status: (projectId: string) =>
    api.get<DemoStatus>(`/projects/${projectId}/workspace/demo/status`),
};

// ============================================
// Token Usage API
// ============================================

export interface TokenUsageTodayResponse {
  totalTokens: number;
  estimatedCost: number;
}

export interface TokenUsageReportResponse {
  today: { totalTokens: number; estimatedCost: number };
  thisMonth: { totalTokens: number; estimatedCost: number };
  byModel: Array<{ model: string; tokens: number; percentage: number }>;
  byAgent: Array<{ agentName: string; tokens: number; percentage: number }>;
  dailyTrend: Array<{ date: string; cost: number }>;
}

export interface TokenUsageAggregation {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
}

export interface RequestUpdatePayload {
  reason?: string;
  context?: string;
}

export const tokenUsageApi = {
  today: (projectId: string) =>
    api.get<TokenUsageTodayResponse>(`/projects/${projectId}/workspace/token-usage/today`),

  report: (projectId: string) =>
    api.get<TokenUsageReportResponse>(`/projects/${projectId}/workspace/token-usage/report`),

  epicRunUsage: (projectId: string, epicRunId: string) =>
    api.get<TokenUsageAggregation>(`/projects/${projectId}/workspace/token-usage/epic-run/${epicRunId}`),

  stepUsage: (projectId: string, stepId: string) =>
    api.get<TokenUsageAggregation>(`/projects/${projectId}/workspace/token-usage/step/${stepId}`),

  suggestions: (projectId: string) =>
    api.get(`/projects/${projectId}/workspace/token-usage/suggestions`),
};

export const epicRunsExtendedApi = {
  requestUpdate: (projectId: string, id: string, stepId: string, data: RequestUpdatePayload) =>
    api.post(`/projects/${projectId}/epic-runs/${id}/steps/${stepId}/request-update`, data),
};
