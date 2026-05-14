import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { ReorderStepsDto } from './dto/reorder-steps.dto';

@Injectable()
export class PipelinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a new pipeline with steps for a project.
   * Validates: minimum 2 steps, unique name per project, valid on-failure values.
   */
  async create(projectId: string, dto: CreatePipelineDto) {
    // Validate minimum 2 steps
    if (!dto.steps || dto.steps.length < 2) {
      throw new BadRequestException({
        error: 'VALIDATION_ERROR',
        message: 'Pipeline must have at least 2 steps',
      });
    }

    // Validate on-failure values
    for (const step of dto.steps) {
      if (step.onFailure && !['stop', 'continue'].includes(step.onFailure)) {
        throw new BadRequestException({
          error: 'VALIDATION_ERROR',
          message: `Invalid onFailure value "${step.onFailure}". Must be "stop" or "continue"`,
        });
      }
    }

    // Check name uniqueness within the project
    const existing = await this.prisma.pipeline.findUnique({
      where: { projectId_name: { projectId, name: dto.name } },
    });
    if (existing) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: `A pipeline with name "${dto.name}" already exists in this project`,
      });
    }

    // Get the next display order
    const maxOrder = await this.prisma.pipeline.aggregate({
      where: { projectId },
      _max: { displayOrder: true },
    });
    const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    // Create pipeline with steps in a transaction
    const pipeline = await this.prisma.pipeline.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description ?? null,
        displayOrder,
        steps: {
          create: dto.steps.map((step, index) => ({
            agentProfileId: step.agentProfileId,
            stepOrder: index,
            onFailure: step.onFailure ?? 'stop',
          })),
        },
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    this.audit.log({
      action: 'CREATE_PHASE_MAPPING' as any,
      resource: `pipeline:${pipeline.id}`,
      details: { name: pipeline.name, projectId, stepCount: dto.steps.length },
    });

    return pipeline;
  }

  /**
   * Find all pipelines for a project with their steps, ordered by displayOrder.
   */
  async findAll(projectId: string) {
    return this.prisma.pipeline.findMany({
      where: { projectId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Find a pipeline by ID with steps, or throw NotFoundException.
   */
  async findById(id: string) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!pipeline) {
      throw new NotFoundException(`Pipeline with ID "${id}" not found`);
    }
    return pipeline;
  }

  /**
   * Update pipeline metadata (name, description).
   */
  async update(id: string, dto: UpdatePipelineDto) {
    // Ensure pipeline exists
    const existing = await this.findById(id);

    // If name is being changed, check uniqueness
    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.pipeline.findUnique({
        where: { projectId_name: { projectId: existing.projectId, name: dto.name } },
      });
      if (conflict) {
        throw new ConflictException({
          error: 'CONFLICT',
          message: `A pipeline with name "${dto.name}" already exists in this project`,
        });
      }
    }

    const pipeline = await this.prisma.pipeline.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    this.audit.log({
      action: 'UPDATE_AGENT_PROFILE' as any,
      resource: `pipeline:${pipeline.id}`,
      details: { name: pipeline.name, projectId: pipeline.projectId },
    });

    return pipeline;
  }

  /**
   * Reorder pipeline steps. Accepts new step order array.
   * Validates all step IDs belong to the pipeline.
   */
  async reorderSteps(id: string, dto: ReorderStepsDto) {
    const pipeline = await this.findById(id);

    const existingStepIds = new Set(pipeline.steps.map((s) => s.id));
    const providedStepIds = new Set(dto.stepIds);

    // Validate all provided step IDs belong to this pipeline
    for (const stepId of dto.stepIds) {
      if (!existingStepIds.has(stepId)) {
        throw new BadRequestException({
          error: 'VALIDATION_ERROR',
          message: `Step ID "${stepId}" does not belong to this pipeline`,
        });
      }
    }

    // Validate all existing steps are accounted for
    for (const stepId of existingStepIds) {
      if (!providedStepIds.has(stepId)) {
        throw new BadRequestException({
          error: 'VALIDATION_ERROR',
          message: `Step ID "${stepId}" is missing from the reorder list`,
        });
      }
    }

    // Update step orders in a transaction
    await this.prisma.$transaction(
      dto.stepIds.map((stepId, index) =>
        this.prisma.pipelineStep.update({
          where: { id: stepId },
          data: { stepOrder: index },
        }),
      ),
    );

    // Return updated pipeline
    return this.findById(id);
  }

  /**
   * Delete a pipeline. Blocks if active (non-terminal) EpicRuns reference it.
   */
  async delete(id: string) {
    const pipeline = await this.findById(id);

    // Check for active (non-terminal) epic runs referencing this pipeline
    const activeRunCount = await this.prisma.epicRun.count({
      where: {
        pipelineId: id,
        status: { in: ['pending', 'running', 'paused'] },
      },
    });

    if (activeRunCount > 0) {
      throw new ConflictException({
        error: 'CONFLICT',
        message: `Cannot delete pipeline "${pipeline.name}" because it has ${activeRunCount} active epic run(s)`,
      });
    }

    await this.prisma.pipeline.delete({ where: { id } });

    this.audit.log({
      action: 'DELETE_PHASE_MAPPING' as any,
      resource: `pipeline:${id}`,
      details: { name: pipeline.name, projectId: pipeline.projectId },
    });

    return { deleted: true };
  }
}
