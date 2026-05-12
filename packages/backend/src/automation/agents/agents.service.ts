import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';

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

export interface ValidationIssue {
  phaseId: string;
  phaseName: string;
  agentProfileId?: string;
  issue: 'no_mapping' | 'phase_not_supported' | 'invalid_profile';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

const DEFAULT_PROFILES = [
  {
    name: 'BA Agent',
    role: 'BA_AGENT',
    description:
      'Business analyst — gathers requirements, writes user stories, creates acceptance criteria.',
    skillSet: [
      'requirements-analysis',
      'user-story-writing',
      'acceptance-criteria',
      'stakeholder-communication',
    ],
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
    description:
      'Quality assurance — creates test cases, executes test plans, files defect reports.',
    skillSet: [
      'test-case-design',
      'test-execution',
      'defect-reporting',
      'regression-testing',
    ],
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
          skillSet: p.skillSet,
          supportedPhases: p.supportedPhases,
          isDefault: true,
        },
      });
    }
    return { seeded: DEFAULT_PROFILES.length };
  }

  async createProfile(projectId: string, dto: CreateAgentProfileDto) {
    // Req 1.2 — must have at least one skill and one supported phase
    if (!dto.skillSet?.length) {
      throw new BadRequestException('Agent profile must have at least one skill');
    }
    if (!dto.supportedPhases?.length) {
      throw new BadRequestException('Agent profile must support at least one SDLC phase');
    }

    const profile = await this.prisma.agentProfile.create({
      data: {
        projectId,
        name: dto.name,
        role: dto.role,
        description: dto.description,
        skillSet: dto.skillSet,
        supportedPhases: dto.supportedPhases,
        config: (dto.config ?? {}) as any,
      },
    });
    this.audit.log({
      action: 'CREATE_AGENT_PROFILE',
      resource: `agent_profile:${profile.id}`,
      details: { name: profile.name, role: profile.role, projectId },
    });
    return profile;
  }

  async listProfiles(projectId: string, query: { page?: number; limit?: number } = {}) {
    const page  = Math.max(1, query.page  ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip  = (page - 1) * limit;

    const where = { OR: [{ projectId }, { projectId: null, isDefault: true }] };
    const [data, total] = await Promise.all([
      this.prisma.agentProfile.findMany({
        where,
        include: { _count: { select: { phaseMappings: true } } },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.agentProfile.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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

    // Req 1.3 — reject update if a running execution references this profile
    const runningUsage = await this.prisma.workflowTask.findFirst({
      where: {
        agentProfileId: id,
        execution: { status: 'RUNNING' },
      },
    });
    if (runningUsage) {
      throw new ConflictException(
        'Cannot update agent profile while it is referenced by a running workflow execution',
      );
    }

    if (dto.skillSet !== undefined && dto.skillSet.length === 0) {
      throw new BadRequestException('Agent profile must have at least one skill');
    }
    if (dto.supportedPhases !== undefined && dto.supportedPhases.length === 0) {
      throw new BadRequestException('Agent profile must support at least one SDLC phase');
    }

    const updated = await this.prisma.agentProfile.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.skillSet !== undefined ? { skillSet: dto.skillSet } : {}),
        ...(dto.supportedPhases !== undefined ? { supportedPhases: dto.supportedPhases } : {}),
        ...(dto.config !== undefined ? { config: dto.config as any } : {}),
      } as any,
    });
    this.audit.log({
      action: 'UPDATE_AGENT_PROFILE',
      resource: `agent_profile:${id}`,
      details: dto as Record<string, unknown>,
    });
    return updated;
  }

  async deleteProfile(id: string) {
    await this.getProfile(id);

    // Req 1.5 — reject delete if referenced by any mapping
    const mappingCount = await this.prisma.phaseAgentMapping.count({
      where: { agentProfileId: id },
    });
    if (mappingCount > 0) {
      throw new ConflictException(
        `Cannot delete agent profile: it is referenced by ${mappingCount} phase-agent mapping(s). Remove the mappings first.`,
      );
    }

    const deleted = await this.prisma.agentProfile.delete({ where: { id } });
    this.audit.log({
      action: 'DELETE_AGENT_PROFILE',
      resource: `agent_profile:${id}`,
    });
    return deleted;
  }

  // ── Phase-to-Agent Mappings ───────────────────────────────────────────

  async createMapping(projectId: string, dto: CreateMappingDto) {
    const profile = await this.getProfile(dto.agentProfileId);
    const phase = await this.prisma.workflowPhase.findUnique({ where: { id: dto.phaseId } });
    if (!phase) throw new NotFoundException('Workflow phase not found');

    // Req 2.2 — validate the profile supports this phase
    if (
      profile.supportedPhases.length > 0 &&
      !profile.supportedPhases.includes(phase.name)
    ) {
      throw new BadRequestException(
        `Agent profile "${profile.name}" does not support phase "${phase.name}". ` +
          `Supported phases: ${profile.supportedPhases.join(', ')}`,
      );
    }

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
        agentProfile: {
          select: { id: true, name: true, role: true, supportedPhases: true },
        },
      },
      orderBy: { priority: 'asc' },
    });
  }

  // ── Req 2.3 / 2.4 — Validate all mappings for a project ──────────────

  async validateMappings(projectId: string): Promise<ValidationResult> {
    const [phases, mappings] = await Promise.all([
      this.prisma.workflowPhase.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.phaseAgentMapping.findMany({
        where: { projectId },
        include: {
          agentProfile: {
            select: { id: true, name: true, supportedPhases: true },
          },
        },
      }),
    ]);

    const issues: ValidationIssue[] = [];

    for (const phase of phases) {
      const phaseMappings = mappings.filter((m) => m.phaseId === phase.id);

      // Req 2.4 — warn if no mapping for a phase
      if (phaseMappings.length === 0) {
        issues.push({
          phaseId: phase.id,
          phaseName: phase.name,
          issue: 'no_mapping',
          message: `Phase "${phase.name}" has no agent mapping configured`,
        });
        continue;
      }

      // Req 2.2 — check each mapping's agent supports the phase
      for (const mapping of phaseMappings) {
        const { agentProfile } = mapping;
        if (
          agentProfile.supportedPhases.length > 0 &&
          !agentProfile.supportedPhases.includes(phase.name)
        ) {
          issues.push({
            phaseId: phase.id,
            phaseName: phase.name,
            agentProfileId: agentProfile.id,
            issue: 'phase_not_supported',
            message: `Agent "${agentProfile.name}" does not support phase "${phase.name}"`,
          });
        }
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
