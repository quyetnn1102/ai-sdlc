import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildDag, type DagEdge } from './dag.builder';
import { NotificationService } from './notification.service';
import { SchedulerService } from './scheduler.service';
import { MonitoringService } from './monitoring.service';
import { TaskStatus } from '../../common/enums';
import { AuditService } from '../../common/audit/audit.service';

// Forward-declare to avoid circular DI (AgentRuntimeModule imports OrchestrationModule)
// We inject AgentExecutorService optionally so OrchestrationModule can boot alone.
type IAgentExecutor = {
  start(ctx: {
    workflowExecutionId: string;
    workflowTaskId: string;
    agentInstanceId: string;
    agentProfileId: string;
    phaseName: string;
    inputArtifacts: Array<{ name: string; artifactType: string; contentRef: string; metadata?: Record<string, unknown> }>;
    sessionId: string;
    heartbeatIntervalMs: number;
    taskTimeoutMs: number;
  }): Promise<void>;
};

// ── DTOs ──────────────────────────────────────────────────────────────────

export interface WorkflowConfig {
  maxConcurrency?: number;        // default 5
  heartbeatIntervalSec?: number;  // default 30
  startupTimeoutSec?: number;     // default 60
  taskTimeoutSec?: number;        // default 600
  maxRetries?: number;            // default 2
  phaseFilter?: string[];         // restrict to named phases
  atRiskThresholdSec?: number;    // flag tasks running longer than this (default 300)
}

export interface StartExecutionDto {
  projectId: string;
  initiatedBy?: string;
  config?: WorkflowConfig;
}

export interface CompleteTaskDto {
  taskId: string;
  agentInstanceId: string;
  status: 'DONE' | 'FAILED';
  error?: string;
  durationMs?: number;
  artifacts?: Array<{
    artifactType: string;
    name: string;
    contentRef: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface PatchExecutionDto {
  action: 'pause' | 'resume' | 'cancel';
}

// ── Constants ─────────────────────────────────────────────────────────────

export const AGENT_EXECUTOR_TOKEN = 'AGENT_EXECUTOR';

const DEFAULT_MAX_CONCURRENCY   = 5;
const DEFAULT_MAX_RETRIES       = 2;
const HEARTBEAT_MULTIPLIER      = 2;   // miss 2× interval → timed out
const DEFAULT_AT_RISK_THRESHOLD = 300; // seconds
const DEFAULT_HEARTBEAT_SEC     = 30;
const DEFAULT_TASK_TIMEOUT_SEC  = 600;

@Injectable()
export class OrchestrationService {
  private readonly logger = new Logger(OrchestrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
    private readonly scheduler: SchedulerService,
    private readonly monitoring: MonitoringService,
    @Optional() private readonly agentExecutor?: IAgentExecutor,
  ) {}

  // ──────────────────────────────────────────────────────────────────────
  // START
  // ──────────────────────────────────────────────────────────────────────
  async start(dto: StartExecutionDto) {
    const { projectId, initiatedBy, config = {} } = dto;

    // 1. Validate mappings exist
    const mappings = await this.prisma.phaseAgentMapping.findMany({
      where: { projectId },
      include: { agentProfile: true },
      orderBy: [{ phaseId: 'asc' }, { priority: 'asc' }],
    });

    if (!mappings.length) {
      throw new BadRequestException(
        'No phase-agent mappings configured for this project. Add mappings first.',
      );
    }

    // 2. Load ordered phases
    const phases = await this.prisma.workflowPhase.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    const phaseFilter = config.phaseFilter;
    const activeMappings = phaseFilter?.length
      ? mappings.filter((m) =>
          phases.some((p) => p.id === m.phaseId && phaseFilter.includes(p.name)),
        )
      : mappings;

    // 3. Create execution
    const execution = await this.prisma.workflowExecution.create({
      data: {
        projectId,
        status: 'RUNNING',
        startedAt: new Date(),
        initiatedBy: initiatedBy ?? null,
        config: config as object,
      },
    });

    // 4. Create one WorkflowTask per phase-mapping, check for unresolvable phases
    const createdTasks: Array<{ id: string; phaseId: string; order: number }> = [];
    const unmappedPhases: string[] = [];

    for (const phase of phases) {
      const phaseMappings = activeMappings.filter((m) => m.phaseId === phase.id);
      if (phaseMappings.length === 0) {
        unmappedPhases.push(phase.name);
        this.logger.warn(`Phase "${phase.name}" has no agent mapping — skipping`);
        continue;
      }
      for (const mapping of phaseMappings) {
        const task = await this.prisma.workflowTask.create({
          data: {
            workflowExecutionId: execution.id,
            phaseId: phase.id,
            phaseName: phase.name,
            agentProfileId: mapping.agentProfileId,
            status: 'PENDING',
          },
        });
        createdTasks.push({ id: task.id, phaseId: phase.id, order: phase.order });
      }
    }

    // Req 3.5 — if NO tasks could be created at all, mark as BLOCKED
    if (createdTasks.length === 0) {
      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: { status: 'BLOCKED' },
      });

      // Req 6.4 — notify project owner that workflow is blocked
      await this.notifications.notifyWorkflowBlocked({
        projectId,
        executionId: execution.id,
        reason: `No agent mappings found for any workflow phase. Unmapped phases: ${unmappedPhases.join(', ') || 'all phases'}`,
      });

      return this.getExecutionStatus(execution.id);
    }

    // 5. Wire sequential phase dependencies
    const tasksByOrder = createdTasks.reduce<Record<number, string[]>>((acc, t) => {
      const ph = phases.find((p) => p.id === t.phaseId);
      const order = ph?.order ?? 0;
      (acc[order] ??= []).push(t.id);
      return acc;
    }, {});

    const orderKeys = Object.keys(tasksByOrder).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < orderKeys.length; i++) {
      const prevTasks = tasksByOrder[orderKeys[i - 1]];
      const currTasks = tasksByOrder[orderKeys[i]];
      for (const currTaskId of currTasks) {
        for (const prevTaskId of prevTasks) {
          await this.prisma.taskDependency
            .create({ data: { taskId: currTaskId, dependsOnTaskId: prevTaskId } })
            .catch(() => {}); // ignore duplicates on re-run
        }
      }
    }

