import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { stringify as yamlStringify } from 'yaml';

export interface WorkspaceStatus {
  agents: number;
  skills: number;
  pipelines: number;
  epicRuns: Record<string, number>;
  slashCommands: Array<{ name: string; description: string; action: string }>;
}

@Injectable()
export class WorkspaceConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get workspace config for a project, creating a default one if none exists.
   */
  async getConfig(projectId: string) {
    let config = await this.prisma.workspaceConfig.findUnique({
      where: { projectId },
    });

    if (!config) {
      config = await this.prisma.workspaceConfig.create({
        data: {
          projectId,
          slashCommands: [],
          metadata: {},
        },
      });
    }

    return config;
  }

  /**
   * Update workspace config (slash commands and metadata).
   */
  async updateConfig(projectId: string, dto: UpdateConfigDto) {
    // Ensure config exists first
    await this.getConfig(projectId);

    return this.prisma.workspaceConfig.update({
      where: { projectId },
      data: {
        ...(dto.slashCommands !== undefined && {
          slashCommands: dto.slashCommands as any,
        }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata as any }),
      },
    });
  }

  /**
   * Generate workspace.yaml content from database state.
   * Includes agents, skills, pipelines, and slash commands.
   */
  async generateYaml(projectId: string): Promise<string> {
    // Fetch all workspace entities
    const [project, agents, skills, pipelines, config] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.agentProfile.findMany({
        where: { projectId },
        include: {
          agentSkills: {
            include: { skill: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.skill.findMany({
        where: { projectId },
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.pipeline.findMany({
        where: { projectId },
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
            include: {
              agentProfile: { select: { name: true } },
            },
          },
        },
        orderBy: { displayOrder: 'asc' },
      }),
      this.getConfig(projectId),
    ]);

    const projectName = project?.name ?? 'unknown-project';

    // Build the YAML structure
    const yamlDoc: Record<string, unknown> = {
      version: '1.0',
      metadata: {
        project: projectName,
        generatedAt: new Date().toISOString(),
      },
      agents: agents.map((agent) => ({
        id: this.toSlug(agent.name),
        name: agent.name,
        model: 'claude',
        skills: agent.agentSkills.map((as) => as.skill.name),
      })),
      skills: skills.map((skill) => {
        const skillEntry: Record<string, unknown> = {
          name: skill.name,
          description: skill.description ?? '',
        };
        if (skill.inputs) {
          skillEntry.inputs = skill.inputs;
        }
        if (skill.outputs) {
          skillEntry.outputs = skill.outputs;
        }
        return skillEntry;
      }),
      pipelines: pipelines.map((pipeline) => ({
        name: pipeline.name,
        steps: pipeline.steps.map((step) => ({
          agent: this.toSlug(step.agentProfile.name),
          onFailure: step.onFailure,
        })),
      })),
      slashCommands: ((config.slashCommands as any[]) ?? []).map((cmd) => ({
        name: cmd.name,
        description: cmd.description,
        action: cmd.action,
      })),
    };

    const yamlContent = yamlStringify(yamlDoc, {
      lineWidth: 120,
      defaultStringType: 'QUOTE_DOUBLE',
      defaultKeyType: 'PLAIN',
    });

    // Cache the generated YAML in the config
    await this.prisma.workspaceConfig.update({
      where: { projectId },
      data: { yamlContent },
    });

    return yamlContent;
  }

  /**
   * Get workspace status: counts of agents, skills, pipelines,
   * and active epic runs grouped by status.
   */
  async getStatus(projectId: string): Promise<WorkspaceStatus> {
    const [agentCount, skillCount, pipelineCount, epicRunsByStatus, config] =
      await Promise.all([
        this.prisma.agentProfile.count({ where: { projectId } }),
        this.prisma.skill.count({ where: { projectId } }),
        this.prisma.pipeline.count({ where: { projectId } }),
        this.prisma.epicRun.groupBy({
          by: ['status'],
          where: { projectId },
          _count: { id: true },
        }),
        this.getConfig(projectId),
      ]);

    const epicRuns: Record<string, number> = {};
    for (const group of epicRunsByStatus) {
      epicRuns[group.status] = group._count.id;
    }

    const slashCommands = ((config.slashCommands as any[]) ?? []).map(
      (cmd: { name: string; description: string; action: string }) => ({
        name: cmd.name,
        description: cmd.description,
        action: cmd.action,
      }),
    );

    return {
      agents: agentCount,
      skills: skillCount,
      pipelines: pipelineCount,
      epicRuns,
      slashCommands,
    };
  }

  /**
   * Convert a display name to a kebab-case slug.
   */
  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  }
}
