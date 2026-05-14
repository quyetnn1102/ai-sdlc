import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';
import { SKILL_TEMPLATES, SkillTemplate } from './skill-templates';
import { parse as parseYaml } from 'yaml';

export interface SkillValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a new skill for a project.
   */
  async create(projectId: string, dto: CreateSkillDto) {
    // Validate skill markdown content
    const validation = this.validate(dto.content);
    if (!validation.valid) {
      throw new ConflictException({
        error: 'VALIDATION_ERROR',
        details: validation.errors.map((msg) => ({ field: 'content', message: msg })),
      });
    }

    // Check name uniqueness within the project
    const existing = await this.prisma.skill.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: `A skill with name "${dto.name}" already exists in this project`,
        suggestion: `${dto.name}-2`,
      });
    }

    // Get the next display order
    const maxOrder = await this.prisma.skill.aggregate({
      where: { projectId },
      _max: { displayOrder: true },
    });
    const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    const skill = await this.prisma.skill.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description ?? null,
        content: dto.content,
        inputs: dto.inputs ? (dto.inputs as any) : undefined,
        outputs: dto.outputs ? (dto.outputs as any) : undefined,
        metadata: dto.metadata ? (dto.metadata as any) : undefined,
        displayOrder,
      },
    });

    this.audit.log({
      action: 'CREATE_SKILL' as any,
      resource: `skill:${skill.id}`,
      details: { name: skill.name, projectId },
    });

    return skill;
  }

  /**
   * Find all skills for a project, ordered by displayOrder.
   */
  async findAll(projectId: string) {
    return this.prisma.skill.findMany({
      where: { projectId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Find a skill by ID or throw NotFoundException.
   */
  async findById(id: string) {
    const skill = await this.prisma.skill.findUnique({ where: { id } });
    if (!skill) {
      throw new NotFoundException(`Skill with ID "${id}" not found`);
    }
    return skill;
  }

  /**
   * Update a skill by ID.
   */
  async update(id: string, dto: UpdateSkillDto) {
    // Ensure skill exists
    const existing = await this.findById(id);

    // If content is being updated, validate it
    if (dto.content) {
      const validation = this.validate(dto.content);
      if (!validation.valid) {
        throw new ConflictException({
          error: 'VALIDATION_ERROR',
          details: validation.errors.map((msg) => ({ field: 'content', message: msg })),
        });
      }
    }

    // If name is being changed, check uniqueness
    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.skill.findUnique({
        where: { projectId_name: { projectId: existing.projectId, name: dto.name } },
      });
      if (conflict) {
        throw new ConflictException({
          error: 'CONFLICT',
          message: `A skill with name "${dto.name}" already exists in this project`,
          suggestion: `${dto.name}-2`,
        });
      }
    }

    const skill = await this.prisma.skill.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.inputs !== undefined && { inputs: dto.inputs as any }),
        ...(dto.outputs !== undefined && { outputs: dto.outputs as any }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata as any }),
      },
    });

    this.audit.log({
      action: 'UPDATE_SKILL' as any,
      resource: `skill:${skill.id}`,
      details: { name: skill.name, projectId: skill.projectId },
    });

    return skill;
  }

  /**
   * Delete a skill by ID. Cascade removes AgentSkill associations.
   */
  async delete(id: string) {
    // Ensure skill exists
    const skill = await this.findById(id);

    await this.prisma.skill.delete({ where: { id } });

    this.audit.log({
      action: 'DELETE_SKILL' as any,
      resource: `skill:${id}`,
      details: { name: skill.name, projectId: skill.projectId },
    });

    return { deleted: true };
  }

  /**
   * Validate skill markdown content.
   * Checks for valid YAML frontmatter with required fields and a prompt template section.
   */
  validate(content: string): SkillValidationResult {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push('Skill content cannot be empty');
      return { valid: false, errors };
    }

    // Check for YAML frontmatter delimiters
    const trimmed = content.trim();
    if (!trimmed.startsWith('---')) {
      errors.push('Skill content must start with YAML frontmatter (--- delimiter)');
      return { valid: false, errors };
    }

    // Find the closing frontmatter delimiter
    const closingIndex = trimmed.indexOf('---', 3);
    if (closingIndex === -1) {
      errors.push('YAML frontmatter must have a closing --- delimiter');
      return { valid: false, errors };
    }

    // Extract and parse YAML frontmatter
    const yamlContent = trimmed.substring(3, closingIndex).trim();
    let frontmatter: Record<string, unknown>;
    try {
      frontmatter = parseYaml(yamlContent);
    } catch (e) {
      errors.push(`Invalid YAML in frontmatter: ${(e as Error).message}`);
      return { valid: false, errors };
    }

    if (!frontmatter || typeof frontmatter !== 'object') {
      errors.push('YAML frontmatter must be a valid object');
      return { valid: false, errors };
    }

    // Check required fields
    if (!frontmatter.name || typeof frontmatter.name !== 'string') {
      errors.push('YAML frontmatter must contain a "name" field (string)');
    }

    if (!frontmatter.description || typeof frontmatter.description !== 'string') {
      errors.push('YAML frontmatter must contain a "description" field (string)');
    }

    // Check that content after frontmatter contains a prompt template section
    const bodyContent = trimmed.substring(closingIndex + 3).trim();
    if (!bodyContent || bodyContent.length === 0) {
      errors.push('Skill must contain a prompt template section after the frontmatter');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * List the 5 starter skill templates.
   */
  listTemplates(): SkillTemplate[] {
    return SKILL_TEMPLATES;
  }
}
