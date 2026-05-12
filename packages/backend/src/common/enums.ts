/**
 * Shared status enums for the SDLC Hub backend.
 * Using string enums so values are readable in DB and logs.
 */

export enum WorkflowExecutionStatus {
  PENDING    = 'PENDING',
  RUNNING    = 'RUNNING',
  PAUSED     = 'PAUSED',
  COMPLETED  = 'COMPLETED',
  CANCELLED  = 'CANCELLED',
  FAILED     = 'FAILED',
  BLOCKED    = 'BLOCKED',
}

export enum TaskStatus {
  PENDING    = 'PENDING',
  STARTING   = 'STARTING',
  RUNNING    = 'RUNNING',
  DONE       = 'DONE',
  FAILED     = 'FAILED',
  TIMED_OUT  = 'TIMED_OUT',
  CANCELLED  = 'CANCELLED',
  SKIPPED    = 'SKIPPED',
}

export enum AgentInstanceStatus {
  PENDING    = 'PENDING',
  STARTING   = 'STARTING',
  RUNNING    = 'RUNNING',
  DONE       = 'DONE',
  FAILED     = 'FAILED',
  TIMED_OUT  = 'TIMED_OUT',
}

export enum AgentRole {
  BA_AGENT       = 'BA_AGENT',
  DEV_AGENT      = 'DEV_AGENT',
  QA_AGENT       = 'QA_AGENT',
  DEVOPS_AGENT   = 'DEVOPS_AGENT',
  DESIGNER_AGENT = 'DESIGNER_AGENT',
  SRE_AGENT      = 'SRE_AGENT',
}

export enum IntegrationStatus {
  ACTIVE       = 'ACTIVE',
  DEGRADED     = 'DEGRADED',
  DISCONNECTED = 'DISCONNECTED',
}

export enum WebhookEventStatus {
  RECEIVED  = 'RECEIVED',
  PROCESSED = 'PROCESSED',
  FAILED    = 'FAILED',
}

export enum MembershipRole {
  ADMIN          = 'ADMIN',
  PROJECT_OWNER  = 'PROJECT_OWNER',
  DEVELOPER      = 'DEVELOPER',
  QA             = 'QA',
  DEVOPS         = 'DEVOPS',
  READONLY       = 'READONLY',
}

/** Terminal states — execution/task cannot progress further */
export const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.DONE,
  TaskStatus.FAILED,
  TaskStatus.TIMED_OUT,
  TaskStatus.CANCELLED,
  TaskStatus.SKIPPED,
];

export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.STARTING,
  TaskStatus.RUNNING,
];
