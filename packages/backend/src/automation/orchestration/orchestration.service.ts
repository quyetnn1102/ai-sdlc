import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildDag } from './dag.builder';

export interface StartExecutionDto {
  projectId: string;
  initiatedBy?: string;
  config?: {
    maxConcurrency?: number;
    phaseFilter?: string[];
  };
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

const DEFAULT_MAX_CONCURRENCY = 10;
const HEARTBEAT_TIMEOUT_MULTIPLIER = 2; // miss 2× interval → timed out

@Injectable()
export class OrchestrationService {
  private readonly logger = new Logger(OrchestrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────
  // Start a new workflow execution
  // ─────────────────────────────────────────────────────────────────────
  async start(dto: StartExecutionDto) {
    const { projectId, initiatedBy, config = {} } = dto;

    // Load all phase→agent mappings for this project
    const mappings = await this.prisma.phaseAgentMapping.findMany({
      where: { projectId },
      include: { agentProfile: true },
      orderBy: [{ phaseId: 'asc' }, { priority: 'asc' }],
    });

    if (!mappings.length) {
      throw new BadRequestException(
        'No phase-agent mappings configured for this project. Configure them first.',
      );
    }

    // Load workflow phases to get ordered phase list
    const phases = await this.prisma.workflowPhase.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    const phaseFilter = config.phaseFilter;
    const activeMappings = phaseFilter
      ? mappings.filter((m) =>
          phases.some(
            (p) => p.id === m.phaseId && phaseFilter.includes(p.name),
          ),
        )
      : mappings;

    // Create execution record
    const execution = await this.prisma.workflowExecution.create({
      data: {
        projectId,
        status: 'RUNNING',
        startedAt: new Date(),
        initiatedBy: initiatedBy ?? null,
        config: config as object,
      },
    });

    // Create one WorkflowTask per mapping, ordered by phase
    const createdTasks: Array<{ id: string; phaseId: string; order: number }> = [];
    for (const phase of phases) {
      const phaseMappings = activeMappings.filter((m) => m.phaseId === phase.id);
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

    // Wire sequential phase dependencies (tasks of phase N depend on ALL tasks of phase N-1)
    const tasksByOrder = createdTasks.reduce<Record<number, string[]>>((acc, t) => {
      const ph = phases.find((p) => p.id === t.phaseId);
      const order = ph?.order ?? 0;
      if (!acc[order]) acc[order] = [];
      acc[order].push(t.id);
      return acc;
    }, {});

    const orderKeys = Object.keys(tasksByOrder).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < orderKeys.length; i++) {
      const prevTasks = tasksByOrder[orderKeys[i - 1]];
      const currTasks = tasksByOrder[orderKeys[i]];
      for (const currTaskId of currTasks) {
        for (const prevTaskId of prevTasks) {
          await this.prisma.taskDependency.create({
            data: { taskId: currTaskId, dependsOnTaskId: prevTaskId },
          }).catch(() => {}); // ignore unique constraint on re-run
        }
      }
    }

    // Dispatch first wave of eligible tasks
    const eligible = await this.getEligibleTasks(execution.id);
    await this.dispatchTasks(
      eligible,
      config.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
      projectId,
    );

    this.logger.log(
      `Execution ${execution.id} started: ${createdTasks.length} tasks, ` +
        `${eligible.length} dispatched immediately`,
    );

    return this.getExecutionStatus(execution.id);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Pause / Resume / Cancel
  // ─────────────────────────────────────────────────────────────────────
  async pause(executionId: string) {
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'PAUSED' },
    });
    return this.getExecutionStatus(executionId);
  }

