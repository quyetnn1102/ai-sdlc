import { api } from '@/lib/api';
import type { DagData } from '@/components/dag/DagVisualization';

export type ExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'BLOCKED';

export type TaskStatus =
  | 'PENDING'
  | 'STARTING'
  | 'RUNNING'
  | 'DONE'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'SKIPPED'
  | 'CANCELLED';

export interface ArtifactOutput {
  id: string;
  workflowTaskId: string;
  agentInstanceId?: string;
  aiDlcArtifactId?: string;
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
  elapsedMs?: number | null;
  durationMs?: number | null;
  retryCount: number;
  error?: string;
  isAtRisk: boolean;
  artifacts: ArtifactOutput[];
  dependencies: Array<{ dependsOnTaskId: string }>;
  instances: Array<{
    id: string;
    status: string;
    lastHeartbeat?: string;
    shouldTerminate?: boolean;
    durationMs?: number;
    error?: string;
  }>;
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
  progress: { completed: number; total: number; percentage: number };
}

export interface WorkflowExecutionSummary {
  id: string;
  status: ExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  _count: { tasks: number };
}

export interface ArtifactsByPhase {
  executionId: string;
  totalArtifacts: number;
  byPhase: Array<{
    phaseId: string;
    phaseName: string;
    artifacts: ArtifactOutput[];
  }>;
}

export const executionsService = {
  start: (projectId: string, config?: Record<string, unknown>) =>
    api.post<WorkflowExecution>(`/projects/${projectId}/workflow-executions`, { config }),

  list: (projectId: string) =>
    api.get<WorkflowExecutionSummary[]>(`/projects/${projectId}/workflow-executions`),

  get: (projectId: string, executionId: string) =>
    api.get<WorkflowExecution>(`/projects/${projectId}/workflow-executions/${executionId}`),

  /** GET /tasks — flat task list with elapsed + at-risk */
  getTasks: (projectId: string, executionId: string) =>
    api.get<WorkflowTask[]>(
      `/projects/${projectId}/workflow-executions/${executionId}/tasks`,
    ),

  /** GET /dag — full DAG structure for visualization */
  getDag: (projectId: string, executionId: string) =>
    api.get<DagData>(`/projects/${projectId}/workflow-executions/${executionId}/dag`),

  /** GET /artifacts — all artifacts grouped by phase */
  getArtifacts: (projectId: string, executionId: string) =>
    api.get<ArtifactsByPhase>(
      `/projects/${projectId}/workflow-executions/${executionId}/artifacts`,
    ),

  pause: (projectId: string, executionId: string) =>
    api.patch<WorkflowExecution>(
      `/projects/${projectId}/workflow-executions/${executionId}`,
      { action: 'pause' },
    ),

  resume: (projectId: string, executionId: string) =>
    api.patch<WorkflowExecution>(
      `/projects/${projectId}/workflow-executions/${executionId}`,
      { action: 'resume' },
    ),

  cancel: (projectId: string, executionId: string) =>
    api.patch<WorkflowExecution>(
      `/projects/${projectId}/workflow-executions/${executionId}`,
      { action: 'cancel' },
    ),
};
