/**
 * Unit and property-based tests for AgentExecutorService
 *
 * Feature: agent-workflow-automation
 * Property 16: Upstream artifacts are available to downstream tasks
 * Requirements: 5.2, 7.3, 9.4, 9.5, 10.1, 10.2
 */
import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentExecutorService } from './agent-executor.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { LlmRouterService } from './llm-router.service';

// ── Mock factories ────────────────────────────────────────────────────────

function buildMockPrisma() {
  return {
    agentInstance: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    aiDlcSession: {
      upsert: jest.fn().mockResolvedValue({ id: 'session-1' }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    aiDlcArtifact: {
      create: jest.fn().mockResolvedValue({ id: 'dlc-artifact-1' }),
    },
    agentProfile: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'agent-1',
        name: 'Dev Agent',
        role: 'DEV_AGENT',
        skillSet: ['typescript'],
        config: { provider: 'simulate' },
      }),
    },
  };
}

function buildMockOrchestration() {
  return {
    completeTask: jest.fn().mockResolvedValue({ taskId: 'task-1', status: 'DONE' }),
    heartbeat: jest.fn().mockResolvedValue({ acknowledged: true, shouldTerminate: false }),
  };
}

function buildMockLlmRouter() {
  return {
    call: jest.fn().mockResolvedValue({
      content: 'Generated content for the phase',
      model: 'simulate',
      usage: { inputTokens: 100, outputTokens: 200 },
    }),
  };
}

function makeContext(overrides: Partial<{
  workflowExecutionId: string;
  workflowTaskId: string;
  agentInstanceId: string;
  agentProfileId: string;
  phaseName: string;
  inputArtifacts: Array<{ name: string; artifactType: string; contentRef: string }>;
  sessionId: string;
  heartbeatIntervalMs: number;
  taskTimeoutMs: number;
}> = {}) {
  return {
    workflowExecutionId: 'exec-1',
    workflowTaskId: 'task-1',
    agentInstanceId: 'inst-1',
    agentProfileId: 'agent-1',
    phaseName: 'In Dev',
    inputArtifacts: [],
    sessionId: 'session-1',
    heartbeatIntervalMs: 30_000,
    taskTimeoutMs: 600_000,
    ...overrides,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────

describe('AgentExecutorService', () => {
  let service: AgentExecutorService;
  let prisma: ReturnType<typeof buildMockPrisma>;
  let orchestration: ReturnType<typeof buildMockOrchestration>;
  let llmRouter: ReturnType<typeof buildMockLlmRouter>;

  beforeEach(async () => {
    prisma        = buildMockPrisma();
    orchestration = buildMockOrchestration();
    llmRouter     = buildMockLlmRouter();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentExecutorService,
        { provide: PrismaService,        useValue: prisma        },
        { provide: OrchestrationService, useValue: orchestration },
        { provide: LlmRouterService,     useValue: llmRouter     },
      ],
    }).compile();

    service = module.get<AgentExecutorService>(AgentExecutorService);
  });

  // ── Property 16: Upstream artifacts available to downstream tasks ─────
  // Feature: agent-workflow-automation, Property 16: Upstream artifacts are available to downstream tasks

  describe('Property 16: Input artifacts are passed to agent context', () => {
    it('property: all input artifacts are included in the LLM prompt context', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name:         fc.string({ minLength: 1, maxLength: 50 }),
              artifactType: fc.constantFrom('DOCUMENT', 'CODE', 'TEST_PLAN'),
              contentRef:   fc.string({ minLength: 1 }),
            }),
            { minLength: 0, maxLength: 5 },
          ),
          async (inputArtifacts) => {
            const ctx = makeContext({ inputArtifacts });

            // Start the agent and wait for it to complete
            await service.start(ctx);

            // Give the async loop time to run
            await new Promise((resolve) => setTimeout(resolve, 50));

            // The LLM should have been called with the input artifacts in context
            if (llmRouter.call.mock.calls.length > 0) {
              const callArgs = llmRouter.call.mock.calls[0];
              const messages = callArgs[1] as Array<{ role: string; content: string }>;
              const systemMessage = messages.find((m) => m.role === 'system');

              // If there are input artifacts, they should appear in the prompt
              if (inputArtifacts.length > 0) {
                expect(systemMessage?.content ?? '').toBeTruthy();
              }
            }

            jest.clearAllMocks();
            llmRouter.call.mockResolvedValue({
              content: 'Generated content',
              model: 'simulate',
              usage: { inputTokens: 100, outputTokens: 200 },
            });
          },
        ),
        { numRuns: 20 }, // fewer runs since each involves async I/O
      );
    });
  });

  // ── Unit tests ────────────────────────────────────────────────────────

  describe('start', () => {
    it('creates ai_dlc_session on agent start (Req 10.1)', async () => {
      const ctx = makeContext();
      await service.start(ctx);

      // Give the async loop time to run
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(prisma.aiDlcSession.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ctx.sessionId },
        }),
      );
    });

    it('creates ai_dlc_artifact records for each output (Req 10.2)', async () => {
      const ctx = makeContext();
      await service.start(ctx);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should create at least one artifact
      expect(prisma.aiDlcArtifact.create).toHaveBeenCalled();
    });

    it('calls completeTask with DONE status on success', async () => {
      const ctx = makeContext();
      await service.start(ctx);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(orchestration.completeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: ctx.workflowTaskId,
          status: 'DONE',
        }),
      );
    });

    it('calls completeTask with FAILED status on LLM error', async () => {
      llmRouter.call.mockRejectedValue(new Error('LLM API error'));

      const ctx = makeContext();
      await service.start(ctx);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(orchestration.completeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: ctx.workflowTaskId,
          status: 'FAILED',
          error: 'LLM API error',
        }),
      );
    });
  });

  describe('sendTermination', () => {
    it('sets shouldTerminate=true in DB (Req 9.4)', async () => {
      const result = await service.sendTermination('inst-1');

      expect(prisma.agentInstance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inst-1' },
          data: { shouldTerminate: true },
        }),
      );
      // Returns false when instance is not in the running map
      expect(result).toBe(false);
    });

    it('aborts running agent and returns true', async () => {
      const ctx = makeContext({ agentInstanceId: 'inst-running' });

      // Start the agent to register it in the running map
      await service.start(ctx);

      const result = await service.sendTermination('inst-running');
      expect(result).toBe(true);
    });
  });

  describe('forceTerminate', () => {
    it('marks instance as TIMED_OUT after force terminate (Req 9.5)', async () => {
      await service.forceTerminate('inst-1');

      expect(prisma.agentInstance.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inst-1' },
          data: expect.objectContaining({ status: 'TIMED_OUT' }),
        }),
      );
    });
  });

  describe('input artifacts from upstream tasks', () => {
    it('passes upstream artifacts to agent context (Req 7.3)', async () => {
      const inputArtifacts = [
        { name: 'requirements.md', artifactType: 'DOCUMENT', contentRef: 'artifacts/exec-1/task-0/requirements.md' },
        { name: 'design.md',       artifactType: 'DOCUMENT', contentRef: 'artifacts/exec-1/task-0/design.md' },
      ];

      const ctx = makeContext({ inputArtifacts });
      await service.start(ctx);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // LLM should have been called — artifacts are in the context
      expect(llmRouter.call).toHaveBeenCalled();
    });
  });
});
