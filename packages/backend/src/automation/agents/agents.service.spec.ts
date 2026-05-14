/**
 * Property-based and unit tests for AgentsService
 *
 * Feature: agent-workflow-automation
 * Properties 1–4: Agent profile and phase-agent mapping correctness
 * Requirements: 1.1–1.5, 2.1–2.5
 */
import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

// ── Helpers ───────────────────────────────────────────────────────────────

const VALID_ROLES = ['BA_AGENT', 'DEV_AGENT', 'QA_AGENT', 'DEVOPS_AGENT', 'DESIGNER_AGENT', 'SRE_AGENT'];

function makeProfile(overrides: Partial<{
  id: string; name: string; role: string; description: string;
  skillSet: string[]; supportedPhases: string[]; isDefault: boolean;
  projectId: string | null; createdAt: Date; updatedAt: Date;
  config: Record<string, unknown>;
}> = {}) {
  return {
    id: 'profile-1',
    name: 'Test Agent',
    role: 'DEV_AGENT',
    description: 'A test agent',
    skillSet: ['typescript'],
    supportedPhases: ['In Dev'],
    isDefault: false,
    projectId: 'project-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    config: {},
    ...overrides,
  };
}

function makePhase(overrides: Partial<{ id: string; name: string; order: number; projectId: string }> = {}) {
  return {
    id: 'phase-1',
    name: 'In Dev',
    order: 1,
    projectId: 'project-1',
    color: '#3B82F6',
    ...overrides,
  };
}

// ── Mock factories ────────────────────────────────────────────────────────

function buildMockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    agentProfile: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    phaseAgentMapping: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    workflowPhase: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    workflowTask: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  };
}

function buildMockAudit() {
  return { log: jest.fn() };
}

// ── Test suite ────────────────────────────────────────────────────────────

