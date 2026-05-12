import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import {
  OrchestrationService,
  StartExecutionDto,
  CompleteTaskDto,
  PatchExecutionDto,
  WorkflowConfig,
} from './orchestration.service';

// ── Workflow Executions ───────────────────────────────────────────────────

@ApiTags('Workflow Executions')
@Controller('projects/:projectId/workflow-executions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrchestrationController {
  constructor(private readonly orchestration: OrchestrationService) {}

  /** Req 9.1 — Start a new workflow execution */
  @Post()
  @ApiOperation({ summary: 'Start a new workflow execution for this project' })
  start(
    @Param('projectId') projectId: string,
    @Body() body: { config?: WorkflowConfig },
    @Request() req: any,
  ) {
    const dto: StartExecutionDto = {
      projectId,
      initiatedBy: req.user?.id,
      config: body.config,
    };
    return this.orchestration.start(dto);
  }

  /** List all executions for a project */
  @Get()
  @ApiOperation({ summary: 'List workflow executions for this project' })
  list(@Param('projectId') projectId: string) {
    return this.orchestration.listExecutions(projectId);
  }

  /** Req 8.1 — Full execution detail with progress % and at-risk flags */
  @Get(':executionId')
  @ApiOperation({
    summary: 'Get execution detail — tasks, progress, at-risk flags',
  })
  getStatus(@Param('executionId') executionId: string) {
    return this.orchestration.getExecutionStatus(executionId);
  }

  /** Req 8.3 — Separate flat task list */
  @Get(':executionId/tasks')
  @ApiOperation({ summary: 'List tasks for an execution with elapsed time and at-risk flag' })
  getTasks(@Param('executionId') executionId: string) {
    return this.orchestration.getTaskList(executionId);
  }

  /** Req 8.2 / 8.5 — DAG structure with critical path */
  @Get(':executionId/dag')
  @ApiOperation({
    summary: 'Get DAG structure: nodes, edges, critical path, at-risk flags, progress',
  })
  getDag(@Param('executionId') executionId: string) {
    return this.orchestration.getDag(executionId);
  }

  /** Req 7.5 — Artifact consolidated view grouped by phase */
  @Get(':executionId/artifacts')
  @ApiOperation({ summary: 'List all artifacts produced during an execution, grouped by phase' })
  getArtifacts(@Param('executionId') executionId: string) {
    return this.orchestration.getArtifacts(executionId);
  }

  /** Req 9.2 / 9.3 / 9.4 — Pause / Resume / Cancel via action body */
  @Patch(':executionId')
  @ApiOperation({
    summary: 'Control execution lifecycle: { "action": "pause" | "resume" | "cancel" }',
  })
  @ApiBody({ schema: { example: { action: 'pause' } } })
  control(
    @Param('executionId') executionId: string,
    @Body() dto: PatchExecutionDto,
  ) {
    switch (dto.action) {
      case 'pause':  return this.orchestration.pause(executionId);
      case 'resume': return this.orchestration.resume(executionId);
      case 'cancel': return this.orchestration.cancel(executionId);
      default:
        throw new Error(`Unknown action: ${(dto as any).action}`);
    }
  }

  // Convenience shorthand routes (keep for backward compat with frontend)
  @Patch(':executionId/pause')
  @ApiOperation({ summary: 'Pause a running execution' })
  pause(@Param('executionId') executionId: string) {
    return this.orchestration.pause(executionId);
  }

  @Patch(':executionId/resume')
  @ApiOperation({ summary: 'Resume a paused execution' })
  resume(@Param('executionId') executionId: string) {
    return this.orchestration.resume(executionId);
  }

  @Patch(':executionId/cancel')
  @ApiOperation({ summary: 'Cancel a running or paused execution' })
  cancel(@Param('executionId') executionId: string) {
    return this.orchestration.cancel(executionId);
  }
}

// ── Agent Callbacks (no project scope — agents call directly) ─────────────

@ApiTags('Agent Callbacks')
@Controller('agent-callback')
export class AgentCallbackController {
  constructor(private readonly orchestration: OrchestrationService) {}

  /** Req 6.1 — Agent reports task completion with artifacts */
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Agent reports task completion (done or failed) with artifacts' })
  complete(@Body() dto: CompleteTaskDto) {
    return this.orchestration.completeTask(dto);
  }

  /** Req 5.4 — Heartbeat; response includes shouldTerminate flag */
  @Post('heartbeat/:agentInstanceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Agent heartbeat — response includes shouldTerminate:true when execution is being cancelled',
  })
  heartbeat(@Param('agentInstanceId') agentInstanceId: string) {
    return this.orchestration.heartbeat(agentInstanceId);
  }
}

// ── Internal / Admin endpoints ────────────────────────────────────────────

@ApiTags('Orchestration Admin')
@Controller('orchestration-admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrchestrationAdminController {
  constructor(private readonly orchestration: OrchestrationService) {}

  /** Req 5.5 — Trigger heartbeat timeout detection (normally called by cron) */
  @Post('detect-timeouts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detect and mark timed-out agent instances (normally triggered by cron every 30s)',
  })
  detectTimeouts() {
    return this.orchestration.detectTimedOutAgents();
  }
}
