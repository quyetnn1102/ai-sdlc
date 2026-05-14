import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';

export interface TemplateContent {
  agents: Array<{
    name: string;
    role: string;
    description: string;
    skillSet: string[];
    supportedPhases: string[];
  }>;
  skills: Array<{
    name: string;
    description?: string;
    content: string;
    inputs?: unknown;
    outputs?: unknown;
    metadata?: unknown;
  }>;
  pipelines: Array<{
    name: string;
    description?: string;
    steps: Array<{
      agentName: string;
      onFailure: string;
    }>;
  }>;
  slashCommands: Array<{
    name: string;
    description: string;
    action: string;
  }>;
}

const BUILT_IN_TEMPLATES: Array<{
  name: string;
  description: string;
  content: TemplateContent;
}> = [
  {
    name: 'code-review',
    description: 'Code review pipeline with a dedicated reviewer agent',
    content: {
      agents: [
        {
          name: 'Code Reviewer',
          role: 'Dev',
          description: 'Reviews code for quality, security, and best practices',
          skillSet: ['code-review', 'security-analysis'],
          supportedPhases: ['development', 'review'],
        },
        {
          name: 'QA Validator',
          role: 'QA',
          description: 'Validates code changes against test criteria',
          skillSet: ['test-execution', 'regression-check'],
          supportedPhases: ['testing'],
        },
      ],
      skills: [
        {
          name: 'code-review',
          description: 'Reviews code for quality and best practices',
          content: '---\nname: code-review\ndescription: Reviews code for quality and best practices\n---\n\n## Prompt Template\n\nReview the provided code for quality, security, and best practices.',
        },
        {
          name: 'security-analysis',
          description: 'Analyzes code for security vulnerabilities',
          content: '---\nname: security-analysis\ndescription: Analyzes code for security vulnerabilities\n---\n\n## Prompt Template\n\nAnalyze the provided code for security vulnerabilities and suggest fixes.',
        },
      ],
      pipelines: [
        {
          name: 'Code Review Pipeline',
          description: 'Automated code review workflow',
          steps: [
            { agentName: 'Code Reviewer', onFailure: 'stop' },
            { agentName: 'QA Validator', onFailure: 'stop' },
          ],
        },
      ],
      slashCommands: [
        { name: '/review', description: 'Start a code review', action: 'pipeline:run' },
      ],
    },
  },
  {
    name: 'release-notes',
    description: 'Release notes generation pipeline',
    content: {
      agents: [
        {
          name: 'Release Notes Writer',
          role: 'BA',
          description: 'Generates release notes from commit history and work items',
          skillSet: ['release-notes-generation', 'changelog-formatting'],
          supportedPhases: ['release'],
        },
        {
          name: 'Release Reviewer',
          role: 'Dev',
          description: 'Reviews and polishes release notes for accuracy',
          skillSet: ['content-review', 'technical-writing'],
          supportedPhases: ['release', 'review'],
        },
      ],
      skills: [
        {
          name: 'release-notes-generation',
          description: 'Generates release notes from project history',
          content: '---\nname: release-notes-generation\ndescription: Generates release notes from project history\n---\n\n## Prompt Template\n\nGenerate release notes from the provided commit history and work items.',
        },
        {
          name: 'changelog-formatting',
          description: 'Formats changelogs in standard format',
          content: '---\nname: changelog-formatting\ndescription: Formats changelogs in standard format\n---\n\n## Prompt Template\n\nFormat the provided changes into a standard changelog format.',
        },
      ],
      pipelines: [
        {
          name: 'Release Notes Pipeline',
          description: 'Automated release notes generation',
          steps: [
            { agentName: 'Release Notes Writer', onFailure: 'stop' },
            { agentName: 'Release Reviewer', onFailure: 'continue' },
          ],
        },
      ],
      slashCommands: [
        { name: '/release-notes', description: 'Generate release notes', action: 'pipeline:run' },
      ],
    },
  },
  {
    name: 'sdlc',
    description: 'Full SDLC pipeline with BA, Dev, QA, and DevOps agents',
    content: {
      agents: [
        {
          name: 'BA Agent',
          role: 'BA',
          description: 'Analyzes requirements and produces user stories',
          skillSet: ['requirements-analysis', 'user-story-writing'],
          supportedPhases: ['requirements', 'analysis'],
        },
        {
          name: 'Dev Agent',
          role: 'Dev',
          description: 'Implements features based on specifications',
          skillSet: ['code-generation', 'refactoring'],
          supportedPhases: ['development', 'implementation'],
        },
        {
          name: 'QA Agent',
          role: 'QA',
          description: 'Tests implementations and reports defects',
          skillSet: ['test-execution', 'bug-reporting'],
          supportedPhases: ['testing', 'verification'],
        },
        {
          name: 'DevOps Agent',
          role: 'DevOps',
          description: 'Handles deployment and infrastructure automation',
          skillSet: ['deployment-automation', 'infrastructure-management'],
          supportedPhases: ['deployment', 'operations'],
        },
      ],
      skills: [
        {
          name: 'requirements-analysis',
          description: 'Analyzes requirements and produces structured output',
          content: '---\nname: requirements-analysis\ndescription: Analyzes requirements and produces structured output\n---\n\n## Prompt Template\n\nAnalyze the provided requirements and produce structured user stories.',
        },
        {
          name: 'code-generation',
          description: 'Generates code from specifications',
          content: '---\nname: code-generation\ndescription: Generates code from specifications\n---\n\n## Prompt Template\n\nGenerate implementation code based on the provided specification.',
        },
        {
          name: 'test-execution',
          description: 'Executes tests and reports results',
          content: '---\nname: test-execution\ndescription: Executes tests and reports results\n---\n\n## Prompt Template\n\nExecute tests against the provided implementation and report results.',
        },
        {
          name: 'deployment-automation',
          description: 'Automates deployment processes',
          content: '---\nname: deployment-automation\ndescription: Automates deployment processes\n---\n\n## Prompt Template\n\nAutomate the deployment of the provided artifacts to the target environment.',
        },
      ],
      pipelines: [
        {
          name: 'SDLC Pipeline',
          description: 'Full software development lifecycle pipeline',
          steps: [
            { agentName: 'BA Agent', onFailure: 'stop' },
            { agentName: 'Dev Agent', onFailure: 'stop' },
            { agentName: 'QA Agent', onFailure: 'stop' },
            { agentName: 'DevOps Agent', onFailure: 'stop' },
          ],
        },
      ],
      slashCommands: [
        { name: '/run-pipeline', description: 'Execute the SDLC pipeline on an epic', action: 'epic-run:create' },
        { name: '/inspect', description: 'Run workspace inspector', action: 'workspace:inspect' },
        { name: '/status', description: 'Show workspace status', action: 'workspace:status' },
      ],
    },
  },
];

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all templates (built-in + custom) for an organization.
   */
  async findAll(organizationId: string) {
    return this.prisma.workspaceTemplate.findMany({
      where: { organizationId },
      orderBy: [{ isBuiltIn: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Returns a template by ID or throws NotFoundException.
   */
  async findById(id: string) {
    const template = await this.prisma.workspaceTemplate.findUnique({
      where: { id },
    });
    if (!template) {
      throw new NotFoundException(`Template with ID "${id}" not found`);
    }
    return template;
  }

  /**
   * Snapshots the current workspace (agents, skills, pipelines, slash commands)
   * and saves as a named template.
   */
  async saveAsTemplate(
    organizationId: string,
    projectId: string,
    dto: CreateTemplateDto,
  ) {
    // Check name uniqueness within the organization
    const existing = await this.prisma.workspaceTemplate.findUnique({
      where: { organizationId_name: { organizationId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: `A template with name "${dto.name}" already exists in this organization`,
      });
    }

    // Snapshot the current workspace state
    const [agents, skills, pipelines, config] = await Promise.all([
      this.prisma.agentProfile.findMany({
        where: { projectId },
        include: {
          agentSkills: { include: { skill: { select: { name: true } } } },
        },
      }),
      this.prisma.skill.findMany({ where: { projectId } }),
      this.prisma.pipeline.findMany({
        where: { projectId },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: { agentProfile: { select: { name: true } } },
          },
        },
      }),
      this.prisma.workspaceConfig.findUnique({ where: { projectId } }),
    ]);

    const content: TemplateContent = {
      agents: agents.map((agent) => ({
        name: agent.name,
        role: agent.role,
        description: agent.description,
        skillSet: agent.skillSet,
        supportedPhases: agent.supportedPhases,
      })),
      skills: skills.map((skill) => ({
        name: skill.name,
        description: skill.description ?? undefined,
        content: skill.content,
        inputs: skill.inputs ?? undefined,
        outputs: skill.outputs ?? undefined,
        metadata: skill.metadata ?? undefined,
      })),
      pipelines: pipelines.map((pipeline) => ({
        name: pipeline.name,
        description: pipeline.description ?? undefined,
        steps: pipeline.steps.map((step) => ({
          agentName: step.agentProfile.name,
          onFailure: step.onFailure,
        })),
      })),
      slashCommands: ((config?.slashCommands as any[]) ?? []).map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        action: cmd.action,
      })),
    };

    const template = await this.prisma.workspaceTemplate.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description ?? null,
        isBuiltIn: false,
        content: content as any,
      },
    });

    return template;
  }

  /**
   * Applies a template to a project, handling conflicts by name.
   * conflictResolution: 'skip' | 'rename' | 'overwrite'
   */
  async applyTemplate(
    templateId: string,
    projectId: string,
    conflictResolution: 'skip' | 'rename' | 'overwrite',
  ) {
    const template = await this.findById(templateId);
    const content = template.content as unknown as TemplateContent;

    const createdEntities = {
      agents: [] as string[],
      skills: [] as string[],
      pipelines: [] as string[],
    };

    await this.prisma.$transaction(async (tx) => {
      // 1. Apply skills
      for (const skillDef of content.skills) {
        const existingSkill = await tx.skill.findUnique({
          where: { projectId_name: { projectId, name: skillDef.name } },
        });

        if (existingSkill) {
          if (conflictResolution === 'skip') {
            continue;
          } else if (conflictResolution === 'overwrite') {
            await tx.skill.update({
              where: { id: existingSkill.id },
              data: {
                description: skillDef.description ?? null,
                content: skillDef.content,
                inputs: skillDef.inputs ? (skillDef.inputs as any) : undefined,
                outputs: skillDef.outputs ? (skillDef.outputs as any) : undefined,
                metadata: skillDef.metadata ? (skillDef.metadata as any) : undefined,
              },
            });
            createdEntities.skills.push(existingSkill.id);
          } else if (conflictResolution === 'rename') {
            const newName = await this.generateUniqueName(
              tx,
              'skill',
              projectId,
              skillDef.name,
            );
            const skill = await tx.skill.create({
              data: {
                projectId,
                name: newName,
                description: skillDef.description ?? null,
                content: skillDef.content,
                inputs: skillDef.inputs ? (skillDef.inputs as any) : undefined,
                outputs: skillDef.outputs ? (skillDef.outputs as any) : undefined,
                metadata: skillDef.metadata ? (skillDef.metadata as any) : undefined,
              },
            });
            createdEntities.skills.push(skill.id);
          }
        } else {
          const skill = await tx.skill.create({
            data: {
              projectId,
              name: skillDef.name,
              description: skillDef.description ?? null,
              content: skillDef.content,
              inputs: skillDef.inputs ? (skillDef.inputs as any) : undefined,
              outputs: skillDef.outputs ? (skillDef.outputs as any) : undefined,
              metadata: skillDef.metadata ? (skillDef.metadata as any) : undefined,
            },
          });
          createdEntities.skills.push(skill.id);
        }
      }

      // 2. Apply agents
      const agentNameToId: Record<string, string> = {};
      for (const agentDef of content.agents) {
        const existingAgent = await tx.agentProfile.findFirst({
          where: { projectId, name: agentDef.name },
        });

        if (existingAgent) {
          if (conflictResolution === 'skip') {
            agentNameToId[agentDef.name] = existingAgent.id;
            continue;
          } else if (conflictResolution === 'overwrite') {
            await tx.agentProfile.update({
              where: { id: existingAgent.id },
              data: {
                role: agentDef.role as any,
                description: agentDef.description,
                skillSet: agentDef.skillSet,
                supportedPhases: agentDef.supportedPhases,
              },
            });
            agentNameToId[agentDef.name] = existingAgent.id;
            createdEntities.agents.push(existingAgent.id);
          } else if (conflictResolution === 'rename') {
            const newName = await this.generateUniqueAgentName(
              tx,
              projectId,
              agentDef.name,
            );
            const agent = await tx.agentProfile.create({
              data: {
                projectId,
                name: newName,
                role: agentDef.role as any,
                description: agentDef.description,
                skillSet: agentDef.skillSet,
                supportedPhases: agentDef.supportedPhases,
              },
            });
            agentNameToId[agentDef.name] = agent.id;
            createdEntities.agents.push(agent.id);
          }
        } else {
          const agent = await tx.agentProfile.create({
            data: {
              projectId,
              name: agentDef.name,
              role: agentDef.role as any,
              description: agentDef.description,
              skillSet: agentDef.skillSet,
              supportedPhases: agentDef.supportedPhases,
            },
          });
          agentNameToId[agentDef.name] = agent.id;
          createdEntities.agents.push(agent.id);
        }
      }

      // 3. Apply pipelines
      for (const pipelineDef of content.pipelines) {
        const existingPipeline = await tx.pipeline.findUnique({
          where: { projectId_name: { projectId, name: pipelineDef.name } },
        });

        if (existingPipeline) {
          if (conflictResolution === 'skip') {
            continue;
          } else if (conflictResolution === 'overwrite') {
            // Delete existing steps and recreate
            await tx.pipelineStep.deleteMany({
              where: { pipelineId: existingPipeline.id },
            });
            await tx.pipeline.update({
              where: { id: existingPipeline.id },
              data: { description: pipelineDef.description ?? null },
            });
            for (let i = 0; i < pipelineDef.steps.length; i++) {
              const stepDef = pipelineDef.steps[i];
              const agentId = agentNameToId[stepDef.agentName];
              if (agentId) {
                await tx.pipelineStep.create({
                  data: {
                    pipelineId: existingPipeline.id,
                    agentProfileId: agentId,
                    stepOrder: i,
                    onFailure: stepDef.onFailure,
                  },
                });
              }
            }
            createdEntities.pipelines.push(existingPipeline.id);
          } else if (conflictResolution === 'rename') {
            const newName = await this.generateUniquePipelineName(
              tx,
              projectId,
              pipelineDef.name,
            );
            const pipeline = await tx.pipeline.create({
              data: {
                projectId,
                name: newName,
                description: pipelineDef.description ?? null,
              },
            });
            for (let i = 0; i < pipelineDef.steps.length; i++) {
              const stepDef = pipelineDef.steps[i];
              const agentId = agentNameToId[stepDef.agentName];
              if (agentId) {
                await tx.pipelineStep.create({
                  data: {
                    pipelineId: pipeline.id,
                    agentProfileId: agentId,
                    stepOrder: i,
                    onFailure: stepDef.onFailure,
                  },
                });
              }
            }
            createdEntities.pipelines.push(pipeline.id);
          }
        } else {
          const pipeline = await tx.pipeline.create({
            data: {
              projectId,
              name: pipelineDef.name,
              description: pipelineDef.description ?? null,
            },
          });
          for (let i = 0; i < pipelineDef.steps.length; i++) {
            const stepDef = pipelineDef.steps[i];
            const agentId = agentNameToId[stepDef.agentName];
            if (agentId) {
              await tx.pipelineStep.create({
                data: {
                  pipelineId: pipeline.id,
                  agentProfileId: agentId,
                  stepOrder: i,
                  onFailure: stepDef.onFailure,
                },
              });
            }
          }
          createdEntities.pipelines.push(pipeline.id);
        }
      }

      // 4. Apply slash commands to workspace config
      if (content.slashCommands && content.slashCommands.length > 0) {
        const existingConfig = await tx.workspaceConfig.findUnique({
          where: { projectId },
        });

        if (existingConfig) {
          const existingCommands = (existingConfig.slashCommands as any[]) ?? [];
          const mergedCommands = [...existingCommands];
          for (const cmd of content.slashCommands) {
            const exists = mergedCommands.some((c) => c.name === cmd.name);
            if (!exists) {
              mergedCommands.push(cmd);
            }
          }
          await tx.workspaceConfig.update({
            where: { projectId },
            data: { slashCommands: mergedCommands as any },
          });
        } else {
          await tx.workspaceConfig.create({
            data: {
              projectId,
              slashCommands: content.slashCommands as any,
              metadata: {},
            },
          });
        }
      }
    });

    return createdEntities;
  }

  /**
   * Deletes a custom template. Blocks deletion of built-in templates.
   */
  async delete(id: string) {
    const template = await this.findById(id);

    if (template.isBuiltIn) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Cannot delete built-in templates',
      });
    }

    await this.prisma.workspaceTemplate.delete({ where: { id } });

    return { deleted: true };
  }

  /**
   * Creates the 3 built-in templates if they don't already exist for the organization.
   */
  async seedBuiltIns(organizationId: string) {
    for (const builtIn of BUILT_IN_TEMPLATES) {
      const existing = await this.prisma.workspaceTemplate.findUnique({
        where: { organizationId_name: { organizationId, name: builtIn.name } },
      });

      if (!existing) {
        await this.prisma.workspaceTemplate.create({
          data: {
            organizationId,
            name: builtIn.name,
            description: builtIn.description,
            isBuiltIn: true,
            content: builtIn.content as any,
          },
        });
      }
    }
  }

  /**
   * Generate a unique skill name by appending a numeric suffix.
   */
  private async generateUniqueName(
    tx: any,
    _entityType: string,
    projectId: string,
    baseName: string,
  ): Promise<string> {
    let suffix = 2;
    let candidateName = `${baseName}-${suffix}`;
    while (true) {
      const existing = await tx.skill.findUnique({
        where: { projectId_name: { projectId, name: candidateName } },
      });
      if (!existing) return candidateName;
      suffix++;
      candidateName = `${baseName}-${suffix}`;
    }
  }

  /**
   * Generate a unique agent name by appending a numeric suffix.
   */
  private async generateUniqueAgentName(
    tx: any,
    projectId: string,
    baseName: string,
  ): Promise<string> {
    let suffix = 2;
    let candidateName = `${baseName}-${suffix}`;
    while (true) {
      const existing = await tx.agentProfile.findFirst({
        where: { projectId, name: candidateName },
      });
      if (!existing) return candidateName;
      suffix++;
      candidateName = `${baseName}-${suffix}`;
    }
  }

  /**
   * Generate a unique pipeline name by appending a numeric suffix.
   */
  private async generateUniquePipelineName(
    tx: any,
    projectId: string,
    baseName: string,
  ): Promise<string> {
    let suffix = 2;
    let candidateName = `${baseName}-${suffix}`;
    while (true) {
      const existing = await tx.pipeline.findUnique({
        where: { projectId_name: { projectId, name: candidateName } },
      });
      if (!existing) return candidateName;
      suffix++;
      candidateName = `${baseName}-${suffix}`;
    }
  }
}
