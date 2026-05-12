import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CreateAgentProfileDto {
  name: string;
  role: string;
  description?: string;
  skillSet?: string[];
  supportedPhases?: string[];
  config?: Record<string, unknown>;
}

export interface CreateMappingDto {
  phaseId: string;
  agentProfileId: string;
  priority?: number;
}

const DEFAULT_PROFILES: Array<Omit<CreateAgentProfileDto, 'projectId'> & { role: string }> = [
  {
    name: 'BA Agent',
    role: 'BA_AGENT',
    description: 'Business analyst — gathers requirements, writes user stories, creates acceptance criteria.',
    skillSet: ['requirements-analysis', 'user-story-writing', 'acceptance-criteria', 'stakeholder-communication'],
    supportedPhases: ['Idea', 'Ready for Dev'],
  },
  {
    name: 'Dev Agent',
    role: 'DEV_AGENT',
    description: 'Software developer — writes code, creates PRs, resolves review comments.',
    skillSet: ['code-generation', 'code-review', 'refactoring', 'unit-testing'],
    supportedPhases: ['In Dev', 'In Review'],
  },
  {
    name: 'QA Agent',
    role: 'QA_AGENT',
    description: 'Quality assurance — creates test cases, executes test plans, files defect reports.',
    skillSet: ['test-case-design', 'test-execution', 'defect-reporting', 'regression-testing'],
    supportedPhases: ['In Test'],
  },
  {
    name: 'DevOps Agent',
    role: 'DEVOPS_AGENT',
    description: 'DevOps / release engineer — manages CI/CD, deployments, quality gates.',
    skillSet: ['ci-cd', 'deployment', 'quality-gates', 'infrastructure', 'monitoring'],
    supportedPhases: ['Ready for Release', 'In Production'],
  },
];

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Agent Profiles ────────────────────────────────────────────────────
  async seedDefaults(projectId: string) {
    const existing = await this.prisma.agentProfile.count({ where: { projectId } });
    if (existing > 0) return { seeded: 0 };

    for (const p of DEFAULT_PROFILES) {
      await this.prisma.agentProfile.create({
        data: {
          projectId,
          name: p.name,
          role: p.role,
          description: p.description,
          skillSet: p.skillSet ?? [],
          supportedPhases: p.supportedPhases ?? [],
          isDefault: true,
        },
      });
    }
    return { seeded: DEFAULT_PROFILES.length };
  }

  async createProfile(projectId: string, dto: CreateAgentProfileDto) {
    return this.prisma.agentProfile.create({
      data: {
        projectId,
        name: dto.name,
        role: dto.role,
        description: dto.description,
        skillSet: dto.skillSet ?? [],
        supportedPhases: dto.supportedPhases ?? [],
        config: dto.config ?? {},
      },
    });
  }

  async listProfiles(projectId: string) {
    return this.prisma.agentProfile.findMany({
      where: { OR: [{ projectId }, { projectId: null, isDefault: true }] },
      include: { _count: { select: { phaseMappings: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getProfile(id: string) {
    const profile = await this.prisma.agentProfile.findUnique({
      where: { id },
      include: { phaseMappings: true },
    });
    if (!profile) throw new NotFoundException('Agent profile not found');
    return profile;
  }

  async updateProfile(id: string, dto: Partial<CreateAgentProfileDto>) {
    await this.getProfile(id);
    return this.prisma.agentProfile.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.skillSet !== undefined ? { skillSet: dto.skillSet } : {}),
        ...(dto.supportedPhases !== undefined ? { supportedPhases: dto.supportedPhases } : {}),
        ...(dto.config !== undefined ? { config: dto.config } : {}),
      },
    });
  }

  async deleteProfile(id: string) {
    await this.getProfile(id);
    return this.prisma.agentProfile.delete({ where: { id } });
  }

  // ── Phase-to-Agent Mappings ───────────────────────────────────────────
  async createMapping(projectId: string, dto: CreateMappingDto) {
    // Validate that the profile supports this phase
    const profile = await this.getProfile(dto.agentProfileId);
    const phase = await this.prisma.workflowPhase.findUnique({ where: { id: dto.phaseId } });
    if (!phase) throw new NotFoundException('Workflow phase not found');

    return this.prisma.phaseAgentMapping.create({
      data: {
        projectId,
        phaseId: dto.phaseId,
        agentProfileId: dto.agentProfileId,
        priority: dto.priority ?? 0,
      },
      include: {
        agentProfile: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async listMappings(projectId: string) {
    return this.prisma.phaseAgentMapping.findMany({
      where: { projectId },
      include: {
        agentProfile: { select: { id: true, name: true, role: true, skillSet: true } },
      },
      orderBy: [{ phaseId: 'asc' }, { priority: 'asc' }],
    });
  }

  async deleteMapping(id: string) {
    return this.prisma.phaseAgentMapping.delete({ where: { id } });
  }

  async getMappingsByPhase(projectId: string, phaseId: string) {
    return this.prisma.phaseAgentMapping.findMany({
      where: { projectId, phaseId },
      include: {
        agentProfile: { select: { id: true, name: true, role: true, supportedPhases: true } },
      },
      orderBy: { priority: 'asc' },
    });
  }
}
