import { api } from '@/lib/api';

export type GateRuleType = 'MIN_COVERAGE' | 'MAX_CRITICAL_ISSUES' | 'CI_CHECK_PASS';
export type GateStatus = 'PASS' | 'FAIL' | 'PENDING';

export interface GateDefinition {
  id: string;
  name: string;
  ruleType: GateRuleType;
  ruleConfig: Record<string, unknown>;
  enforcement: 'ADVISORY' | 'BLOCKING';
  workflowPhase: { id: string; name: string; order: number };
  evaluations: Array<{ id: string; status: GateStatus; evaluatedAt: string }>;
}
export interface GateStatusSummary {
  id: string; name: string; phase: string;
  ruleType: GateRuleType; enforcement: string;
  latestStatus: GateStatus; lastEvaluated: string | null;
}
export interface CreateGatePayload {
  name: string; workflowPhaseId: string;
  ruleType: GateRuleType; ruleConfig: Record<string, unknown>;
  enforcement?: 'ADVISORY' | 'BLOCKING';
}

export const gatesService = {
  list: (projectId: string) =>
    api.get<GateDefinition[]>(`/projects/${projectId}/gates`),

  status: (projectId: string) =>
    api.get<GateStatusSummary[]>(`/projects/${projectId}/gates/status`),

  create: (projectId: string, data: CreateGatePayload) =>
    api.post<GateDefinition>(`/projects/${projectId}/gates`, data),

  evaluate: (projectId: string, buildId: string) =>
    api.post<{ results: Array<{ gateId: string; gateName: string; status: string }> }>(
      `/projects/${projectId}/gates/evaluate`, undefined, { buildId },
    ),

  delete: (projectId: string, gateId: string) =>
    api.delete<void>(`/projects/${projectId}/gates/${gateId}`),
};
