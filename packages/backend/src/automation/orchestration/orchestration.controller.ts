import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import {
  OrchestrationService,
  StartExecutionDto,
  CompleteTaskDto,
} from './orchestration.service';

@ApiTags('Workflow Executions')
@Controller('projects/:projectId/workflow-executions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrchestrationController {
  constructor(private readonly orchestration: OrchestrationService) {}

  @Post()
  @ApiOperation({ summary: 'Start a new workflow execution' })
  start(
    @Param('projectId') projectId: string,
    @Body() body: Omit<StartExecutionDto, 'projectId'>,
    @Request() req: any,
  ) {
    return this.orchestration.start({
      projectId,
      initiatedBy: req.user?.id,
      config: body.config,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List workflow executions for this project' })
  list(@Param('projectId') projectId: string) {
    return this.orchestration.listExecutions(projectId);
  }

  @Get(':executionId')
  @ApiOperation({ summary: 'Get execution status with full task list and DAG' })
  getStatus(@Param('executionId') executionId: string) {
    return this.orchestration.getExecutionStatus(executionId);
  }

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

// ── Agent callback endpoint (no project scope — agents call directly) ──
@ApiTags('Agent Callbacks')
@Controller('agent-callback')
export class AgentCallbackController {
  constructor(private readonly orchestration: OrchestrationService) {}

  @Post('complete')
  @ApiOperation({ summary: 'Agent reports task completion with artifacts' })
  complete(@Body() dto: CompleteTaskDto) {
    return this.orchestration.completeTask(dto);
  }

  @Post('heartbeat/:agentInstanceId')
  @ApiOperation({ summary: 'Agent heartbeat to signal it is alive' })
  heartbeat(@Param('agentInstanceId') agentInstanceId: string) {
    return this.orchestration.heartbeat(agentInstanceId);
  }
}
