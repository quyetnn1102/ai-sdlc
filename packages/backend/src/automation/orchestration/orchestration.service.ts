import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildDag, type DagEdge } from './dag.builder';

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
    const eligible = await this.getEligibleTasks(execution.id);
    await this.dispatchTasks(eligible, config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY, projectId);

    this.logger.log(
      `Execution ${execution.id} started: ${createdTasks.length} tasks, ` +
        `${eligible.length} dispatched (${unmappedPhases.length} phases skipped)`,
    );

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
    const eligible = await this.getEligibleTasks(executionId);
    const cfg = execution.config as WorkflowConfig | null;
    await this.dispatchTasks(
      eligible,
      cfg?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
      execution.projectId,
    );
    return this.getExecutionStatus(executionId);
  }

  async cancel(executionId: string) {
    const execution = await this.findExecution(executionId);

    // Req 9.4 — signal shouldTerminate to all running instances
    await this.prisma.agentInstance.updateMany({
      where: {
        workflowTask: { workflowExecutionId: executionId },
        status: { in: ['STARTING', 'RUNNING'] },
      },
      data: { shouldTerminate: true },
    });

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
            metadata: a.metadata ?? {},
          })),
        });
      }
    });

    const execution = task.execution;

    if (dto.status === 'DONE' && execution.status === 'RUNNING') {
      // Re-evaluate DAG
      const eligible = await this.getEligibleTasks(execution.id);
      await this.dispatchTasks(
        eligible,
        cfg?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
        execution.projectId,
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
        const eligible = await this.getEligibleTasks(execution.id);
        await this.dispatchTasks(
          eligible,
          cfg?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
          execution.projectId,
        );
      } else {
        this.logger.error(`Task ${dto.taskId} failed after ${maxRetries} retries`);
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
  async getExecutionStatus(executionId: string) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        tasks: {
          include: {
            agentProfile: { select: { id: true, name: true, role: true } },
            instances: {
              select: {
                id: true, status: true, lastHeartbeat: true,
                shouldTerminate: true, durationMs: true, error: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            artifacts: true,
            dependencies: { select: { dependsOnTaskId: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!execution) throw new NotFoundException('Execution not found');

    const cfg = execution.config as WorkflowConfig | null;
    const atRiskThresholdMs = (cfg?.atRiskThresholdSec ?? DEFAULT_AT_RISK_THRESHOLD) * 1000;
    const now = Date.now();

    const tasks = execution.tasks.map((t) => ({
      ...t,
      elapsedMs: t.startedAt ? now - t.startedAt.getTime() : null,
      isAtRisk:
        t.status === 'RUNNING' && t.startedAt
          ? now - t.startedAt.getTime() > atRiskThresholdMs
          : false,
    }));

    const dag = buildDag(
      tasks.map((t) => ({
        id: t.id,
        phaseName: t.phaseName,
        status: t.status,
        dependencies: t.dependencies,
      })),
    );
    const progress = dag.getProgress();

    return { ...execution, tasks, progress };
  }

  async listExecutions(projectId: string) {
    return this.prisma.workflowExecution.findMany({
      where: { projectId },
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // TASKS endpoint (Req 8.3 — GET /tasks)
  // ──────────────────────────────────────────────────────────────────────
  async getTaskList(executionId: string) {
    const execution = await this.findExecution(executionId);
    const cfg = execution.config as WorkflowConfig | null;
    const atRiskMs = (cfg?.atRiskThresholdSec ?? DEFAULT_AT_RISK_THRESHOLD) * 1000;
    const now = Date.now();

    const tasks = await this.prisma.workflowTask.findMany({
      where: { workflowExecutionId: executionId },
      include: {
        agentProfile: { select: { id: true, name: true, role: true } },
        instances: {
          select: { id: true, status: true, lastHeartbeat: true, durationMs: true, error: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { artifacts: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return tasks.map((t) => ({
      ...t,
      elapsedMs: t.startedAt ? now - t.startedAt.getTime() : null,
      isAtRisk:
        t.status === 'RUNNING' && t.startedAt
          ? now - t.startedAt.getTime() > atRiskMs
          : false,
    }));
  }

  // ──────────────────────────────────────────────────────────────────────
  // DAG endpoint (Req 8.2 / 8.5 — GET /dag)
  // ──────────────────────────────────────────────────────────────────────
  async getDag(executionId: string) {
    const tasks = await this.prisma.workflowTask.findMany({
      where: { workflowExecutionId: executionId },
      include: {
        agentProfile: { select: { id: true, name: true, role: true } },
        dependencies: { select: { dependsOnTaskId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const dag = buildDag(
      tasks.map((t) => ({
        id: t.id,
        phaseName: t.phaseName,
        status: t.status,
        dependencies: t.dependencies,
      })),
    );

    const criticalPath = dag.getCriticalPath();
    const progress     = dag.getProgress();
    const edges: DagEdge[] = dag.edges;

    // Req 8.3 — at-risk detection from execution config
    const execution = await this.findExecution(executionId);
    const cfg = execution.config as WorkflowConfig | null;
    const atRiskMs = (cfg?.atRiskThresholdSec ?? DEFAULT_AT_RISK_THRESHOLD) * 1000;
    const now = Date.now();

    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        phaseId: t.phaseId,
        phaseName: t.phaseName,
        status: t.status,
        agentName: t.agentProfile.name,
        agentRole: t.agentProfile.role,
        startedAt: t.startedAt,
        elapsedMs: t.startedAt ? now - t.startedAt.getTime() : null,
        isAtRisk:
          t.status === 'RUNNING' && t.startedAt
            ? now - t.startedAt.getTime() > atRiskMs
            : false,
        isCriticalPath: criticalPath.includes(t.id),
      })),
      edges,
      criticalPath,
      progress,
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // ARTIFACTS endpoint (Req 7.5 — GET /artifacts, grouped by phase)
  // ──────────────────────────────────────────────────────────────────────
  async getArtifacts(executionId: string) {
    const tasks = await this.prisma.workflowTask.findMany({
      where: { workflowExecutionId: executionId },
      include: {
        artifacts: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by phase name
    const grouped: Record<
      string,
      { phaseId: string; phaseName: string; artifacts: typeof tasks[0]['artifacts'] }
    > = {};

    for (const task of tasks) {
      if (!task.artifacts.length) continue;
      const key = task.phaseName;
      if (!grouped[key]) {
        grouped[key] = { phaseId: task.phaseId, phaseName: task.phaseName, artifacts: [] };
      }
      grouped[key].artifacts.push(...task.artifacts);
    }

    const totalArtifacts = Object.values(grouped).reduce(
      (sum, g) => sum + g.artifacts.length,
      0,
    );

    return {
      executionId,
      totalArtifacts,
      byPhase: Object.values(grouped),
    };
  }

  // ──────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ──────────────────────────────────────────────────────────────────────

  private async findExecution(id: string) {
    const ex = await this.prisma.workflowExecution.findUnique({ where: { id } });
    if (!ex) throw new NotFoundException('Execution not found');
    return ex;
  }

  private async getEligibleTasks(executionId: string): Promise<string[]> {
    const tasks = await this.prisma.workflowTask.findMany({
      where: { workflowExecutionId: executionId },
      include: { dependencies: { select: { dependsOnTaskId: true } } },
    });
    const dag = buildDag(
      tasks.map((t) => ({
        id: t.id,
        phaseName: t.phaseName,
        status: t.status,
        dependencies: t.dependencies,
      })),
    );
    return dag.eligibleTaskIds();
  }

  /** Dispatch up to (maxConcurrency - currentlyRunning) tasks with full AI-DLC integration */
  private async dispatchTasks(
    taskIds: string[],
    maxConcurrency: number,
    projectId: string,
  ) {
    const running = await this.prisma.workflowTask.count({
      where: {
        execution: { projectId, status: 'RUNNING' },
        status: { in: ['STARTING', 'RUNNING'] },
      },
    });

    const slots = Math.max(0, maxConcurrency - running);
    const toDispatch = taskIds.slice(0, slots);

    for (const taskId of toDispatch) {
      const task = await this.prisma.workflowTask.findUnique({
        where: { id: taskId },
        include: { execution: true },
      });
      if (!task) continue;

      await this.prisma.workflowTask.update({
        where: { id: taskId },
        data: { status: 'STARTING', startedAt: new Date() },
      });

      const cfg = task.execution.config as WorkflowConfig | null;
      const heartbeatIntervalSec = cfg?.heartbeatIntervalSec ?? DEFAULT_HEARTBEAT_SEC;
      const taskTimeoutMs        = (cfg?.taskTimeoutSec ?? DEFAULT_TASK_TIMEOUT_SEC) * 1000;

      // Req 10.1 — pre-create ai_dlc_session before the agent starts
      const session = await this.prisma.aiDlcSession.create({
        data: {
          name: `${task.phaseName} — agent session`,
          description: `Workflow execution ${task.workflowExecutionId} / task ${taskId}`,
          status: 'ACTIVE',
          config: {
            workflowExecutionId: task.workflowExecutionId,
            workflowTaskId: taskId,
          },
        },
      });

      // Create AgentInstance with session reference
      const instance = await this.prisma.agentInstance.create({
        data: {
          workflowTaskId: taskId,
          agentProfileId: task.agentProfileId,
          sessionId: session.id,
          status: 'STARTING',
          startedAt: new Date(),
          heartbeatIntervalSec,
        },
      });

      // Collect input artifacts from all completed upstream tasks
      const upstreamTaskIds = await this._getUpstreamTaskIds(taskId);
      const inputArtifacts = upstreamTaskIds.length
        ? await this.prisma.artifactOutput.findMany({
            where: { workflowTaskId: { in: upstreamTaskIds } },
            select: { name: true, artifactType: true, contentRef: true, metadata: true },
          })
        : [];

      // Hand off to AgentExecutor (in-process runtime)
      if (this.agentExecutor) {
        await this.agentExecutor.start({
          workflowExecutionId: task.workflowExecutionId,
          workflowTaskId: taskId,
          agentInstanceId: instance.id,
          agentProfileId: task.agentProfileId,
          phaseName: task.phaseName,
          inputArtifacts: inputArtifacts.map((a) => ({
            name: a.name,
            artifactType: a.artifactType,
            contentRef: a.contentRef,
            metadata: a.metadata as Record<string, unknown> | undefined,
          })),
          sessionId: session.id,
          heartbeatIntervalMs: heartbeatIntervalSec * 1000,
          taskTimeoutMs,
        });
      } else {
        // Fallback: simulate synchronous RUNNING transition when no executor wired
        await this.prisma.agentInstance.update({
          where: { id: instance.id },
          data: { status: 'RUNNING', lastHeartbeat: new Date() },
        });
        await this.prisma.workflowTask.update({
          where: { id: taskId },
          data: { status: 'RUNNING' },
        });
      }

      this.logger.log(
        `Dispatched task ${taskId} → instance ${instance.id} (session ${session.id})`,
      );
    }
  }

  /** Collect all transitively upstream task IDs for input artifact resolution (Req 7.3) */
  private async _getUpstreamTaskIds(taskId: string): Promise<string[]> {
    const visited = new Set<string>();
    const queue   = [taskId];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      const deps = await this.prisma.taskDependency.findMany({
        where: { taskId: cur },
        select: { dependsOnTaskId: true },
      });
      for (const d of deps) queue.push(d.dependsOnTaskId);
    }

    visited.delete(taskId); // exclude self
    return [...visited];
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

    const failed = await this.prisma.workflowTask.count({
      where: { workflowExecutionId: executionId, status: { in: ['FAILED', 'TIMED_OUT'] } },
    });

    const finalStatus = failed > 0 ? 'FAILED' : 'COMPLETED';
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: finalStatus, completedAt: now },
    });
    this.logger.log(`Execution ${executionId} → ${finalStatus}`);
  }
}