    // 6. Dispatch first wave
    const eligible = await this.scheduler.getEligibleTaskIds(execution.id);
    await this.scheduler.dispatch(eligible, config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY, projectId, this.agentExecutor);

    this.logger.log(
      `Execution ${execution.id} started: ${createdTasks.length} tasks, ` +
        `${eligible.length} dispatched (${unmappedPhases.length} phases skipped)`,
    );

    this.audit.log({
      userId: initiatedBy,
      action: 'START_WORKFLOW_EXECUTION',
      resource: `workflow_execution:${execution.id}`,
      details: { projectId, taskCount: createdTasks.length, skippedPhases: unmappedPhases },
    });

    return this.getExecutionStatus(execution.id);
  }

  // ──────────────────────────────────────────────────────────────────────
  // PAUSE / RESUME / CANCEL
  // ──────────────────────────────────────────────────────────────────────
  async pause(executionId: string) {
    const ex = await this.findExecution(executionId);
    if (ex.status !== 'RUNNING') {
      throw new BadRequestException(`Execution is not running (status: ${ex.status})`);
    }
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'PAUSED' },
    });
    return this.getExecutionStatus(executionId);
  }

  async resume(executionId: string) {
    const execution = await this.findExecution(executionId);
    if (execution.status !== 'PAUSED') {
      throw new BadRequestException(`Execution is not paused (status: ${execution.status})`);
    }
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'RUNNING' },
    });
    const eligible = await this.scheduler.getEligibleTaskIds(executionId);
    const cfg = execution.config as WorkflowConfig | null;
    await this.scheduler.dispatch(
      eligible,
      cfg?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
      execution.projectId,
      this.agentExecutor,
    );
    return this.monitoring.getExecutionStatus(executionId);
  }

  async cancel(executionId: string) {
    const execution = await this.findExecution(executionId);

    // Req 9.4 — signal shouldTerminate to all running instances
    const runningTasks = await this.prisma.workflowTask.findMany({
      where: { workflowExecutionId: executionId, status: { in: ['STARTING', 'RUNNING'] } },
      select: { id: true },
    });
    if (runningTasks.length > 0) {
      await this.prisma.agentInstance.updateMany({
        where: {
          workflowTaskId: { in: runningTasks.map((t) => t.id) },
          status: { in: ['STARTING', 'RUNNING'] },
        },
        data: { shouldTerminate: true },
      });
    }

    // Req 9.4 — mark all pending/running tasks as CANCELLED
    await this.prisma.workflowTask.updateMany({
      where: {
        workflowExecutionId: executionId,
        status: { in: ['PENDING', 'STARTING', 'RUNNING'] },
      },
      data: { status: 'CANCELLED' },
    });

    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    this.logger.log(`Execution ${executionId} cancelled`);
    this.audit.log({
      action: 'CANCEL_WORKFLOW_EXECUTION',
      resource: `workflow_execution:${executionId}`,
    });
    return this.getExecutionStatus(executionId);
  }

  // ──────────────────────────────────────────────────────────────────────
  // COMPLETION CALLBACK (Req 6.1 – 6.5)
  // ──────────────────────────────────────────────────────────────────────
  async completeTask(dto: CompleteTaskDto) {
    const task = await this.prisma.workflowTask.findUnique({
      where: { id: dto.taskId },
      include: { execution: true },
    });
    if (!task) throw new NotFoundException(`Task ${dto.taskId} not found`);

    // ── Idempotency: if task is already terminal, return current state ──
    const terminalStatuses = [TaskStatus.DONE, TaskStatus.FAILED, TaskStatus.TIMED_OUT, TaskStatus.CANCELLED];
    if (terminalStatuses.includes(task.status as TaskStatus)) {
      this.logger.warn(
        `Duplicate callback for task ${dto.taskId} (already ${task.status}) — ignoring`,
      );
      return { taskId: dto.taskId, status: task.status, duplicate: true };
    }

    const now = new Date();
    const cfg = task.execution.config as WorkflowConfig | null;
    const maxRetries = cfg?.maxRetries ?? DEFAULT_MAX_RETRIES;

    // Update agent instance — wrap in transaction with task + artifacts
    await this.prisma.$transaction(async (tx) => {
      // Update instance
      await tx.agentInstance.updateMany({
        where: { id: dto.agentInstanceId },
        data: {
          status: dto.status,
          completedAt: now,
          durationMs: dto.durationMs ?? null,
          error: dto.error ?? null,
          shouldTerminate: false,
        },
      });

      // Update task
      await tx.workflowTask.update({
        where: { id: dto.taskId },
        data: {
          status: dto.status === 'DONE' ? 'DONE' : 'FAILED',
          completedAt: now,
          durationMs: dto.durationMs ?? null,
          error: dto.error ?? null,
        },
      });

      // Req 6.2 + 7.1 — persist artifact outputs
      if (dto.artifacts?.length) {
        await tx.artifactOutput.createMany({
          data: dto.artifacts.map((a) => ({
            workflowTaskId: dto.taskId,
            agentInstanceId: dto.agentInstanceId,
            artifactType: a.artifactType,
            name: a.name,
            contentRef: a.contentRef,
            metadata: (a.metadata ?? {}) as any,
          })),
        });
      }
    });

    const execution = task.execution;

    if (dto.status === 'DONE' && execution.status === 'RUNNING') {
      // Re-evaluate DAG
      const eligible = await this.scheduler.getEligibleTaskIds(execution.id);
      await this.scheduler.dispatch(
        eligible,
        cfg?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
        execution.projectId,
        this.agentExecutor,
      );
      await this.checkCompletion(execution.id, now);
    } else if (dto.status === 'FAILED') {
      if (task.retryCount < maxRetries) {
        // Retry — reset task to PENDING
        await this.prisma.workflowTask.update({
          where: { id: dto.taskId },
          data: { status: 'PENDING', retryCount: { increment: 1 }, error: null },
        });
        this.logger.warn(
          `Task ${dto.taskId} failed — retry ${task.retryCount + 1}/${maxRetries}`,
        );
        const eligible = await this.scheduler.getEligibleTaskIds(execution.id);
        await this.scheduler.dispatch(
          eligible,
          cfg?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
          execution.projectId,
          this.agentExecutor,
        );
      } else {
        this.logger.error(`Task ${dto.taskId} failed after ${maxRetries} retries`);

        // Req 6.4 — notify project owner of permanent task failure
        const agentProfile = await this.prisma.agentProfile.findUnique({
          where: { id: task.agentProfileId },
          select: { name: true },
        });
        await this.notifications.notifyTaskFailed({
          projectId: execution.projectId,
          executionId: execution.id,
          taskId: dto.taskId,
          phaseName: task.phaseName,
          agentName: agentProfile?.name ?? task.agentProfileId,
          retryCount: task.retryCount + 1,
          error: dto.error,
        });

        // Req 6.5 — check if execution is now complete (all terminal)
        await this.checkCompletion(execution.id, now);
      }
    }

    return { taskId: dto.taskId, status: dto.status };
  }

  // ──────────────────────────────────────────────────────────────────────
  // HEARTBEAT (Req 5.4) — returns shouldTerminate flag
  // ──────────────────────────────────────────────────────────────────────
  async heartbeat(agentInstanceId: string) {
    const instance = await this.prisma.agentInstance.findUnique({
      where: { id: agentInstanceId },
    });
    if (!instance) {
      return { acknowledged: false, shouldTerminate: true };
    }

    await this.prisma.agentInstance.update({
      where: { id: agentInstanceId },
      data: { lastHeartbeat: new Date() },
    });

    return { acknowledged: true, shouldTerminate: instance.shouldTerminate };
  }

  // ──────────────────────────────────────────────────────────────────────
  // TIMEOUT DETECTION (Req 5.5) — cron-callable
  // ──────────────────────────────────────────────────────────────────────
  async detectTimedOutAgents() {
    const runningInstances = await this.prisma.agentInstance.findMany({
      where: { status: 'RUNNING', lastHeartbeat: { not: null } },
    });

    const now = Date.now();
    const timedOut: string[] = [];

    for (const inst of runningInstances) {
      const threshold = inst.heartbeatIntervalSec * HEARTBEAT_MULTIPLIER * 1000;
      const lastBeat = inst.lastHeartbeat?.getTime() ?? 0;
      if (now - lastBeat > threshold) {
        timedOut.push(inst.id);
        await this.prisma.$transaction([
          this.prisma.agentInstance.update({
            where: { id: inst.id },
            data: { status: 'TIMED_OUT', completedAt: new Date(), error: 'Heartbeat timeout' },
          }),
          this.prisma.workflowTask.update({
            where: { id: inst.workflowTaskId },
            data: { status: 'TIMED_OUT', error: 'Agent heartbeat timeout' },
          }),
        ]);
        this.logger.warn(`Agent instance ${inst.id} timed out (no heartbeat for ${Math.round((now - lastBeat) / 1000)}s)`);
      }
    }

    return { checked: runningInstances.length, timedOut };
  }

  // ──────────────────────────────────────────────────────────────────────
  // QUERY — execution detail with progress (Req 8.1 / 8.4)
  // ──────────────────────────────────────────────────────────────────────
  // ── Delegate read-only queries to MonitoringService ──────────────────
  getExecutionStatus(executionId: string) {
    return this.monitoring.getExecutionStatus(executionId);
  }

  listExecutions(projectId: string, query?: { page?: number; limit?: number }) {
    return this.monitoring.listExecutions(projectId, query);
  }

  getTaskList(executionId: string) {
    return this.monitoring.getTaskList(executionId);
  }

  getDag(executionId: string) {
    return this.monitoring.getDag(executionId);
  }

  getArtifacts(executionId: string) {
    return this.monitoring.getArtifacts(executionId);
  }

  // ── PRIVATE HELPERS ───────────────────────────────────────────────────

  private async findExecution(id: string) {
    const ex = await this.prisma.workflowExecution.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Execution not found');
    return ex;
  }

  /** Req 6.5 — mark execution complete when all tasks are terminal */
  private async checkCompletion(executionId: string, now: Date) {
    const remaining = await this.prisma.workflowTask.count({
      where: {
        workflowExecutionId: executionId,
        status: { in: ['PENDING', 'STARTING', 'RUNNING'] },
      },
    });
    if (remaining > 0) return;

    const [failed, done, execution] = await Promise.all([
      this.prisma.workflowTask.count({
        where: { workflowExecutionId: executionId, status: { in: ['FAILED', 'TIMED_OUT'] } },
      }),
      this.prisma.workflowTask.count({
        where: { workflowExecutionId: executionId, status: 'DONE' },
      }),
      this.prisma.workflowExecution.findUnique({
        where: { id: executionId },
        select: { projectId: true, startedAt: true },
      }),
    ]);

    const finalStatus = failed > 0 ? 'FAILED' : 'COMPLETED';
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: finalStatus, completedAt: now },
    });
    this.logger.log(`Execution ${executionId} → ${finalStatus}`);

    // Req 6.5 — send completion notification
    if (execution) {
      const durationMs = execution.startedAt
        ? now.getTime() - execution.startedAt.getTime()
        : undefined;
      await this.notifications.notifyWorkflowCompleted({
        projectId: execution.projectId,
        executionId,
        doneCount: done,
        failedCount: failed,
        durationMs,
      });
    }
  }
}
