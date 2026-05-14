/**
 * Unit tests for AgentsController and OrchestrationController
 *
 * Feature: agent-workflow-automation
 * Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 9.1–9.5
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { LlmRouterService } from '../agent-runtime/llm-router.service';

// ── Mock factories ────────────────────────────────────────────────────────

function buildMockAgentsService() {
  return {
    seedDefaults:       jest.fn().mockResolvedValue({ seeded: 4 }),
    createProfile:      jest.fn(),
    listProfiles:       jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 }),
    getProfile:         jest.fn(),
    updateProfile:      jest.fn(),
    deleteProfile:      jest.fn(),
    createMapping:      jest.fn(),
    listMappings:       jest.fn().mockResolvedValue([]),
    getMappingsByPhase: jest.fn().mockResolvedValue([]),
    deleteMapping:      jest.fn().mockResolvedValue({}),
    validateMappings:   jest.fn().mockResolvedValue({ valid: true, issues: [] }),
  };
}

function buildMockLlmRouter() {
  return {
    availableProviders: jest.fn().mockReturnValue(['simulate']),
    getDefaultProvider: jest.fn().mockReturnValue('simulate'),
  };
}

function makeProfile(overrides: Partial<{
  id: string; name: string; role: string; skillSet: string[]; supportedPhases: string[];
}> = {}) {
  return {
    id: 'profile-1',
    name: 'Dev Agent',
    role: 'DEV_AGENT',
    description: 'A dev agent',
    skillSet: ['typescript'],
    supportedPhases: ['In Dev'],
    isDefault: false,
    projectId: 'project-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── AgentsController tests ────────────────────────────────────────────────

describe('AgentsController', () => {
  let controller: AgentsController;
  let agentsService: ReturnType<typeof buildMockAgentsService>;

  beforeEach(async () => {
    agentsService = buildMockAgentsService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentsController],
      providers: [
        { provide: AgentsService,    useValue: agentsService },
        { provide: LlmRouterService, useValue: buildMockLlmRouter() },
      ],
    }).compile();

    controller = module.get<AgentsController>(AgentsController);
  });

  // ── Profile CRUD ──────────────────────────────────────────────────────

  describe('createProfile', () => {
    it('delegates to AgentsService.createProfile', async () => {
      const dto = { name: 'Dev Agent', role: 'DEV_AGENT', skillSet: ['ts'], supportedPhases: ['In Dev'] };
      const expected = makeProfile(dto);
      agentsService.createProfile.mockResolvedValue(expected);

      const result = await controller.createProfile('project-1', dto);
      expect(result).toEqual(expected);
      expect(agentsService.createProfile).toHaveBeenCalledWith('project-1', dto);
    });

    it('propagates BadRequestException for empty skillSet', async () => {
      agentsService.createProfile.mockRejectedValue(
        new BadRequestException('Agent profile must have at least one skill'),
      );

      await expect(
        controller.createProfile('project-1', { name: 'X', role: 'DEV_AGENT', skillSet: [], supportedPhases: ['In Dev'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates BadRequestException for empty supportedPhases', async () => {
      agentsService.createProfile.mockRejectedValue(
        new BadRequestException('Agent profile must support at least one SDLC phase'),
      );

      await expect(
        controller.createProfile('project-1', { name: 'X', role: 'DEV_AGENT', skillSet: ['ts'], supportedPhases: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProfile', () => {
    it('propagates ConflictException when profile is in active use (Req 1.3)', async () => {
      agentsService.updateProfile.mockRejectedValue(
        new ConflictException('Cannot update agent profile while it is referenced by a running workflow execution'),
      );

      await expect(
        controller.updateProfile('profile-1', { skillSet: ['new-skill'] }),
      ).rejects.toThrow(ConflictException);
    });

    it('succeeds with valid update', async () => {
      const updated = makeProfile({ name: 'Updated Agent' });
      agentsService.updateProfile.mockResolvedValue(updated);

      const result = await controller.updateProfile('profile-1', { name: 'Updated Agent' });
      expect(result.name).toBe('Updated Agent');
    });
  });

  describe('deleteProfile', () => {
    it('propagates ConflictException when profile has active mappings (Req 1.5)', async () => {
      agentsService.deleteProfile.mockRejectedValue(
        new ConflictException('Cannot delete agent profile: it is referenced by 2 phase-agent mapping(s)'),
      );

      await expect(controller.deleteProfile('profile-1')).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException for non-existent profile', async () => {
      agentsService.deleteProfile.mockRejectedValue(new NotFoundException('Agent profile not found'));

      await expect(controller.deleteProfile('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listProfiles', () => {
    it('returns profiles list', async () => {
      const profiles = [makeProfile()];
      agentsService.listProfiles.mockResolvedValue({ data: profiles, total: 1, page: 1, limit: 50, totalPages: 1 });

      const result = await controller.listProfiles('project-1');
      expect(result).toEqual(profiles);
    });
  });

  // ── Mappings ──────────────────────────────────────────────────────────

  describe('createMapping', () => {
    it('delegates to AgentsService.createMapping', async () => {
      const dto = { phaseId: 'phase-1', agentProfileId: 'profile-1' };
      const expected = { id: 'mapping-1', ...dto, projectId: 'project-1', priority: 0, createdAt: new Date() };
      agentsService.createMapping.mockResolvedValue(expected);

      const result = await controller.createMapping('project-1', dto);
      expect(result).toEqual(expected);
    });

    it('propagates BadRequestException for unsupported phase (Req 2.2)', async () => {
      agentsService.createMapping.mockRejectedValue(
        new BadRequestException('Agent profile does not support phase "In Test"'),
      );

      await expect(
        controller.createMapping('project-1', { phaseId: 'phase-test', agentProfileId: 'profile-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateMappings', () => {
    it('returns valid=true when all mappings are correct', async () => {
      agentsService.validateMappings.mockResolvedValue({ valid: true, issues: [] });

      const result = await controller.validateMappings('project-1');
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('returns issues when mappings are invalid', async () => {
      agentsService.validateMappings.mockResolvedValue({
        valid: false,
        issues: [{ phaseId: 'p1', phaseName: 'In Test', issue: 'no_mapping', message: 'No mapping' }],
      });

      const result = await controller.validateMappings('project-1');
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
    });
  });

  describe('seedDefaults', () => {
    it('seeds 4 default profiles', async () => {
      const result = await controller.seedDefaults('project-1');
      expect(result.seeded).toBe(4);
    });
  });
});
