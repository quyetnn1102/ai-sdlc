/**
 * Unit tests for OrchestrationController and AgentCallbackController
 *
 * Feature: agent-workflow-automation
 * Requirements: 8.1, 8.4, 9.1–9.5, 6.1, 6.3, 5.4
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrchestrationController, AgentCallbackController } from './orchestration.controller';
import { OrchestrationService } from './orchestration.service';

// ── Mock factory ──────────────────────────────────────────────────────────

function buildMockOrchestration() {
  return {
    start:              jest.fn(),
    pause:              jest.fn(),
    resume:             jest.fn(),
    cancel:             jest.fn(),
    completeTask:       jest.fn(),
    heartbeat:          jest.fn(),
    getExecutionStatus: jest.fn(),
    listExecutions:     jest.fn(),
    getTaskList:        jest.fn(),
    getDag:             jest.fn(),
    getArtifacts:       jest.fn(),
    detectTimedOutAgents: jest.fn(),
  };
}

function makeExecution(status = 'RUNNING') {
  return {
    id: 'exec-1',
    projectId: 'project-1',
    status,
    config: {},
    startedAt: new Date(),
    completedAt: null,
    initiatedBy: 'user-1',
    tasks: [],
    progress: { completed: 0, total: 0, percentage: 0 },
  };
}

// ── OrchestrationController tests ─────────────────────────────────────────

describe('OrchestrationController', () => {
  let controller: OrchestrationController;
  let orchestration: ReturnType<typeof buildMockOrchestration>;

  beforeEach(async () => {
    orchestration = buildMockOrchestration();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrchestrationController],
      providers: [
        { provide: OrchestrationService, useValue: orchestration },
      ],
    }).compile();

    controller = module.get<OrchestrationController>(OrchestrationController);
  });

  // ── Start execution ───────────────────────────────────────────────────

  describe('start', () => {
    it('starts a workflow execution with config (Req 9.1)', async () => {
      const execution = makeExecution();
      orchestration.start.mockResolvedValue(execution);

      const result = await controller.start(
        'project-1',
        { config: { maxConcurrency: 3 } },
        { user: { id: 'user-1' } },
      );

      expect(result).toEqual(execution);
      expect(orchestration.start).toHaveBeenCalledWith({
        projectId: 'project-1',
        initiatedBy: 'user-1',
        config: { maxConcurrency: 3 },
      });
    });

    it('starts with no config (uses defaults)', async () => {
      const execution = makeExecution();
      orchestration.start.mockResolvedValue(execution);

      await controller.start('project-1', {}, { user: { id: 'user-1' } });

      expect(orchestration.start).toHaveBeenCalledWith(
        expect.objectContaining({ config: undefined }),
      );
    });
  });

  // ── Pause / Resume / Cancel via PATCH ─────────────────────────────────

  describe('control (PATCH)', () => {
    it('pauses a running execution (Req 9.2)', async () => {
      const paused = makeExecution('PAUSED');
      orchestration.pause.mockResolvedValue(paused);

      const result = await controller.control('exec-1', { action: 'pause' });
      expect(result.status).toBe('PAUSED');
      expect(orchestration.pause).toHaveBeenCalledWith('exec-1');
    });

    it('resumes a paused execution (Req 9.3)', async () => {
      const running = makeExecution('RUNNING');
      orchestration.resume.mockResolvedValue(running);

      const result = await controller.control('exec-1', { action: 'resume' });
      expect(result.status).toBe('RUNNING');
      expect(orchestration.resume).toHaveBeenCalledWith('exec-1');
    });

    it('cancels an execution (Req 9.4)', async () => {
      const cancelled = makeExecution('CANCELLED');
      orchestration.cancel.mockResolvedValue(cancelled);

      const result = await controller.control('exec-1', { action: 'cancel' });
      expect(result.status).toBe('CANCELLED');
      expect(orchestration.cancel).toHaveBeenCalledWith('exec-1');
    });

    it('throws for unknown action', async () => {
      expect(() => controller.control('exec-1', { action: 'unknown' as any })).toThrow();
    });
  });

  describe('pause (shorthand)', () => {
    it('delegates to orchestration.pause', async () => {
      orchestration.pause.mockResolvedValue(makeExecution('PAUSED'));
      await controller.pause('exec-1');
      expect(orchestration.pause).toHaveBeenCalledWith('exec-1');
    });

    it('propagates BadRequestException when execution is not running', async () => {
      orchestration.pause.mockRejectedValue(new BadRequestException('Execution is not running'));
      await expect(controller.pause('exec-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resume (shorthand)', () => {
    it('delegates to orchestration.resume', async () => {
      orchestration.resume.mockResolvedValue(makeExecution('RUNNING'));
      await controller.resume('exec-1');
      expect(orchestration.resume).toHaveBeenCalledWith('exec-1');
    });

    it('propagates BadRequestException when execution is not paused', async () => {
      orchestration.resume.mockRejectedValue(new BadRequestException('Execution is not paused'));
      await expect(controller.resume('exec-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel (shorthand)', () => {
    it('delegates to orchestration.cancel', async () => {
      orchestration.cancel.mockResolvedValue(makeExecution('CANCELLED'));
      await controller.cancel('exec-1');
      expect(orchestration.cancel).toHaveBeenCalledWith('exec-1');
    });
  });

  // ── Query endpoints ───────────────────────────────────────────────────

  describe('getStatus', () => {
    it('returns execution detail with progress (Req 8.1)', async () => {
      const detail = { ...makeExecution(), progress: { completed: 3, total: 7, percentage: 42.9 } };
      orchestration.getExecutionStatus.mockResolvedValue(detail);

      const result = await controller.getStatus('exec-1');
      expect(result.progress.percentage).toBe(42.9);
    });
  });

  describe('getDag', () => {
    it('returns DAG with critical path (Req 8.2 / 8.5)', async () => {
      const dag = {
        tasks: [{ id: 't1', status: 'DONE' }, { id: 't2', status: 'RUNNING' }],
        edges: [{ fromTaskId: 't1', toTaskId: 't2' }],
        criticalPath: ['t1', 't2'],
        progress: { completed: 1, total: 2, percentage: 50 },
      };
      orchestration.getDag.mockResolvedValue(dag);

      const result = await controller.getDag('exec-1');
      expect(result.criticalPath).toEqual(['t1', 't2']);
    });
  });

  describe('getArtifacts', () => {
    it('returns artifacts grouped by phase (Req 7.5)', async () => {
      const artifacts = {
        executionId: 'exec-1',
        totalArtifacts: 2,
        byPhase: [
          { phaseId: 'p1', phaseName: 'In Dev', artifacts: [{ id: 'a1', name: 'code.ts' }] },
        ],
      };
      orchestration.getArtifacts.mockResolvedValue(artifacts);

      const result = await controller.getArtifacts('exec-1');
      expect(result.totalArtifacts).toBe(2);
      expect(result.byPhase).toHaveLength(1);
    });
  });
});

// ── AgentCallbackController tests ─────────────────────────────────────────

describe('AgentCallbackController', () => {
  let controller: AgentCallbackController;
  let orchestration: ReturnType<typeof buildMockOrchestration>;

  beforeEach(async () => {
    orchestration = buildMockOrchestration();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentCallbackController],
      providers: [
        { provide: OrchestrationService, useValue: orchestration },
      ],
    }).compile();

    controller = module.get<AgentCallbackController>(AgentCallbackController);
  });

  describe('complete', () => {
    it('processes DONE callback with artifacts (Req 6.1)', async () => {
      orchestration.completeTask.mockResolvedValue({ taskId: 'task-1', status: 'DONE' });

      const dto = {
        taskId: 'task-1',
        agentInstanceId: 'inst-1',
        status: 'DONE' as const,
        artifacts: [{ artifactType: 'DOCUMENT', name: 'output.md', contentRef: 'artifacts/exec-1/task-1/output.md' }],
        durationMs: 45_000,
      };

      const result = await controller.complete(dto);
      expect(result.status).toBe('DONE');
      expect(orchestration.completeTask).toHaveBeenCalledWith(dto);
    });

    it('processes FAILED callback with error (Req 6.3)', async () => {
      orchestration.completeTask.mockResolvedValue({ taskId: 'task-1', status: 'FAILED' });

      const dto = {
        taskId: 'task-1',
        agentInstanceId: 'inst-1',
        status: 'FAILED' as const,
        error: 'LLM API timeout',
        durationMs: 10_000,
      };

      const result = await controller.complete(dto);
      expect(result.status).toBe('FAILED');
    });
  });

  describe('heartbeat', () => {
    it('returns acknowledged=true and shouldTerminate=false for healthy agent (Req 5.4)', async () => {
      orchestration.heartbeat.mockResolvedValue({ acknowledged: true, shouldTerminate: false });

      const result = await controller.heartbeat('inst-1');
      expect(result.acknowledged).toBe(true);
      expect(result.shouldTerminate).toBe(false);
    });

    it('returns shouldTerminate=true when execution is being cancelled', async () => {
      orchestration.heartbeat.mockResolvedValue({ acknowledged: true, shouldTerminate: true });

      const result = await controller.heartbeat('inst-1');
      expect(result.shouldTerminate).toBe(true);
    });
  });
});