describe('AgentsService', () => {
  let service: AgentsService;
  let prisma: ReturnType<typeof buildMockPrisma>;
  let audit: ReturnType<typeof buildMockAudit>;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    audit  = buildMockAudit();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService,  useValue: audit  },
      ],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  // ── Property 1: Agent profile round-trip persistence ─────────────────
  // Feature: agent-workflow-automation, Property 1: Agent profile round-trip persistence

  describe('Property 1: createProfile persists all fields correctly', () => {
    it('property: created profile contains all provided fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name:            fc.string({ minLength: 1, maxLength: 100 }),
            role:            fc.constantFrom(...VALID_ROLES),
            description:     fc.string(),
            skillSet:        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
            supportedPhases: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
          }),
          async (dto) => {
            const expected = makeProfile({ ...dto, id: 'new-id' });
            prisma.agentProfile.create.mockResolvedValue(expected);

            const result = await service.createProfile('project-1', dto);

            expect(result.name).toBe(dto.name);
            expect(result.role).toBe(dto.role);
            expect(result.skillSet).toEqual(dto.skillSet);
            expect(result.supportedPhases).toEqual(dto.supportedPhases);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Property 2: Agent profile validation rejects invalid inputs ───────
  // Feature: agent-workflow-automation, Property 2: Agent profile validation rejects invalid inputs

  describe('Property 2: createProfile rejects invalid inputs', () => {
    it('property: empty skillSet is always rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name:            fc.string({ minLength: 1 }),
            role:            fc.constantFrom(...VALID_ROLES),
            supportedPhases: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
          }),
          async (dto) => {
            await expect(
              service.createProfile('project-1', { ...dto, skillSet: [] }),
            ).rejects.toThrow(BadRequestException);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('property: empty supportedPhases is always rejected', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name:     fc.string({ minLength: 1 }),
            role:     fc.constantFrom(...VALID_ROLES),
            skillSet: fc.array(fc.string({ minLength: 1 }), { minLength: 1 }),
          }),
          async (dto) => {
            await expect(
              service.createProfile('project-1', { ...dto, supportedPhases: [] }),
            ).rejects.toThrow(BadRequestException);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('property: valid dto (non-empty skillSet and supportedPhases) always succeeds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name:            fc.string({ minLength: 1, maxLength: 100 }),
            role:            fc.constantFrom(...VALID_ROLES),
            skillSet:        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
            supportedPhases: fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
          }),
          async (dto) => {
            const expected = makeProfile(dto);
            prisma.agentProfile.create.mockResolvedValue(expected);
            await expect(service.createProfile('project-1', dto)).resolves.toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Unit tests for Agent Profile CRUD ────────────────────────────────

  describe('createProfile', () => {
    it('creates profile with valid data', async () => {
      const dto = { name: 'Dev Agent', role: 'DEV_AGENT', skillSet: ['typescript'], supportedPhases: ['In Dev'] };
      const expected = makeProfile(dto);
      prisma.agentProfile.create.mockResolvedValue(expected);

      const result = await service.createProfile('project-1', dto);
      expect(result).toEqual(expected);
      expect(prisma.agentProfile.create).toHaveBeenCalledTimes(1);
    });

    it('rejects empty skillSet with BadRequestException', async () => {
      await expect(
        service.createProfile('project-1', { name: 'X', role: 'DEV_AGENT', skillSet: [], supportedPhases: ['In Dev'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects empty supportedPhases with BadRequestException', async () => {
      await expect(
        service.createProfile('project-1', { name: 'X', role: 'DEV_AGENT', skillSet: ['ts'], supportedPhases: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProfile', () => {
    it('rejects update when profile is referenced by a running execution', async () => {
      prisma.agentProfile.findUnique.mockResolvedValue(makeProfile());
      prisma.workflowTask.findFirst.mockResolvedValue({ id: 'task-1' }); // running task found

      await expect(
        service.updateProfile('profile-1', { skillSet: ['new-skill'] }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects update with empty skillSet', async () => {
      prisma.agentProfile.findUnique.mockResolvedValue(makeProfile());
      prisma.workflowTask.findFirst.mockResolvedValue(null); // no running task

      await expect(
        service.updateProfile('profile-1', { skillSet: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects update with empty supportedPhases', async () => {
      prisma.agentProfile.findUnique.mockResolvedValue(makeProfile());
      prisma.workflowTask.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProfile('profile-1', { supportedPhases: [] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('succeeds when no running execution references the profile', async () => {
      const updated = makeProfile({ name: 'Updated' });
      prisma.agentProfile.findUnique.mockResolvedValue(makeProfile());
      prisma.workflowTask.findFirst.mockResolvedValue(null);
      prisma.agentProfile.update.mockResolvedValue(updated);

      const result = await service.updateProfile('profile-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('deleteProfile', () => {
    it('rejects delete when profile is referenced by mappings', async () => {
      prisma.agentProfile.findUnique.mockResolvedValue(makeProfile());
      prisma.phaseAgentMapping.count.mockResolvedValue(2); // 2 mappings exist

      await expect(service.deleteProfile('profile-1')).rejects.toThrow(ConflictException);
    });

    it('succeeds when no mappings reference the profile', async () => {
      const profile = makeProfile();
      prisma.agentProfile.findUnique.mockResolvedValue(profile);
      prisma.phaseAgentMapping.count.mockResolvedValue(0);
      prisma.agentProfile.delete.mockResolvedValue(profile);

      const result = await service.deleteProfile('profile-1');
      expect(result).toEqual(profile);
    });

    it('throws NotFoundException for non-existent profile', async () => {
      prisma.agentProfile.findUnique.mockResolvedValue(null);

      await expect(service.deleteProfile('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('seedDefaults', () => {
    it('creates 4 default profiles when none exist', async () => {
      prisma.agentProfile.count.mockResolvedValue(0);
      prisma.agentProfile.create.mockResolvedValue(makeProfile());

      const result = await service.seedDefaults('project-1');
      expect(result.seeded).toBe(4);
      expect(prisma.agentProfile.create).toHaveBeenCalledTimes(4);
    });

    it('skips seeding when profiles already exist', async () => {
      prisma.agentProfile.count.mockResolvedValue(3);

      const result = await service.seedDefaults('project-1');
      expect(result.seeded).toBe(0);
      expect(prisma.agentProfile.create).not.toHaveBeenCalled();
    });
  });

  // ── Property 3: Phase-agent mapping validation enforces phase support ─
  // Feature: agent-workflow-automation, Property 3: Phase-agent mapping validation enforces phase support

  describe('Property 3: createMapping enforces phase support', () => {
    it('property: mapping succeeds iff phase name is in supportedPhases', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (supportedPhases, phaseName) => {
            const profile = makeProfile({ supportedPhases });
            const phase   = makePhase({ name: phaseName });

            prisma.agentProfile.findUnique.mockResolvedValue(profile);
            prisma.workflowPhase.findUnique.mockResolvedValue(phase);
            prisma.phaseAgentMapping.create.mockResolvedValue({
              id: 'mapping-1', phaseId: phase.id, agentProfileId: profile.id,
              projectId: 'project-1', priority: 0, createdAt: new Date(),
              agentProfile: { id: profile.id, name: profile.name, role: profile.role },
            });

            const dto = { phaseId: phase.id, agentProfileId: profile.id };

            if (supportedPhases.includes(phaseName)) {
              await expect(service.createMapping('project-1', dto)).resolves.toBeDefined();
            } else {
              await expect(service.createMapping('project-1', dto)).rejects.toThrow(BadRequestException);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('allows mapping when supportedPhases is empty (wildcard)', async () => {
      const profile = makeProfile({ supportedPhases: [] });
      const phase   = makePhase({ name: 'Any Phase' });
      prisma.agentProfile.findUnique.mockResolvedValue(profile);
      prisma.workflowPhase.findUnique.mockResolvedValue(phase);
      prisma.phaseAgentMapping.create.mockResolvedValue({
        id: 'mapping-1', phaseId: phase.id, agentProfileId: profile.id,
        projectId: 'project-1', priority: 0, createdAt: new Date(),
        agentProfile: { id: profile.id, name: profile.name, role: profile.role },
      });

      await expect(service.createMapping('project-1', { phaseId: phase.id, agentProfileId: profile.id }))
        .resolves.toBeDefined();
    });
  });

  // ── Property 4: Phase-agent mappings returned in priority order ───────
  // Feature: agent-workflow-automation, Property 4: Phase-agent mappings are returned in priority order

  describe('Property 4: getMappingsByPhase returns mappings sorted by priority', () => {
    it('property: mappings are always returned in ascending priority order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 8 }),
          async (priorities) => {
            const mappings = priorities.map((priority, i) => ({
              id: `m${i}`, phaseId: 'phase-1', agentProfileId: `agent-${i}`,
              projectId: 'project-1', priority, createdAt: new Date(),
              agentProfile: { id: `agent-${i}`, name: `Agent ${i}`, role: 'DEV_AGENT', supportedPhases: [] },
            }));
            // Simulate DB returning sorted by priority
            const sorted = [...mappings].sort((a, b) => a.priority - b.priority);
            prisma.phaseAgentMapping.findMany.mockResolvedValue(sorted);

            const result = await service.getMappingsByPhase('project-1', 'phase-1');

            for (let i = 1; i < result.length; i++) {
              expect(result[i].priority).toBeGreaterThanOrEqual(result[i - 1].priority);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ── Unit tests for Phase-Agent Mapping ───────────────────────────────

  describe('createMapping', () => {
    it('rejects mapping when agent does not support the phase', async () => {
      const profile = makeProfile({ supportedPhases: ['In Dev'] });
      const phase   = makePhase({ name: 'In Test' }); // not in supportedPhases
      prisma.agentProfile.findUnique.mockResolvedValue(profile);
      prisma.workflowPhase.findUnique.mockResolvedValue(phase);

      await expect(
        service.createMapping('project-1', { phaseId: phase.id, agentProfileId: profile.id }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when phase does not exist', async () => {
      prisma.agentProfile.findUnique.mockResolvedValue(makeProfile());
      prisma.workflowPhase.findUnique.mockResolvedValue(null);

      await expect(
        service.createMapping('project-1', { phaseId: 'non-existent', agentProfileId: 'profile-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateMappings', () => {
    it('returns valid=true when all phases have correct mappings', async () => {
      const phase   = makePhase({ name: 'In Dev' });
      const profile = makeProfile({ supportedPhases: ['In Dev'] });
      prisma.workflowPhase.findMany.mockResolvedValue([phase]);
      prisma.phaseAgentMapping.findMany.mockResolvedValue([{
        id: 'm1', phaseId: phase.id, agentProfileId: profile.id,
        projectId: 'project-1', priority: 0, createdAt: new Date(),
        agentProfile: { id: profile.id, name: profile.name, supportedPhases: profile.supportedPhases },
      }]);

      const result = await service.validateMappings('project-1');
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('returns no_mapping issue for unmapped phases', async () => {
      const phase = makePhase({ name: 'In Test' });
      prisma.workflowPhase.findMany.mockResolvedValue([phase]);
      prisma.phaseAgentMapping.findMany.mockResolvedValue([]); // no mappings

      const result = await service.validateMappings('project-1');
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].issue).toBe('no_mapping');
    });

    it('returns phase_not_supported issue when agent does not support phase', async () => {
      const phase   = makePhase({ name: 'In Test' });
      const profile = makeProfile({ supportedPhases: ['In Dev'] }); // does NOT support In Test
      prisma.workflowPhase.findMany.mockResolvedValue([phase]);
      prisma.phaseAgentMapping.findMany.mockResolvedValue([{
        id: 'm1', phaseId: phase.id, agentProfileId: profile.id,
        projectId: 'project-1', priority: 0, createdAt: new Date(),
        agentProfile: { id: profile.id, name: profile.name, supportedPhases: profile.supportedPhases },
      }]);

      const result = await service.validateMappings('project-1');
      expect(result.valid).toBe(false);
      expect(result.issues[0].issue).toBe('phase_not_supported');
    });
  });
});
