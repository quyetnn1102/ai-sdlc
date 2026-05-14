import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { EpicRunsService } from './epic-runs.service';
import { CreateEpicRunDto } from './dto/create-epic-run.dto';
import { RejectStepDto } from './dto/reject-step.dto';
import { RerunStepDto } from './dto/rerun-step.dto';
import { RequestUpdateDto } from './dto/request-update.dto';

@ApiTags('Epic Runs')
@Controller('projects/:projectId/epic-runs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EpicRunsController {
  constructor(private readonly epicRunsService: EpicRunsService) {}

  @Get()
  @ApiOperation({ summary: 'List epic runs with optional status filter' })
  findAll(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    return this.epicRunsService.findAll(projectId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get epic run with step details' })
  findById(@Param('id') id: string) {
    return this.epicRunsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new epic run (bind pipeline to work item)' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateEpicRunDto,
  ) {
    return this.epicRunsService.create(projectId, dto);
  }

  @Post(':id/steps/:stepId/approve')
  @ApiOperation({ summary: 'Approve a completed step' })
  approveStep(@Param('id') id: string, @Param('stepId') stepId: string) {
    return this.epicRunsService.approveStep(id, stepId);
  }

  @Post(':id/steps/:stepId/reject')
  @ApiOperation({ summary: 'Reject a step with feedback' })
  rejectStep(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() dto: RejectStepDto,
  ) {
    return this.epicRunsService.rejectStep(id, stepId, dto);
  }

  @Post(':id/steps/:stepId/rerun')
  @ApiOperation({ summary: 'Rerun a rejected step' })
  rerunStep(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() dto: RerunStepDto,
  ) {
    return this.epicRunsService.rerunStep(id, stepId, dto);
  }

  @Post(':id/steps/:stepId/request-update')
  @ApiOperation({ summary: 'Request update on an approved step' })
  requestUpdate(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() dto: RequestUpdateDto,
  ) {
    return this.epicRunsService.requestUpdate(id, stepId, dto);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get full execution history for an epic run' })
  getHistory(@Param('id') id: string) {
    return this.epicRunsService.getHistory(id);
  }
}
