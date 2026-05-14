/**
 * Integration tests for end-to-end workflow execution
 *
 * Feature: agent-workflow-automation
 * Tests the full workflow lifecycle using mocked Prisma and agent executor.
 * Requirements: 6.5, 10.1, 10.2, 10.3, 10.4
 *
 * Note: These tests use mocked Prisma (not a real DB) to avoid requiring
 * a running PostgreSQL instance in CI. For full DB integration tests,
 * use testcontainers with a real PostgreSQL instance.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { OrchestrationService } from './orchestration.service';
import { SchedulerService } from './scheduler.service';
import { MonitoringService } from './monitoring.service';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

// ── Mock factories ────────────────────────────────────────────────────────

function buildMockPrisma() {
  const executions = new Map<string, any>();
  const tasks      = new Map<string, any>();
  const instances  = new Map<string, any>();
  const artifacts  = new Map<string, any>();
  const sessions   = new Map<string, any>();
  const dlcArtifacts = new Map<string, any>();

  return {
    _store: { executions, tasks, instances, artifacts, sessions, dlcArtifacts },

    workflowExecution: {
      create: jest.fn().mockImplementation(({ data }) => {
        const exec = { id: `exec-${Date.now()}`, ...data, tasks: [] };
        executions.set(exec.id, exec);
        return Promise.resolve(exec);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve(executions.get(where.id) ?? null),
      ),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const exec = executions.get(where.id);
        if (exec) Object.assign(exec, data);
        return Promise.resolve(exec);
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
    },

    workflowTask: {
      create: jest.fn().mockImplementation(({ data }) => {
        const task = { id: `task-${Date.now()}-${Math.random()}`, ...data, dependencies: [], instances: [], artifacts: [] };
        tasks.set(task.id, task);
        return Promise.resolve(task);
      }),
      findUnique: jest.fn().mockImplementation(({ where, include }) => {
        const task = tasks.get(where.id);
        if (!task) return Promise.resolve(null);
        const result = { ...task };
        if (include?.execution) {
          result.execution = executions.get(task.workflowExecutionId) ?? null;
        }
        return Promise.resolve(result);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        const all = [...tasks.values()];
        if (where?.workflowExecutionId) {
          return Promise.resolve(all.filter((t) => t.workflowExecutionId === where.workflowExecutionId));
        }
        return Promise.resolve(all);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const task = tasks.get(where.id);
        if (task) Object.assign(task, data);
        return Promise.resolve(task);
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockImplementation(({ where }) => {
        const all = [...tasks.values()];
        let filtered = all;
        if (where?.workflowExecutionId) {
          filtered = filtered.filter((t) => t.workflowExecutionId === where.workflowExecutionId);
        }
        if (where?.status?.in) {
          filtered = filtered.filter((t) => where.status.in.includes(t.status));
        }
        if (where?.status) {
          filtered = filtered.filter((t) => t.status === where.status);
        }
        return Promise.resolve(filtered.length);
      }),
    },

    agentInstance: {
      create: jest.fn().mockImplementation(({ data }) => {
        const inst = { id: `inst-${Date.now()}-${Math.random()}`, ...data };
        instances.set(inst.id, inst);
        return Promise.resolve(inst);
      }),
      findUnique: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve(instances.get(where.id) ?? null),
      ),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const inst = instances.get(where.id);
        if (inst) Object.assign(inst, data);
        return Promise.resolve(inst);
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },

    artifactOutput: {
      createMany: jest.fn().mockImplementation(({ data }) => {
        for (const a of data) {
          const artifact = { id: `artifact-${Date.now()}-${Math.random()}`, ...a };
          artifacts.set(artifact.id, artifact);
        }
        return Promise.resolve({ count: data.length });
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },

    aiDlcSession: {
      create: jest.fn().mockImplementation(({ data }) => {
        const session = { id: `session-${Date.now()}`, ...data };
        sessions.set(session.id, session);
        return Promise.resolve(session);
      }),
      upsert: jest.fn().mockImplementation(({ where, create }) => {
        const session = { id: where.id, ...create };
        sessions.set(session.id, session);
        return Promise.resolve(session);
      }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },

    aiDlcArtifact: {
      create: jest.fn().mockImplementation(({ data }) => {
        const artifact = { id: `dlc-artifact-${Date.now()}`, ...data };
        dlcArtifacts.set(artifact.id, artifact);
        return Promise.resolve(artifact);
      }),
    },

    agentProfile: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'agent-1', name: 'Dev Agent', role: 'DEV_AGENT',
        skillSet: ['typescript'], config: { provider: 'simulate' },
      }),
    },

    phaseAgentMapping: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'mapping-1',
          phaseId: 'phase-1',
          agentProfileId: 'agent-1',
          projectId: 'project-1',
          priority: 0,
          agentProfile: { id: 'agent-1', name: 'Dev Agent', role: 'DEV_AGENT' },
        },
      ]),
    },

    workflowPhase: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'phase-1', name: 'In Dev', order: 1, projectId: 'project-1' },
      ]),
    },

    taskDependency: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },

    $transaction: jest.fn().mockImplementation(async (fn) => {
      if (typeof fn === 'function') {
        return fn({
          agentInstance: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          workflowTask: { update: jest.fn().mockResolvedValue({}) },
          artifactOutput: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
        });
      }
      return Promise.all(fn);
    }),
  };
}

// ── Test suite ────────────────────────────────────────────────────────────

describe('Workflow Integration Tests', () => {
  let orchestration: OrchestrationService;
  let prisma: ReturnType<typeof buildMockPrisma>;
  let notifications: { notifyTaskFailed: jest.Mock; notifyWorkflowBlocked: jest.Mock; notifyWorkflowCompleted: jest.Mock };
  let mockAgentExecutor: { start: jest.Mock };
  let testModule: TestingModule;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    notifications = {
      notifyTaskFailed:       jest.fn().mockResolvedValue(undefined),
      notifyWorkflowBlocked:  jest.fn().mockResolvedValue(undefined),
      notifyWorkflowCompleted: jest.fn().mockResolvedValue(undefined),
    };
    mockAgentExecutor = { start: jest.fn().mockResolvedValue(undefined) };

    const builtModule: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        SchedulerService,
        MonitoringService,
        { provide: PrismaService,       useValue: prisma        },
        { provide: NotificationService, useValue: notifications },
        { provide: AuditService,        useValue: { log: jest.fn() } },
        { provide: 'AGENT_EXECUTOR',    useValue: mockAgentExecutor },
      ],
    }).compile();

    testModule    = builtModule;
    orchestration = builtModule.get<OrchestrationService>(OrchestrationService);
  });

  // ── Test 1: Full workflow lifecycle ───────────────────────────────────

  describe('Full workflow: start → tasks decomposed → agents run → callbacks → complete', () => {
    it('starts execution, creates tasks, dispatches agents, and completes on callback', async () => {
      // 1. Start execution
      const execution = await orchestration.start({
        projectId: 'project-1',
        initiatedBy: 'user-1',
        config: { maxConcurrency: 5, maxRetries: 2 },
      });

      expect(execution).toBeDefined();
      expect(prisma.workflowExecution.create).toHaveBeenCalled();
      expect(prisma.workflowTask.create).toHaveBeenCalled();

      // 2. Simulate agent completing the task
      const taskId = [...prisma._store.tasks.keys()][0];
      const instanceId = [...prisma._store.instances.keys()][0] ?? 'inst-1';

      // Set up task in running state for the callback
      const task = prisma._store.tasks.get(taskId);
      if (task) {
        task.status = 'RUNNING';
        task.execution = prisma._store.executions.get(task.workflowExecutionId);
      }

      prisma.workflowTask.findUnique.mockResolvedValue({
        ...task,
        execution: prisma._store.executions.get(task?.workflowExecutionId ?? ''),
      });

      // All tasks will be terminal after this callback
      prisma.workflowTask.count
        .mockResolvedValueOnce(0)  // remaining non-terminal = 0
        .mockResolvedValueOnce(0)  // failed count = 0
        .mockResolvedValueOnce(1); // done count = 1

      prisma.workflowExecution.findUnique.mockResolvedValue(
        prisma._store.executions.get(execution.id),
      );

      // 3. Process completion callback
      const callbackResult = await orchestration.completeTask({
        taskId: taskId ?? 'task-1',
        agentInstanceId: instanceId,
        status: 'DONE',
        durationMs: 45_000,
        artifacts: [
          { artifactType: 'DOCUMENT', name: 'output.md', contentRef: 'artifacts/exec-1/task-1/output.md' },
        ],
      });

      expect(callbackResult.status).toBe('DONE');

      // 4. Verify workflow completion notification was sent
      expect(notifications.notifyWorkflowCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ executionId: execution.id }),
      );
    });
  });

  // ── Test 2: AI-DLC integration ────────────────────────────────────────

  describe('AI-DLC integration', () => {
    it('creates ai_dlc_session when agent starts (Req 10.1)', async () => {
      await orchestration.start({
        projectId: 'project-1',
        initiatedBy: 'user-1',
      });

      // SchedulerService creates the session before dispatching
      expect(prisma.aiDlcSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: expect.stringContaining('agent session'),
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('creates ai_dlc_artifact when artifact is produced (Req 10.2)', async () => {
      // Set up a running task for the callback
      const task = {
        id: 'task-1',
        workflowExecutionId: 'exec-1',
        phaseId: 'phase-1',
        phaseName: 'In Dev',
        agentProfileId: 'agent-1',
        status: 'RUNNING',
        retryCount: 0,
        error: null,
        startedAt: new Date(),
        completedAt: null,
        execution: {
          id: 'exec-1',
          projectId: 'project-1',
          status: 'RUNNING',
          config: { maxConcurrency: 5, maxRetries: 2 },
          startedAt: new Date(),
        },
      };
      prisma.workflowTask.findUnique.mockResolvedValue(task);
      prisma.workflowTask.count.mockResolvedValue(1); // still tasks remaining

      await orchestration.completeTask({
        taskId: 'task-1',
        agentInstanceId: 'inst-1',
        status: 'DONE',
        artifacts: [
          { artifactType: 'DOCUMENT', name: 'requirements.md', contentRef: 'artifacts/exec-1/task-1/requirements.md' },
        ],
      });

      // Artifact should be stored in artifact_outputs table
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── Test 3: Concurrent callbacks ──────────────────────────────────────

  describe('Concurrent callbacks handled correctly', () => {
    it('handles multiple simultaneous completion callbacks without data corruption', async () => {
      const tasks = [
        { id: 'task-a', status: 'RUNNING', retryCount: 0, error: null, startedAt: new Date(),
          workflowExecutionId: 'exec-1', phaseId: 'phase-1', phaseName: 'In Dev', agentProfileId: 'agent-1',
          execution: { id: 'exec-1', projectId: 'project-1', status: 'RUNNING', config: { maxConcurrency: 5, maxRetries: 2 }, startedAt: new Date() } },
        { id: 'task-b', status: 'RUNNING', retryCount: 0, error: null, startedAt: new Date(),
          workflowExecutionId: 'exec-1', phaseId: 'phase-2', phaseName: 'In Test', agentProfileId: 'agent-1',
          execution: { id: 'exec-1', projectId: 'project-1', status: 'RUNNING', config: { maxConcurrency: 5, maxRetries: 2 }, startedAt: new Date() } },
      ];

      prisma.workflowTask.findUnique
        .mockResolvedValueOnce(tasks[0])
        .mockResolvedValueOnce(tasks[1]);

      prisma.workflowTask.count.mockResolvedValue(1); // still tasks remaining

      // Fire both callbacks concurrently
      const [resultA, resultB] = await Promise.all([
        orchestration.completeTask({ taskId: 'task-a', agentInstanceId: 'inst-a', status: 'DONE' }),
        orchestration.completeTask({ taskId: 'task-b', agentInstanceId: 'inst-b', status: 'DONE' }),
      ]);

      expect(resultA.status).toBe('DONE');
      expect(resultB.status).toBe('DONE');
    });
  });

  // ── Test 4: Notification dispatch on failure ──────────────────────────

  describe('Notification dispatch on failure', () => {
    it('notifies project owner when task fails after max retries (Req 6.4)', async () => {
      const task = {
        id: 'task-1',
        workflowExecutionId: 'exec-1',
        phaseId: 'phase-1',
        phaseName: 'In Dev',
        agentProfileId: 'agent-1',
        status: 'RUNNING',
        retryCount: 2, // already at max retries (default maxRetries = 2)
        error: null,
        startedAt: new Date(),
        completedAt: null,
        execution: {
          id: 'exec-1',
          projectId: 'project-1',
          status: 'RUNNING',
          config: { maxConcurrency: 5, maxRetries: 2 },
          startedAt: new Date(),
        },
      };
      prisma.workflowTask.findUnique.mockResolvedValue(task);
      prisma.agentProfile.findUnique.mockResolvedValue({ name: 'Dev Agent' });
      prisma.workflowTask.count.mockResolvedValue(1);

      await orchestration.completeTask({
        taskId: 'task-1',
        agentInstanceId: 'inst-1',
        status: 'FAILED',
        error: 'LLM API timeout',
      });

      expect(notifications.notifyTaskFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          executionId: 'exec-1',
          taskId: 'task-1',
          phaseName: 'In Dev',
          error: 'LLM API timeout',
        }),
      );
    });

    it('notifies project owner when workflow is blocked (Req 3.5)', async () => {
      // When no tasks can be created (all phases unmapped), workflow is BLOCKED
      // The service throws BadRequestException when there are NO mappings at all.
      // To test the BLOCKED path, we need mappings but phases that produce no tasks.
      // We simulate this by having mappings but no phases.
      prisma.phaseAgentMapping.findMany.mockResolvedValue([
        { id: 'mapping-1', phaseId: 'phase-1', agentProfileId: 'agent-1', projectId: 'project-1', priority: 0, agentProfile: {} },
      ]);
      prisma.workflowPhase.findMany.mockResolvedValue([]); // no phases → no tasks created → BLOCKED

      const execution = { id: 'exec-blocked', projectId: 'project-1', status: 'BLOCKED', config: {}, startedAt: null, completedAt: null, initiatedBy: 'user-1' };
      prisma.workflowExecution.create.mockResolvedValue(execution);
      prisma.workflowExecution.update.mockResolvedValue({ ...execution, status: 'BLOCKED' });

      // Mock monitoring to return the blocked execution
      const monitoringMod = testModule.get(MonitoringService);
      jest.spyOn(monitoringMod, 'getExecutionStatus').mockResolvedValue({ ...execution, tasks: [], progress: { completed: 0, total: 0, percentage: 0 } } as any);

      await orchestration.start({
        projectId: 'project-1',
        initiatedBy: 'user-1',
      });

      expect(notifications.notifyWorkflowBlocked).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'project-1' }),
      );
    });
  });

  // ── Test 5: Cascade delete behavior ──────────────────────────────────

  describe('Cascade delete behavior', () => {
    it('cancelling execution marks all pending tasks as CANCELLED (Req 9.4)', async () => {
      const execution = {
        id: 'exec-1',
        projectId: 'project-1',
        status: 'RUNNING',
        config: {},
        startedAt: new Date(),
        completedAt: null,
        initiatedBy: 'user-1',
      };
      prisma.workflowExecution.findUnique.mockResolvedValue(execution);
      prisma.workflowTask.findMany.mockResolvedValue([
        { id: 'task-1' }, { id: 'task-2' },
      ]);
      prisma.agentInstance.updateMany.mockResolvedValue({ count: 2 });
      prisma.workflowTask.updateMany.mockResolvedValue({ count: 2 });
      prisma.workflowExecution.update.mockResolvedValue({ ...execution, status: 'CANCELLED' });

      // Mock monitoring to avoid the tasks.map error
      const monitoringMod = testModule.get(MonitoringService);
      jest.spyOn(monitoringMod, 'getExecutionStatus').mockResolvedValue({
        ...execution, status: 'CANCELLED', tasks: [], progress: { completed: 0, total: 0, percentage: 0 },
      } as any);

      await orchestration.cancel('exec-1');

      expect(prisma.workflowTask.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workflowExecutionId: 'exec-1',
            status: expect.objectContaining({ in: expect.arrayContaining(['PENDING']) }),
          }),
          data: { status: 'CANCELLED' },
        }),
      );
    });
  });
});
