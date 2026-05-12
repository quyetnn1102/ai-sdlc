import { api } from '@/lib/api';

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
export type TaskStatus = 'PENDING' | 'STARTING' | 'RUNNING' | 'DONE' | 'FAILED' | 'TIMED_OUT' | 'SKIPPED';

export interface ArtifactOutput {
  id: string;
  workflowTaskId: string;
  artifactType: string;
  name: string;
  contentRef: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowTask {
  id: string;
  phaseName: string;
  status: TaskStatus;
  agentProfile: { id: string; name: string; role: string };
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  retryCount: number;
  error?: string;
  artifacts: ArtifactOutput[];
  dependencies: Array<{ dependsOnTaskId: string }>;
  instances: Array<{ id: string; status: string; lastHeartbeat?: string }>;
}

export interface WorkflowExecution {
  id: string;
  projectId: string;
  status: ExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  initiatedBy?: string;
  config?: Record<string, unknown>;
  createdAt: string;
  tasks: WorkflowTask[];
}

export interface WorkflowExecutionSummary {
  id: string;
  status: ExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  _count: { tasks: number };
}

export const executionsService = {
  start: (projectId: string, config?: Record<string, unknown>) =>
    api.post<WorkflowExecution>(`/projects/${projectId}/workflow-executions`, { config }),

  list: (projectId: string) =>
    api.get<WorkflowExecutionSummary[]>(`/projects/${projectId}/workflow-executions`),

  get: (projectId: string, executionId: string) =>
    api.get<WorkflowExecution>(`/projects/${projectId}/workflow-executions/${executionId}`),

  pause: (projectId: string, executionId: string) =>
    api.patch<WorkflowExecution>(`/projects/${projectId}/workflow-executions/${executionId}/pause`),

  resume: (projectId: string, executionId: string) =>
    api.patch<WorkflowExecution>(`/projects/${projectId}/workflow-executions/${executionId}/resume`),

  cancel: (projectId: string, executionId: string) =>
    api.patch<WorkflowExecution>(`/projects/${projectId}/workflow-executions/${executionId}/cancel`),
};
