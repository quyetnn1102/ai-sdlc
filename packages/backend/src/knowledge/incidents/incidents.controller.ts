import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { IncidentsService, CreateIncidentDto, AddTimelineEventDto } from './incidents.service';

@ApiTags('Incidents')
@Controller('projects/:projectId/incidents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create an incident' })
  create(@Param('projectId') projectId: string, @Body() dto: CreateIncidentDto) {
    return this.incidentsService.create(projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List incidents' })
  @ApiQuery({ name: 'severity', required: false, enum: ['P1', 'P2', 'P3', 'P4'] })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @Param('projectId') projectId: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
  ) {
    return this.incidentsService.findByProject(projectId, { severity, status });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Incident statistics (MTTR, CFR, counts by severity)' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  stats(
    @Param('projectId') projectId: string,
    @Query('period') period?: '7d' | '30d' | '90d',
  ) {
    return this.incidentsService.stats(projectId, period ?? '30d');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get incident details with timeline' })
  findOne(@Param('id') id: string) {
    return this.incidentsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update incident' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateIncidentDto>) {
    return this.incidentsService.update(id, dto);
  }

  @Patch(':id/resolve')
  @ApiOperation({ summary: 'Mark incident as resolved' })
  resolve(@Param('id') id: string, @Body('endAt') endAt?: string) {
    return this.incidentsService.resolve(id, endAt ? new Date(endAt) : new Date());
  }

  @Patch(':id/timeline')
  @ApiOperation({ summary: 'Add an event to the incident timeline' })
  addTimeline(@Param('id') id: string, @Body() dto: AddTimelineEventDto) {
    return this.incidentsService.addTimelineEvent(id, dto);
  }

  @Patch(':id/link-deployment')
  @ApiOperation({ summary: 'Link incident to a deployment (root cause)' })
  linkDeployment(@Param('id') id: string, @Body('deploymentId') deploymentId: string) {
    return this.incidentsService.linkToDeployment(id, deploymentId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete incident' })
  remove(@Param('id') id: string) {
    return this.incidentsService.delete(id);
  }

  @Post('pagerduty')
  @ApiOperation({ summary: 'Ingest PagerDuty alert webhook' })
  pagerduty(@Param('projectId') projectId: string, @Body() payload: Record<string, unknown>) {
    return this.incidentsService.ingestPagerDuty(projectId, payload);
  }
}
