/**
 * MonitoringService — read-only queries for workflow execution state
 *
 * Extracted from OrchestrationService:
 *   - getExecutionStatus  (Req 8.1)
 *   - getTaskList         (Req 8.3)
 *   - getDag              (Req 8.2 / 8.5)
 *   - getArtifacts        (Req 7.5)
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildDag, type DagEdge } from './dag.builder';
import type { WorkflowConfig } from './orchestration.service';

const DEFAULT_AT_RISK_THRESHOLD = 300; // seconds

@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Req 8.1 — Full execution detail with progress + at-risk flags ─────
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

    const dag      = buildDag(tasks.map((t) => ({ id: t.id, phaseName: t.phaseName, status: t.status, dependencies: t.dependencies })));
    const progress = dag.getProgress();

    return { ...execution, tasks, progress };
  }

  // ── Req 8.3 — Flat task list with elapsed + at-risk ───────────────────
  async getTaskList(executionId: string) {
    const execution = await this.prisma.workflowExecution.findUnique({ where: { id: executionId } });
    if (!execution) throw new NotFoundException('Execution not found');

    const cfg    = execution.config as WorkflowConfig | null;
    const atRiskMs = (cfg?.atRiskThresholdSec ?? DEFAULT_AT_RISK_THRESHOLD) * 1000;
    const now    = Date.now();

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

  // ── Req 8.2 / 8.5 — DAG with critical path ───────────────────────────
  async getDag(executionId: string) {
    const execution = await this.prisma.workflowExecution.findUnique({ where: { id: executionId } });
    if (!execution) throw new NotFoundException('Execution not found');

    const tasks = await this.prisma.workflowTask.findMany({
      where: { workflowExecutionId: executionId },
      include: {
        agentProfile: { select: { id: true, name: true, role: true } },
        dependencies: { select: { dependsOnTaskId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const dag          = buildDag(tasks.map((t) => ({ id: t.id, phaseName: t.phaseName, status: t.status, dependencies: t.dependencies })));
    const criticalPath = dag.getCriticalPath();
    const progress     = dag.getProgress();
    const edges: DagEdge[] = dag.edges;

    const cfg    = execution.config as WorkflowConfig | null;
    const atRiskMs = (cfg?.atRiskThresholdSec ?? DEFAULT_AT_RISK_THRESHOLD) * 1000;
    const now    = Date.now();

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

  // ── Req 7.5 — Artifacts grouped by phase ─────────────────────────────
  async getArtifacts(executionId: string) {
    const tasks = await this.prisma.workflowTask.findMany({
      where: { workflowExecutionId: executionId },
      include: { artifacts: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    const grouped: Record<string, { phaseId: string; phaseName: string; artifacts: typeof tasks[0]['artifacts'] }> = {};
    for (const task of tasks) {
      if (!task.artifacts.length) continue;
      const key = task.phaseName;
      if (!grouped[key]) {
        grouped[key] = { phaseId: task.phaseId, phaseName: task.phaseName, artifacts: [] };
      }
      grouped[key].artifacts.push(...task.artifacts);
    }

    return {
      executionId,
      totalArtifacts: Object.values(grouped).reduce((s, g) => s + g.artifacts.length, 0),
      byPhase: Object.values(grouped),
    };
  }

  // ── Paginated list ────────────────────────────────────────────────────
  async listExecutions(projectId: string, query: { page?: number; limit?: number } = {}) {
    const page  = Math.max(1, query.page  ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 20));
    const skip  = (page - 1) * limit;
    const where = { projectId };
    const [data, total] = await Promise.all([
      this.prisma.workflowExecution.findMany({
        where,
        include: { _count: { select: { tasks: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.workflowExecution.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
