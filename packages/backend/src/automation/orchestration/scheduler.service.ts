/**
 * SchedulerService — DAG evaluation + task dispatch
 *
 * Extracted from OrchestrationService to keep each class focused:
 *   - OrchestrationService: lifecycle (start/pause/resume/cancel/complete)
 *   - SchedulerService:     DAG evaluation + concurrency-bounded dispatch
 *   - MonitoringService:    read-only queries (status, dag, tasks, artifacts)
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildDag } from './dag.builder';
import type { WorkflowConfig } from './orchestration.service';

const DEFAULT_MAX_CONCURRENCY = 5;
const DEFAULT_HEARTBEAT_SEC   = 30;
const DEFAULT_TASK_TIMEOUT_SEC = 600;

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Return task IDs that are PENDING with all dependencies DONE */
  async getEligibleTaskIds(executionId: string): Promise<string[]> {
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

  /**
   * Dispatch up to (maxConcurrency - currentlyRunning) eligible tasks.
   * Returns the IDs of tasks that were dispatched.
   */
  async dispatch(
    taskIds: string[],
    maxConcurrency: number,
    projectId: string,
    agentExecutor?: {
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
    },
  ): Promise<string[]> {
    const running = await this.prisma.workflowTask.count({
      where: {
        execution: { projectId, status: 'running' as any },
        status: { in: ['starting', 'running'] },
      },
    });

    const slots      = Math.max(0, maxConcurrency - running);
    const toDispatch = taskIds.slice(0, slots);
    const dispatched: string[] = [];

    for (const taskId of toDispatch) {
      const task = await this.prisma.workflowTask.findUnique({
        where: { id: taskId },
        include: { execution: true },
      });
      if (!task) continue;

      await this.prisma.workflowTask.update({
        where: { id: taskId },
        data: { status: 'starting' as any, startedAt: new Date() },
      });

      const cfg = task.execution.config as WorkflowConfig | null;
      const heartbeatIntervalSec = cfg?.heartbeatIntervalSec ?? DEFAULT_HEARTBEAT_SEC;
      const taskTimeoutMs        = (cfg?.taskTimeoutSec ?? DEFAULT_TASK_TIMEOUT_SEC) * 1000;

      // Create AI-DLC session before agent starts (Req 10.1)
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

      const instance = await this.prisma.agentInstance.create({
        data: {
          workflowTaskId: taskId,
          agentProfileId: task.agentProfileId,
          sessionId: session.id,
          status: 'starting' as any,
          startedAt: new Date(),
          heartbeatIntervalSec,
        },
      });

      // Collect input artifacts from upstream tasks (Req 7.3)
      const upstreamIds = await this._getUpstreamTaskIds(taskId);
      const inputArtifacts = upstreamIds.length
        ? await this.prisma.artifactOutput.findMany({
            where: { workflowTaskId: { in: upstreamIds } },
            select: { name: true, artifactType: true, contentRef: true, metadata: true },
          })
        : [];

      if (agentExecutor) {
        await agentExecutor.start({
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
        // Fallback: mark RUNNING when no executor wired (e.g. tests)
        await this.prisma.agentInstance.update({
          where: { id: instance.id },
          data: { status: 'running' as any, lastHeartbeat: new Date() },
        });
        await this.prisma.workflowTask.update({
          where: { id: taskId },
          data: { status: 'running' as any },
        });
      }

      this.logger.log(`Dispatched task ${taskId} → instance ${instance.id}`);
      dispatched.push(taskId);
    }

    return dispatched;
  }

  /** Collect all transitively upstream task IDs for input artifact resolution */
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
    visited.delete(taskId);
    return [...visited];
  }
}
