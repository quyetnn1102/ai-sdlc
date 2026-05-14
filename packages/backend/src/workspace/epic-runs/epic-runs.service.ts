import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateEpicRunDto } from './dto/create-epic-run.dto';
import { RejectStepDto } from './dto/reject-step.dto';
import { RerunStepDto } from './dto/rerun-step.dto';

@Injectable()
export class EpicRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create a new epic run binding a pipeline to a work item.
   * Creates EpicRunStep instances from the pipeline's steps.
   * Sets status to "running" and starts the first step.
   */
  async create(projectId: string, dto: CreateEpicRunDto) {
    // Verify pipeline exists and belongs to the project
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: dto.pipelineId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!pipeline) {
      throw new NotFoundException(`Pipeline with ID "${dto.pipelineId}" not found`);
    }

    if (pipeline.projectId !== projectId) {
      throw new BadRequestException(
        `Pipeline "${dto.pipelineId}" does not belong to this project`,
      );
    }

    // Verify work item exists
    const workItem = await this.prisma.workItem.findUnique({
      where: { id: dto.workItemId },
    });

    if (!workItem) {
      throw new NotFoundException(`Work item with ID "${dto.workItemId}" not found`);
    }

    // Create epic run with steps in a transaction
    const epicRun = await this.prisma.$transaction(async (tx) => {
      const run = await tx.epicRun.create({
        data: {
          projectId,
          pipelineId: dto.pipelineId,
          workItemId: dto.workItemId,
          status: 'running',
          currentStep: 0,
          startedAt: new Date(),
          initiatedBy: 'system', // TODO: replace with actual user from request context
        },
      });

      // Create step instances from pipeline steps
      for (const pipelineStep of pipeline.steps) {
        await tx.epicRunStep.create({
          data: {
            epicRunId: run.id,
            pipelineStepId: pipelineStep.id,
            agentProfileId: pipelineStep.agentProfileId,
            stepOrder: pipelineStep.stepOrder,
            status: pipelineStep.stepOrder === 0 ? 'running' : 'pending',
            startedAt: pipelineStep.stepOrder === 0 ? new Date() : null,
          },
        });
      }

      // Record history for run start
      await tx.epicRunHistory.create({
        data: {
          epicRunId: run.id,
          stepOrder: 0,
          action: 'started',
          actor: 'system',
          details: { pipelineId: dto.pipelineId, workItemId: dto.workItemId },
        },
      });

      return run;
    });

    this.audit.log({
      action: 'START_WORKFLOW_EXECUTION' as any,
      resource: `epic-run:${epicRun.id}`,
      details: { projectId, pipelineId: dto.pipelineId, workItemId: dto.workItemId },
    });

    // Return the full epic run with steps
    return this.prisma.epicRun.findUnique({
      where: { id: epicRun.id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });
  }

  /**
   * Find all epic runs for a project with optional status filter.
   */
  async findAll(projectId: string, statusFilter?: string) {
    const where: any = { projectId };
    if (statusFilter) {
      where.status = statusFilter;
    }

    return this.prisma.epicRun.findMany({
      where,
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find an epic run by ID with steps, or throw NotFoundException.
   */
  async findById(id: string) {
    const epicRun = await this.prisma.epicRun.findUnique({
      where: { id },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    });

    if (!epicRun) {
      throw new NotFoundException(`Epic run with ID "${id}" not found`);
    }

    return epicRun;
  }

  /**
   * Approve a completed step.
   * Validates step is in "completed" status, transitions to "approved",
   * advances currentStep, and starts the next step.
   * If last step, marks run as "completed".
   */
  async approveStep(id: string, stepId: string) {
    const epicRun = await this.findById(id);

    const step = epicRun.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundException(
        `Step with ID "${stepId}" not found in epic run "${id}"`,
      );
    }

    if (step.status !== 'completed') {
      throw new BadRequestException(
        `Step can only be approved when status is "completed". Current status: "${step.status}"`,
      );
    }

    const isLastStep = step.stepOrder === epicRun.steps.length - 1;

    await this.prisma.$transaction(async (tx) => {
      // Mark step as approved
      await tx.epicRunStep.update({
        where: { id: stepId },
        data: { status: 'approved', approvedAt: new Date() },
      });

      if (isLastStep) {
        // Mark run as completed
        await tx.epicRun.update({
          where: { id },
          data: { status: 'completed', completedAt: new Date() },
        });
      } else {
        // Advance to next step
        const nextStepOrder = step.stepOrder + 1;
        await tx.epicRun.update({
          where: { id },
          data: { currentStep: nextStepOrder },
        });

        // Start next step
        await tx.epicRunStep.update({
          where: { epicRunId_stepOrder: { epicRunId: id, stepOrder: nextStepOrder } },
          data: { status: 'running', startedAt: new Date() },
        });

        // Record history for next step start
        await tx.epicRunHistory.create({
          data: {
            epicRunId: id,
            stepOrder: nextStepOrder,
            action: 'started',
            actor: 'system',
          },
        });
      }

      // Record history for approval
      await tx.epicRunHistory.create({
        data: {
          epicRunId: id,
          stepOrder: step.stepOrder,
          action: 'approved',
          actor: 'system',
        },
      });
    });

    return this.findById(id);
  }

  /**
   * Reject a completed step with feedback.
   * Validates step is in "completed" status, transitions to "rejected" with feedback,
   * and resets all downstream steps to "pending" status.
   */
  async rejectStep(id: string, stepId: string, dto: RejectStepDto) {
    const epicRun = await this.findById(id);

    const step = epicRun.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundException(
        `Step with ID "${stepId}" not found in epic run "${id}"`,
      );
    }

    if (step.status !== 'completed') {
      throw new BadRequestException(
        `Step can only be rejected when status is "completed". Current status: "${step.status}"`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Mark step as rejected with feedback
      await tx.epicRunStep.update({
        where: { id: stepId },
        data: {
          status: 'rejected',
          feedback: dto.feedback,
          rejectedAt: new Date(),
        },
      });

      // Reset all downstream steps to "pending"
      const downstreamSteps = epicRun.steps.filter(
        (s) => s.stepOrder > step.stepOrder,
      );
      for (const downstream of downstreamSteps) {
        await tx.epicRunStep.update({
          where: { id: downstream.id },
          data: {
            status: 'pending',
            startedAt: null,
            completedAt: null,
            approvedAt: null,
            rejectedAt: null,
            output: null,
            feedback: null,
            context: null,
          },
        });
      }

      // Record history for rejection
      await tx.epicRunHistory.create({
        data: {
          epicRunId: id,
          stepOrder: step.stepOrder,
          action: 'rejected',
          actor: 'system',
          details: { feedback: dto.feedback },
        },
      });
    });

    return this.findById(id);
  }

  /**
   * Rerun a rejected step with rejection feedback + optional new context.
   * Validates step is in "rejected" status.
   */
  async rerunStep(id: string, stepId: string, dto: RerunStepDto) {
    const epicRun = await this.findById(id);

    const step = epicRun.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundException(
        `Step with ID "${stepId}" not found in epic run "${id}"`,
      );
    }

    if (step.status !== 'rejected') {
      throw new BadRequestException(
        `Step can only be rerun when status is "rejected". Current status: "${step.status}"`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Re-execute step: set to running with context composed from feedback + optional new context
      await tx.epicRunStep.update({
        where: { id: stepId },
        data: {
          status: 'running',
          startedAt: new Date(),
          completedAt: null,
          approvedAt: null,
          rejectedAt: null,
          context: dto.context ?? null,
          // Keep feedback from rejection for reference
        },
      });

      // Update epic run current step to this step's order
      await tx.epicRun.update({
        where: { id },
        data: { currentStep: step.stepOrder, status: 'running' },
      });

      // Record history for rerun
      await tx.epicRunHistory.create({
        data: {
          epicRunId: id,
          stepOrder: step.stepOrder,
          action: 'rerun',
          actor: 'system',
          details: {
            feedback: step.feedback,
            context: dto.context ?? null,
          },
        },
      });
    });

    return this.findById(id);
  }

  /**
   * Handle step completion. Called when an agent finishes executing a step.
   * Applies on-failure behavior if the step failed.
   */
  async completeStep(id: string, stepId: string, output: string, failed: boolean = false) {
    const epicRun = await this.findById(id);

    const step = epicRun.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundException(
        `Step with ID "${stepId}" not found in epic run "${id}"`,
      );
    }

    if (step.status !== 'running') {
      throw new BadRequestException(
        `Step can only be completed when status is "running". Current status: "${step.status}"`,
      );
    }

    // Get the pipeline step to check onFailure behavior
    const pipelineStep = await this.prisma.pipelineStep.findUnique({
      where: { id: step.pipelineStepId },
    });

    const isLastStep = step.stepOrder === epicRun.steps.length - 1;

    await this.prisma.$transaction(async (tx) => {
      if (failed) {
        // Mark step as failed
        await tx.epicRunStep.update({
          where: { id: stepId },
          data: { status: 'failed', output, completedAt: new Date() },
        });

        // Record history for failure
        await tx.epicRunHistory.create({
          data: {
            epicRunId: id,
            stepOrder: step.stepOrder,
            action: 'failed',
            actor: 'system',
            details: { output },
          },
        });

        const onFailure = pipelineStep?.onFailure ?? 'stop';

        if (onFailure === 'stop') {
          // Mark run as failed
          await tx.epicRun.update({
            where: { id },
            data: { status: 'failed', completedAt: new Date() },
          });
        } else if (onFailure === 'continue') {
          if (isLastStep) {
            // Last step failed with continue — mark run as completed
            await tx.epicRun.update({
              where: { id },
              data: { status: 'completed', completedAt: new Date() },
            });
          } else {
            // Advance to next step
            const nextStepOrder = step.stepOrder + 1;
            await tx.epicRun.update({
              where: { id },
              data: { currentStep: nextStepOrder },
            });

            await tx.epicRunStep.update({
              where: { epicRunId_stepOrder: { epicRunId: id, stepOrder: nextStepOrder } },
              data: { status: 'running', startedAt: new Date() },
            });

            // Record history for next step start
            await tx.epicRunHistory.create({
              data: {
                epicRunId: id,
                stepOrder: nextStepOrder,
                action: 'started',
                actor: 'system',
              },
            });
          }
        }
      } else {
        // Mark step as completed (awaiting approval)
        await tx.epicRunStep.update({
          where: { id: stepId },
          data: { status: 'completed', output, completedAt: new Date() },
        });

        // Record history for completion
        await tx.epicRunHistory.create({
          data: {
            epicRunId: id,
            stepOrder: step.stepOrder,
            action: 'completed',
            actor: 'system',
            details: { output },
          },
        });
      }
    });

    return this.findById(id);
  }

  /**
   * Request update on an approved step.
   * Resets step to "running", resets downstream steps to "pending",
   * updates epic run currentStep, and creates history record.
   */
  async requestUpdate(
    id: string,
    stepId: string,
    dto: { reason?: string; context?: string },
  ) {
    const epicRun = await this.findById(id);

    const step = epicRun.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundException(
        `Step with ID "${stepId}" not found in epic run "${id}"`,
      );
    }

    if (step.status !== 'approved') {
      throw new BadRequestException(
        `Step can only be updated when status is "approved". Current status: "${step.status}"`,
      );
    }

    const originalApprovedAt = step.approvedAt;

    await this.prisma.$transaction(async (tx) => {
      // Reset step to "running" with new startedAt, clear approvedAt
      await tx.epicRunStep.update({
        where: { id: stepId },
        data: {
          status: 'running',
          startedAt: new Date(),
          approvedAt: null,
          completedAt: null,
          context: dto.context ?? null,
        },
      });

      // Reset all downstream steps to "pending"
      const downstreamSteps = epicRun.steps.filter(
        (s) => s.stepOrder > step.stepOrder,
      );
      for (const downstream of downstreamSteps) {
        await tx.epicRunStep.update({
          where: { id: downstream.id },
          data: {
            status: 'pending',
            startedAt: null,
            completedAt: null,
            approvedAt: null,
            rejectedAt: null,
            output: null,
            feedback: null,
            context: null,
          },
        });
      }

      // Update epic run currentStep to the reopened step's stepOrder
      const updateData: any = { currentStep: step.stepOrder };

      // If epic run is "completed", transition back to "running"
      if (epicRun.status === 'completed') {
        updateData.status = 'running';
        updateData.completedAt = null;
      }

      await tx.epicRun.update({
        where: { id },
        data: updateData,
      });

      // Create EpicRunHistory record with action "update_requested"
      await tx.epicRunHistory.create({
        data: {
          epicRunId: id,
          stepOrder: step.stepOrder,
          action: 'update_requested',
          actor: 'system',
          details: {
            originalApprovedAt,
            reason: dto.reason ?? null,
          },
        },
      });
    });

    return this.findById(id);
  }

  /**
   * Get full execution history for an epic run.
   */
  async getHistory(id: string) {
    // Verify epic run exists
    await this.findById(id);

    return this.prisma.epicRunHistory.findMany({
      where: { epicRunId: id },
      orderBy: { createdAt: 'asc' },
    });
  }
}
