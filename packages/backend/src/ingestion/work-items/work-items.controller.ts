import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { WorkItemsService } from './work-items.service';

@ApiTags('Work Items')
@Controller('work-items')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkItemsController {
  constructor(private readonly workItemsService: WorkItemsService) {}

  @Get()
  @ApiOperation({ summary: 'List work items with optional filters' })
  @ApiQuery({ name: 'projectId', required: true })
  @ApiQuery({ name: 'phase', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'assignee', required: false })
  @ApiQuery({ name: 'label', required: false })
  @ApiQuery({ name: 'sprintName', required: false })
  findAll(
    @Query('projectId') projectId: string,
    @Query('phase') phase?: string,
    @Query('type') type?: string,
    @Query('assignee') assignee?: string,
    @Query('label') label?: string,
    @Query('sprintName') sprintName?: string,
  ) {
    return this.workItemsService.findAll({ projectId, phase, type, assignee, label, sprintName });
  }

  @Get('by-phase')
  @ApiOperation({ summary: 'Count work items grouped by SDLC phase (WIP per phase)' })
  countByPhase(@Query('projectId') projectId: string) {
    return this.workItemsService.countByPhase(projectId);
  }

  @Get('aging')
  @ApiOperation({ summary: 'Get aging WIP items beyond threshold days' })
  getAgingWip(
    @Query('projectId') projectId: string,
    @Query('thresholdDays') thresholdDays?: string,
  ) {
    return this.workItemsService.getAgingWip(projectId, thresholdDays ? +thresholdDays : 7);
  }

  @Get('apply-mappings')
  @ApiOperation({ summary: 'Apply status-to-phase mappings for a project' })
  applyMappings(@Query('projectId') projectId: string) {
    return this.workItemsService.applyStatusMappings(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single work item' })
  findOne(@Param('id') id: string) {
    return this.workItemsService.findById(id);
  }
}
