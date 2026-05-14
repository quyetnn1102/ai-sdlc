/**
 * Property-based tests for MonitoringService
 *
 * Feature: agent-workflow-automation
 * Property 17: Artifact consolidated view groups correctly by phase
 * Property 18: At-risk task detection
 * Requirements: 7.5, 8.3
 */
import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// ── Mock factory ──────────────────────────────────────────────────────────

function buildMockPrisma() {
  return {
    workflowExecution: {
      findUnique: jest.fn(),
    },
    workflowTask: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function makeExecution(overrides: Partial<{
  id: string; projectId: string; status: string; config: object;
  startedAt: Date | null; completedAt: Date | null;
}> = {}) {
  return {
    id: 'exec-1',
    projectId: 'project-1',
    status: 'RUNNING',
    config: { atRiskThresholdSec: 300 },
    startedAt: new Date(),
    completedAt: null,
    tasks: [],
    ...overrides,
  };
}

function makeTask(overrides: Partial<{
  id: string; phaseName: string; phaseId: string; status: string;
  startedAt: Date | null; completedAt: Date | null;
  agentProfile: { id: string; name: string; role: string };
  instances: unknown[];
  artifacts: unknown[];
  dependencies: unknown[];
  _count: { artifacts: number };
}> = {}) {
  return {
    id: 'task-1',
    phaseName: 'In Dev',
    phaseId: 'phase-1',
    status: 'RUNNING',
    startedAt: new Date(),
    completedAt: null,
    agentProfile: { id: 'agent-1', name: 'Dev Agent', role: 'DEV_AGENT' },
    instances: [],
    artifacts: [],
    dependencies: [],
    _count: { artifacts: 0 },
    ...overrides,
  };
}

function makeArtifact(overrides: Partial<{
  id: string; name: string; artifactType: string; contentRef: string;
  workflowTaskId: string; createdAt: Date;
}> = {}) {
  return {
    id: 'artifact-1',
    name: 'output.md',
    artifactType: 'DOCUMENT',
    contentRef: 'artifacts/exec-1/task-1/output.md',
    workflowTaskId: 'task-1',
    createdAt: new Date(),
    ...overrides,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────

describe('MonitoringService', () => {
  let service: MonitoringService;
  let prisma: ReturnType<typeof buildMockPrisma>;

  beforeEach(async () => {
    prisma = buildMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MonitoringService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MonitoringService>(MonitoringService);
  });

  // ── Property 17: Artifact consolidated view groups correctly by phase ─
  // Feature: agent-workflow-automation, Property 17: Artifact consolidated view groups correctly by phase

  describe('Property 17: getArtifacts groups all artifacts by phase', () => {
    it('property: every artifact appears in exactly one phase group', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              phaseName: fc.constantFrom('In Dev', 'In Test', 'In Review', 'Ready for Release'),
              artifactCount: fc.integer({ min: 0, max: 5 }),
            }),
            { minLength: 1, maxLength: 6 },
          ),
          async (phaseData) => {
            const execution = makeExecution();
            prisma.workflowExecution.findUnique.mockResolvedValue(execution);

            // Build tasks with artifacts
            const tasks = phaseData.map((pd, i) => {
              const artifacts = Array.from({ length: pd.artifactCount }, (_, j) =>
                makeArtifact({ id: `a-${i}-${j}`, workflowTaskId: `task-${i}` }),
              );
              return makeTask({
                id: `task-${i}`,
                phaseName: pd.phaseName,
                phaseId: `phase-${i}`,
                artifacts,
              });
            });
            prisma.workflowTask.findMany.mockResolvedValue(tasks);

            const result = await service.getArtifacts('exec-1');

            // Total artifact count should match sum of all artifacts
            const expectedTotal = phaseData.reduce((sum, pd) => sum + pd.artifactCount, 0);
            expect(result.totalArtifacts).toBe(expectedTotal);

            // Every artifact should appear in exactly one phase group
            const allArtifactIds = result.byPhase.flatMap((g) => g.artifacts.map((a: any) => a.id));
            const uniqueIds = new Set(allArtifactIds);
            expect(uniqueIds.size).toBe(allArtifactIds.length); // no duplicates

            // Each phase group should have the correct phase name
            for (const group of result.byPhase) {
              expect(group.phaseName).toBeTruthy();
              expect(group.artifacts.length).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('property: phases with no artifacts are excluded from the grouped view', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // phases with artifacts
          fc.integer({ min: 0, max: 3 }), // phases without artifacts
          async (withArtifacts, withoutArtifacts) => {
            const execution = makeExecution();
            prisma.workflowExecution.findUnique.mockResolvedValue(execution);

            const tasks = [
              ...Array.from({ length: withArtifacts }, (_, i) =>
                makeTask({
                  id: `task-with-${i}`,
                  phaseName: `Phase With ${i}`,
                  artifacts: [makeArtifact({ id: `a-${i}`, workflowTaskId: `task-with-${i}` })],
                }),
              ),
              ...Array.from({ length: withoutArtifacts }, (_, i) =>
                makeTask({
                  id: `task-without-${i}`,
                  phaseName: `Phase Without ${i}`,
                  artifacts: [], // no artifacts
                }),
              ),
            ];
            prisma.workflowTask.findMany.mockResolvedValue(tasks);

            const result = await service.getArtifacts('exec-1');

            // Only phases with artifacts should appear in byPhase
            expect(result.byPhase.length).toBe(withArtifacts);
            expect(result.totalArtifacts).toBe(withArtifacts);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('returns empty result for execution with no artifacts', async () => {
      prisma.workflowExecution.findUnique.mockResolvedValue(makeExecution());
      prisma.workflowTask.findMany.mockResolvedValue([
        makeTask({ artifacts: [] }),
      ]);

      const result = await service.getArtifacts('exec-1');
      expect(result.totalArtifacts).toBe(0);
      expect(result.byPhase).toHaveLength(0);
    });

    it('returns empty result for unknown execution (getArtifacts does not throw)', async () => {
      // getArtifacts queries tasks directly without checking execution existence
      prisma.workflowExecution.findUnique.mockResolvedValue(null);
      prisma.workflowTask.findMany.mockResolvedValue([]);

      const result = await service.getArtifacts('non-existent');
      expect(result.totalArtifacts).toBe(0);
    });
  });

  // ── Property 18: At-risk task detection ──────────────────────────────
  // Feature: agent-workflow-automation, Property 18: At-risk task detection

  describe('Property 18: getTaskList flags at-risk tasks correctly', () => {
    it('property: task is at-risk iff RUNNING and elapsed > threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 600 }),  // atRiskThresholdSec
          fc.integer({ min: 0, max: 1200 }), // elapsedSec
          async (atRiskThresholdSec, elapsedSec) => {
            const execution = makeExecution({ config: { atRiskThresholdSec } });
            prisma.workflowExecution.findUnique.mockResolvedValue(execution);

            const startedAt = new Date(Date.now() - elapsedSec * 1000);
            const task = makeTask({ status: 'RUNNING', startedAt });
            prisma.workflowTask.findMany.mockResolvedValue([task]);

            const result = await service.getTaskList('exec-1');
            const taskResult = result[0];

            const expectedAtRisk = elapsedSec > atRiskThresholdSec;
            expect(taskResult.isAtRisk).toBe(expectedAtRisk);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('property: non-RUNNING tasks are never at-risk', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('PENDING', 'DONE', 'FAILED', 'CANCELLED', 'TIMED_OUT'),
          fc.integer({ min: 1, max: 600 }),
          async (status, atRiskThresholdSec) => {
            const execution = makeExecution({ config: { atRiskThresholdSec } });
            prisma.workflowExecution.findUnique.mockResolvedValue(execution);

            // Task started long ago but is not RUNNING
            const startedAt = new Date(Date.now() - (atRiskThresholdSec + 100) * 1000);
            const task = makeTask({ status, startedAt });
            prisma.workflowTask.findMany.mockResolvedValue([task]);

            const result = await service.getTaskList('exec-1');
            expect(result[0].isAtRisk).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('property: tasks with no startedAt are never at-risk', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 300 }),
          async (atRiskThresholdSec) => {
            const execution = makeExecution({ config: { atRiskThresholdSec } });
            prisma.workflowExecution.findUnique.mockResolvedValue(execution);

            const task = makeTask({ status: 'RUNNING', startedAt: null });
            prisma.workflowTask.findMany.mockResolvedValue([task]);

            const result = await service.getTaskList('exec-1');
            expect(result[0].isAtRisk).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('flags task as at-risk when elapsed exceeds threshold', async () => {
      const execution = makeExecution({ config: { atRiskThresholdSec: 300 } });
      prisma.workflowExecution.findUnique.mockResolvedValue(execution);

      // Task started 10 minutes ago (600s > 300s threshold)
      const startedAt = new Date(Date.now() - 600_000);
      const task = makeTask({ status: 'RUNNING', startedAt });
      prisma.workflowTask.findMany.mockResolvedValue([task]);

      const result = await service.getTaskList('exec-1');
      expect(result[0].isAtRisk).toBe(true);
    });

    it('does NOT flag task as at-risk when elapsed is below threshold', async () => {
      const execution = makeExecution({ config: { atRiskThresholdSec: 300 } });
      prisma.workflowExecution.findUnique.mockResolvedValue(execution);

      // Task started 1 minute ago (60s < 300s threshold)
      const startedAt = new Date(Date.now() - 60_000);
      const task = makeTask({ status: 'RUNNING', startedAt });
      prisma.workflowTask.findMany.mockResolvedValue([task]);

      const result = await service.getTaskList('exec-1');
      expect(result[0].isAtRisk).toBe(false);
    });
  });
});