  async resume(executionId: string) {
    const execution = await this.findExecution(executionId);
    if (execution.status !== 'PAUSED') {
      throw new BadRequestException('Execution is not paused');
    }
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'RUNNING' },
    });
    // Re-evaluate eligible tasks
    const eligible = await this.getEligibleTasks(executionId);
    const cfg = execution.config as { maxConcurrency?: number } | null;
    await this.dispatchTasks(
      eligible,
      cfg?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
      execution.projectId,
    );
    return this.getExecutionStatus(executionId);
  }

  async cancel(executionId: string) {
    // Mark all running/pending tasks as SKIPPED
    await this.prisma.workflowTask.updateMany({
      where: {
        workflowExecutionId: executionId,
        status: { in: ['PENDING', 'STARTING', 'RUNNING'] },
      },
      data: { status: 'SKIPPED' },
    });
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    return this.getExecutionStatus(executionId);
  }

  // ─────────────────────────────────────────────────────────────────────
  // Completion callback (agents call this when done)
  // ─────────────────────────────────────────────────────────────────────
  async completeTask(dto: CompleteTaskDto) {
    const task = await this.prisma.workflowTask.findUnique({
      where: { id: dto.taskId },
      include: { execution: true },
    });
    if (!task) throw new NotFoundException(`Task ${dto.taskId} not found`);

    const now = new Date();

    // Update agent instance
    await this.prisma.agentInstance.updateMany({
      where: { id: dto.agentInstanceId },
      data: {
        status: dto.status,
        completedAt: now,
      },
    });

    // Update task
    await this.prisma.workflowTask.update({
      where: { id: dto.taskId },
      data: {
        status: dto.status,
        completedAt: now,
        durationMs: dto.durationMs ?? null,
        error: dto.error ?? null,
      },
    });

    // Persist artifact outputs
    if (dto.artifacts?.length) {
      await this.prisma.artifactOutput.createMany({
        data: dto.artifacts.map((a) => ({
          workflowTaskId: dto.taskId,
          artifactType: a.artifactType,
          name: a.name,
          contentRef: a.contentRef,
          metadata: a.metadata ?? {},
        })),
      });
    }

    // Re-evaluate DAG
    const execution = task.execution;
    if (execution.status === 'RUNNING' && dto.status === 'DONE') {
      const eligible = await this.getEligibleTasks(execution.id);
      const cfg = execution.config as { maxConcurrency?: number } | null;
      await this.dispatchTasks(
        eligible,
        cfg?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY,
        execution.projectId,
      );

      // Check if execution is fully complete
      const remaining = await this.prisma.workflowTask.count({
        where: {
          workflowExecutionId: execution.id,
          status: { in: ['PENDING', 'STARTING', 'RUNNING'] },
        },
      });
      if (remaining === 0) {
        const failed = await this.prisma.workflowTask.count({
          where: { workflowExecutionId: execution.id, status: 'FAILED' },
        });
        await this.prisma.workflowExecution.update({
          where: { id: execution.id },
          data: {
            status: failed > 0 ? 'FAILED' : 'COMPLETED',
            completedAt: now,
          },
        });
        this.logger.log(`Execution ${execution.id} finished with status ${failed > 0 ? 'FAILED' : 'COMPLETED'}`);
      }
    } else if (dto.status === 'FAILED') {
      // Retry logic
      const maxRetries = 3;
      if (task.retryCount < maxRetries) {
        await this.prisma.workflowTask.update({
          where: { id: dto.taskId },
          data: { status: 'PENDING', retryCount: { increment: 1 }, error: null },
        });
        this.logger.warn(`Task ${dto.taskId} failed — retrying (attempt ${task.retryCount + 1}/${maxRetries})`);
        const eligible = await this.getEligibleTasks(execution.id);
        const cfg = execution.config as { maxConcurrency?: number } | null;
        await this.dispatchTasks(eligible, cfg?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY, execution.projectId);
      } else {
        this.logger.error(`Task ${dto.taskId} failed after ${maxRetries} retries`);
      }
    }

    return { taskId: dto.taskId, status: dto.status };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Heartbeat — agent calls this to prove it is alive
  // ─────────────────────────────────────────────────────────────────────
  async heartbeat(agentInstanceId: string) {
    await this.prisma.agentInstance.update({
      where: { id: agentInstanceId },
      data: { lastHeartbeat: new Date() },
    });
    return { ok: true };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Lifecycle monitor — detect timed-out agents (called by cron / scheduler)
  // ─────────────────────────────────────────────────────────────────────
  async detectTimedOutAgents() {
    const runningInstances = await this.prisma.agentInstance.findMany({
      where: { status: 'RUNNING', lastHeartbeat: { not: null } },
    });

    const now = Date.now();
    const timedOut: string[] = [];

    for (const inst of runningInstances) {
      const threshold = (inst.heartbeatIntervalSec * HEARTBEAT_TIMEOUT_MULTIPLIER * 1000);
      const lastBeat = inst.lastHeartbeat?.getTime() ?? 0;
      if (now - lastBeat > threshold) {
        timedOut.push(inst.id);
        await this.prisma.agentInstance.update({
          where: { id: inst.id },
          data: { status: 'TIMED_OUT', completedAt: new Date() },
        });
        await this.prisma.workflowTask.update({
          where: { id: inst.workflowTaskId },
          data: { status: 'TIMED_OUT', error: 'Agent heartbeat timeout' },
        });
        this.logger.warn(`Agent instance ${inst.id} timed out`);
      }
    }

    return { timedOut };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Status / Query
  // ─────────────────────────────────────────────────────────────────────
  async getExecutionStatus(executionId: string) {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        tasks: {
          include: {
            agentProfile: { select: { id: true, name: true, role: true } },
            instances: { select: { id: true, status: true, lastHeartbeat: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            artifacts: true,
            dependencies: { select: { dependsOnTaskId: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }

  async listExecutions(projectId: string) {
    return this.prisma.workflowExecution.findMany({
      where: { projectId },
      include: {
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────
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

  private async dispatchTasks(
    taskIds: string[],
    maxConcurrency: number,
    projectId: string,
  ) {
    // Count currently running tasks for this project's active executions
    const running = await this.prisma.workflowTask.count({
      where: {
        execution: { projectId, status: 'RUNNING' },
        status: { in: ['STARTING', 'RUNNING'] },
      },
    });

    const slots = Math.max(0, maxConcurrency - running);
    const toDispatch = taskIds.slice(0, slots);

    for (const taskId of toDispatch) {
      await this.prisma.workflowTask.update({
        where: { id: taskId },
        data: { status: 'STARTING', startedAt: new Date() },
      });

      // Create agent instance record (real impl would invoke the agent runtime here)
      const task = await this.prisma.workflowTask.findUnique({ where: { id: taskId } });
      if (!task) continue;

      const instance = await this.prisma.agentInstance.create({
        data: {
          workflowTaskId: taskId,
          agentProfileId: task.agentProfileId,
          status: 'STARTING',
          startedAt: new Date(),
        },
      });

      // Simulate transition to RUNNING immediately (in production: wait for agent ack)
      await this.prisma.agentInstance.update({
        where: { id: instance.id },
        data: { status: 'RUNNING', lastHeartbeat: new Date() },
      });
      await this.prisma.workflowTask.update({
        where: { id: taskId },
        data: { status: 'RUNNING' },
      });

      this.logger.log(`Dispatched task ${taskId} → agent instance ${instance.id}`);
    }
  }
}
