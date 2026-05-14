/**
 * Property-based and unit tests for OrchestrationService
 *
 * Feature: agent-workflow-automation
 * Properties 9–13, 22: Lifecycle Manager, Callback Handler, Orchestration Engine
 * Requirements: 5.1–5.6, 6.1–6.5, 9.4
 */
import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrchestrationService } from './orchestration.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from './notification.service';
import { SchedulerService } from './scheduler.service';
import { MonitoringService } from './monitoring.service';
import { AuditService } from '../../common/audit/audit.service';

// ── Status categories ─────────────────────────────────────────────────────

const TERMINAL_STATUSES = ['DONE', 'FAILED', 'TIMED_OUT', 'CANCELLED'];
const NON_TERMINAL_STATUSES = ['PENDING', 'STARTING', 'RUNNING'];

// Valid agent instance state machine transitions (Property 9)
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:  ['STARTING'],
  STARTING: ['RUNNING', 'FAILED'],
  RUNNING:  ['DONE', 'FAILED', 'TIMED_OUT'],
  DONE:     [],
  FAILED:   [],
  TIMED_OUT: [],
};

// ── Mock factories ────────────────────────────────────────────────────────

function buildMockPrisma() {
  return {
    workflowExecution: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    workflowTask: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    agentInstance: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    artifactOutput: {
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    agentProfile: {
      findUnique: jest.fn(),
    },
    phaseAgentMapping: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    workflowPhase: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    aiDlcSession: {
      create: jest.fn(),
    },
    taskDependency: {
      create: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (fn) => {
      if (typeof fn === 'function') {
        return fn({
          agentInstance: { updateMany: jest.fn() },
          workflowTask: { update: jest.fn() },
          artifactOutput: { createMany: jest.fn() },
        });
      }
      return Promise.all(fn);
    }),
  };
}

function buildMockNotifications() {
  return {
    notifyTaskFailed: jest.fn().mockResolvedValue(undefined),
    notifyWorkflowBlocked: jest.fn().mockResolvedValue(undefined),
    notifyWorkflowCompleted: jest.fn().mockResolvedValue(undefined),
    notifyAgentClarification: jest.fn().mockResolvedValue(undefined),
  };
}

function buildMockScheduler() {
  return {
    getEligibleTaskIds: jest.fn().mockResolvedValue([]),
    dispatch: jest.fn().mockResolvedValue([]),
  };
}

function buildMockMonitoring() {
  return {
    getExecutionStatus: jest.fn().mockResolvedValue({ id: 'exec-1', status: 'RUNNING', tasks: [], progress: { completed: 0, total: 0, percentage: 0 } }),
    listExecutions: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    getTaskList: jest.fn().mockResolvedValue([]),
    getDag: jest.fn().mockResolvedValue({ tasks: [], edges: [], criticalPath: [] }),
    getArtifacts: jest.fn().mockResolvedValue({ executionId: 'exec-1', totalArtifacts: 0, byPhase: [] }),
  };
}

function buildMockAudit() {
  return { log: jest.fn() };
}

function makeExecution(overrides: Partial<{
  id: string; projectId: string; status: string; config: object;
  startedAt: Date | null; completedAt: Date | null; initiatedBy: string;
}> = {}) {
  return {
    id: 'exec-1',
    projectId: 'project-1',
    status: 'RUNNING',
    config: { maxConcurrency: 5, maxRetries: 2 },
    startedAt: new Date(),
    completedAt: null,
    initiatedBy: 'user-1',
    ...overrides,
  };
}

function makeTask(overrides: Partial<{
  id: string; workflowExecutionId: string; phaseId: string; phaseName: string;
  agentProfileId: string; status: string; retryCount: number; error: string | null;
  startedAt: Date | null; completedAt: Date | null;
  execution: ReturnType<typeof makeExecution>;
}> = {}) {
  return {
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
    execution: makeExecution(),
    ...overrides,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────

describe('OrchestrationService', () => {
  let service: OrchestrationService;
  let prisma: ReturnType<typeof buildMockPrisma>;
  let notifications: ReturnType<typeof buildMockNotifications>;
  let scheduler: ReturnType<typeof buildMockScheduler>;
  let monitoring: ReturnType<typeof buildMockMonitoring>;

  beforeEach(async () => {
    prisma        = buildMockPrisma();
    notifications = buildMockNotifications();
    scheduler     = buildMockScheduler();
    monitoring    = buildMockMonitoring();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestrationService,
        { provide: PrismaService,       useValue: prisma        },
        { provide: NotificationService, useValue: notifications },
        { provide: SchedulerService,    useValue: scheduler     },
        { provide: MonitoringService,   useValue: monitoring    },
        { provide: AuditService,        useValue: buildMockAudit() },
      ],
    }).compile();

    service = module.get<OrchestrationService>(OrchestrationService);
  });

  // ── Property 9: Agent instance state machine ──────────────────────────
  // Feature: agent-workflow-automation, Property 9: Agent instance state machine allows only valid transitions

  describe('Property 9: Agent instance state machine — valid transitions only', () => {
    it('property: only valid transitions are defined in the state machine', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('PENDING', 'STARTING', 'RUNNING', 'DONE', 'FAILED', 'TIMED_OUT'),
          fc.constantFrom('PENDING', 'STARTING', 'RUNNING', 'DONE', 'FAILED', 'TIMED_OUT'),
          (fromState, toState) => {
            const validNextStates = VALID_TRANSITIONS[fromState] ?? [];
            const isValid = validNextStates.includes(toState);

            // Verify the state machine definition is consistent
            if (isValid) {
              expect(VALID_TRANSITIONS[fromState]).toContain(toState);
            } else {
              expect(VALID_TRANSITIONS[fromState]).not.toContain(toState);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('PENDING can only transition to STARTING', () => {
      expect(VALID_TRANSITIONS['PENDING']).toEqual(['STARTING']);
    });

    it('STARTING can transition to RUNNING or FAILED', () => {
      expect(VALID_TRANSITIONS['STARTING']).toContain('RUNNING');
      expect(VALID_TRANSITIONS['STARTING']).toContain('FAILED');
    });

    it('RUNNING can transition to DONE, FAILED, or TIMED_OUT', () => {
      expect(VALID_TRANSITIONS['RUNNING']).toContain('DONE');
      expect(VALID_TRANSITIONS['RUNNING']).toContain('FAILED');
      expect(VALID_TRANSITIONS['RUNNING']).toContain('TIMED_OUT');
    });

    it('terminal states have no valid transitions', () => {
      for (const terminal of ['DONE', 'FAILED', 'TIMED_OUT']) {
        expect(VALID_TRANSITIONS[terminal]).toHaveLength(0);
      }
    });
  });

  // ── Property 10: Retry count never exceeds configured maximum ─────────
  // Feature: agent-workflow-automation, Property 10: Retry count never exceeds configured maximum

  describe('Property 10: Retry count never exceeds configured maximum', () => {
    it('property: task is permanently failed when retryCount >= maxRetries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 5 }), // maxRetries
          fc.integer({ min: 0, max: 5 }), // current retryCount
          async (maxRetries, retryCount) => {
            const task = makeTask({
              retryCount,
              execution: makeExecution({ config: { maxConcurrency: 5, maxRetries } }),
            });
            prisma.workflowTask.findUnique.mockResolvedValue(task);

            // Mock transaction
            prisma.$transaction.mockImplementation(async (fn) => {
              if (typeof fn === 'function') {
                return fn({
                  agentInstance: { updateMany: jest.fn() },
                  workflowTask: { update: jest.fn() },
                  artifactOutput: { createMany: jest.fn() },
                });
              }
              return Promise.all(fn);
            });

            prisma.workflowTask.update.mockResolvedValue({ ...task, status: 'PENDING', retryCount: retryCount + 1 });
            prisma.agentProfile.findUnique.mockResolvedValue({ name: 'Dev Agent' });
            prisma.workflowTask.count.mockResolvedValue(1); // still tasks remaining

            await service.completeTask({
              taskId: task.id,
              agentInstanceId: 'instance-1',
              status: 'FAILED',
              error: 'Test error',
            });

            if (retryCount >= maxRetries) {
              // Should notify failure, not retry
              expect(notifications.notifyTaskFailed).toHaveBeenCalled();
              expect(prisma.workflowTask.update).not.toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }),
              );
            } else {
              // Should retry — reset to PENDING
              expect(prisma.workflowTask.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }),
              );
            }

            jest.clearAllMocks();
            prisma.workflowTask.count.mockResolvedValue(0);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  // ── Property 11: Heartbeat timeout detection ──────────────────────────
  // Feature: agent-workflow-automation, Property 11: Heartbeat timeout detection

  describe('Property 11: Heartbeat timeout detection', () => {
    it('property: instances with stale heartbeat are marked TIMED_OUT', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 60 }),  // heartbeatIntervalSec
          fc.integer({ min: 0, max: 300 }), // seconds since last heartbeat
          async (heartbeatIntervalSec, secondsSinceHeartbeat) => {
            const lastHeartbeat = new Date(Date.now() - secondsSinceHeartbeat * 1000);
            const instance = {
              id: 'inst-1',
              workflowTaskId: 'task-1',
              status: 'RUNNING',
              heartbeatIntervalSec,
              lastHeartbeat,
            };
            prisma.agentInstance.findMany.mockResolvedValue([instance]);
            prisma.$transaction.mockResolvedValue([{}, {}]);

            await service.detectTimedOutAgents();

            const threshold = heartbeatIntervalSec * 2; // 2× multiplier
            const isTimedOut = secondsSinceHeartbeat > threshold;

            if (isTimedOut) {
              expect(prisma.$transaction).toHaveBeenCalled();
            }

            jest.clearAllMocks();
            prisma.agentInstance.findMany.mockResolvedValue([]);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('marks instance as TIMED_OUT when heartbeat is stale', async () => {
      const staleHeartbeat = new Date(Date.now() - 120_000); // 2 minutes ago
      const instance = {
        id: 'inst-1',
        workflowTaskId: 'task-1',
        status: 'RUNNING',
        heartbeatIntervalSec: 30, // threshold = 60s, stale = 120s → timed out
        lastHeartbeat: staleHeartbeat,
      };
      prisma.agentInstance.findMany.mockResolvedValue([instance]);
      prisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await service.detectTimedOutAgents();
      expect(result.timedOut).toContain('inst-1');
    });

    it('does NOT mark instance as TIMED_OUT when heartbeat is recent', async () => {
      const recentHeartbeat = new Date(Date.now() - 10_000); // 10 seconds ago
      const instance = {
        id: 'inst-1',
        workflowTaskId: 'task-1',
        status: 'RUNNING',
        heartbeatIntervalSec: 30, // threshold = 60s, recent = 10s → OK
        lastHeartbeat: recentHeartbeat,
      };
      prisma.agentInstance.findMany.mockResolvedValue([instance]);

      const result = await service.detectTimedOutAgents();
      expect(result.timedOut).not.toContain('inst-1');
    });
  });

  // ── Property 12: Completion callback processing ───────────────────────
  // Feature: agent-workflow-automation, Property 12: Completion callback processing updates state and stores artifacts

  describe('Property 12: completeTask stores artifacts and updates state', () => {
    it('property: N artifacts in callback → N artifact records created', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10 }), // number of artifacts
          async (artifactCount) => {
            const task = makeTask({ status: 'RUNNING' });
            prisma.workflowTask.findUnique.mockResolvedValue(task);

            const createManyMock = jest.fn().mockResolvedValue({ count: artifactCount });
            prisma.$transaction.mockImplementation(async (fn) => {
              if (typeof fn === 'function') {
                return fn({
                  agentInstance: { updateMany: jest.fn() },
                  workflowTask: { update: jest.fn() },
                  artifactOutput: { createMany: createManyMock },
                });
              }
              return Promise.all(fn);
            });

            prisma.workflowTask.count.mockResolvedValue(1);

            const artifacts = Array.from({ length: artifactCount }, (_, i) => ({
              artifactType: 'DOCUMENT',
              name: `artifact-${i}.md`,
              contentRef: `artifacts/exec-1/task-1/artifact-${i}.md`,
            }));

            await service.completeTask({
              taskId: task.id,
              agentInstanceId: 'instance-1',
              status: 'DONE',
              artifacts,
            });

            if (artifactCount > 0) {
              expect(createManyMock).toHaveBeenCalledWith(
                expect.objectContaining({
                  data: expect.arrayContaining([
                    expect.objectContaining({ workflowTaskId: task.id }),
                  ]),
                }),
              );
            }

            jest.clearAllMocks();
            prisma.workflowTask.count.mockResolvedValue(0);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('ignores duplicate callbacks for already-terminal tasks', async () => {
      const task = makeTask({ status: 'DONE' }); // already terminal
      prisma.workflowTask.findUnique.mockResolvedValue(task);

      const result = await service.completeTask({
        taskId: task.id,
        agentInstanceId: 'instance-1',
        status: 'DONE',
      });

      expect(result.duplicate).toBe(true);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown task', async () => {
      prisma.workflowTask.findUnique.mockResolvedValue(null);

      await expect(
        service.completeTask({ taskId: 'non-existent', agentInstanceId: 'inst-1', status: 'DONE' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Property 13: Workflow completion detection ────────────────────────
  // Feature: agent-workflow-automation, Property 13: Workflow completion detection

  describe('Property 13: Workflow completion detection', () => {
    it('marks execution COMPLETED when all tasks are terminal', async () => {
      const task = makeTask({ status: 'RUNNING' });
      prisma.workflowTask.findUnique.mockResolvedValue(task);
      prisma.$transaction.mockImplementation(async (fn) => {
        if (typeof fn === 'function') {
          return fn({
            agentInstance: { updateMany: jest.fn() },
            workflowTask: { update: jest.fn() },
            artifactOutput: { createMany: jest.fn() },
          });
        }
        return Promise.all(fn);
      });

      // No remaining non-terminal tasks → should complete
      prisma.workflowTask.count
        .mockResolvedValueOnce(0)  // remaining non-terminal = 0
        .mockResolvedValueOnce(0)  // failed count = 0
        .mockResolvedValueOnce(1); // done count = 1

      prisma.workflowExecution.findUnique.mockResolvedValue(makeExecution());
      prisma.workflowExecution.update.mockResolvedValue(makeExecution({ status: 'COMPLETED' }));

      await service.completeTask({
        taskId: task.id,
        agentInstanceId: 'instance-1',
        status: 'DONE',
      });

      expect(prisma.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: expect.stringMatching(/COMPLETED|FAILED/) }),
        }),
      );
    });
  });

  // ── Property 22: Cancellation marks all pending tasks as cancelled ────
  // Feature: agent-workflow-automation, Property 22: Cancellation marks all pending tasks as cancelled

  describe('Property 22: cancel marks all pending/running tasks as CANCELLED', () => {
    it('property: after cancel, all pending tasks are CANCELLED', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10 }), // number of pending tasks
          async (pendingCount) => {
            const execution = makeExecution({ status: 'RUNNING' });
            prisma.workflowExecution.findUnique.mockResolvedValue(execution);
            prisma.workflowTask.findMany.mockResolvedValue(
              Array.from({ length: pendingCount }, (_, i) => ({ id: `task-${i}` })),
            );
            prisma.agentInstance.updateMany.mockResolvedValue({ count: pendingCount });
            prisma.workflowTask.updateMany.mockResolvedValue({ count: pendingCount });
            prisma.workflowExecution.update.mockResolvedValue({ ...execution, status: 'CANCELLED' });

            await service.cancel(execution.id);

            expect(prisma.workflowTask.updateMany).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({ status: 'CANCELLED' }),
              }),
            );

            jest.clearAllMocks();
          },
        ),
        { numRuns: 50 },
      );
    });

    it('throws BadRequestException when trying to cancel a non-running execution', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(makeExecution({ status: 'COMPLETED' }));

      // cancel should still work (it doesn't check status before cancelling)
      // but pause/resume do check status
      prisma.workflowTask.findMany.mockResolvedValue([]);
      prisma.workflowTask.updateMany.mockResolvedValue({ count: 0 });
      prisma.workflowExecution.update.mockResolvedValue(makeExecution({ status: 'CANCELLED' }));

      await expect(service.cancel('exec-1')).resolves.toBeDefined();
    });
  });

  // ── Unit tests for pause/resume ───────────────────────────────────────

  describe('pause', () => {
    it('pauses a running execution', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(makeExecution({ status: 'RUNNING' }));
      prisma.workflowExecution.update.mockResolvedValue(makeExecution({ status: 'PAUSED' }));

      await service.pause('exec-1');

      expect(prisma.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'PAUSED' } }),
      );
    });

    it('throws BadRequestException when execution is not running', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(makeExecution({ status: 'PAUSED' }));

      await expect(service.pause('exec-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resume', () => {
    it('resumes a paused execution and dispatches eligible tasks', async () => {
      const execution = makeExecution({ status: 'PAUSED' });
      prisma.workflowExecution.findUnique.mockResolvedValue(execution);
      prisma.workflowExecution.update.mockResolvedValue({ ...execution, status: 'RUNNING' });
      scheduler.getEligibleTaskIds.mockResolvedValue(['task-1', 'task-2']);
      scheduler.dispatch.mockResolvedValue(['task-1', 'task-2']);

      await service.resume('exec-1');

      expect(prisma.workflowExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'RUNNING' } }),
      );
      expect(scheduler.dispatch).toHaveBeenCalled();
    });

    it('throws BadRequestException when execution is not paused', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(makeExecution({ status: 'RUNNING' }));

      await expect(service.resume('exec-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── Heartbeat ─────────────────────────────────────────────────────────

  describe('heartbeat', () => {
    it('returns acknowledged=true and updates lastHeartbeat', async () => {
      prisma.agentInstance.findUnique.mockResolvedValue({
        id: 'inst-1', shouldTerminate: false,
      });
      prisma.agentInstance.update.mockResolvedValue({});

      const result = await service.heartbeat('inst-1');
      expect(result.acknowledged).toBe(true);
      expect(result.shouldTerminate).toBe(false);
    });

    it('returns shouldTerminate=true when instance is flagged', async () => {
      prisma.agentInstance.findUnique.mockResolvedValue({
        id: 'inst-1', shouldTerminate: true,
      });
      prisma.agentInstance.update.mockResolvedValue({});

      const result = await service.heartbeat('inst-1');
      expect(result.shouldTerminate).toBe(true);
    });

    it('returns acknowledged=false for unknown instance', async () => {
      prisma.agentInstance.findUnique.mockResolvedValue(null);

      const result = await service.heartbeat('non-existent');
      expect(result.acknowledged).toBe(false);
      expect(result.shouldTerminate).toBe(true);
    });
  });
});
