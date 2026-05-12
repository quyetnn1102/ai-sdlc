import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { WorkflowService, CreatePhaseDto, CreateStatusMappingDto } from './workflow.service';

@ApiTags('Workflow')
@Controller('projects/:projectId/workflow')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('phases')
  @ApiOperation({ summary: 'List workflow phases with status mappings' })
  listPhases(@Param('projectId') projectId: string) {
    return this.workflowService.findPhasesByProject(projectId);
  }

  @Post('phases')
  @ApiOperation({ summary: 'Create a workflow phase' })
  createPhase(@Param('projectId') projectId: string, @Body() dto: CreatePhaseDto) {
    return this.workflowService.createPhase(projectId, dto);
  }

  @Put('phases/:phaseId')
  @ApiOperation({ summary: 'Update a workflow phase' })
  updatePhase(@Param('phaseId') phaseId: string, @Body() dto: Partial<CreatePhaseDto>) {
    return this.workflowService.updatePhase(phaseId, dto);
  }

  @Delete('phases/:phaseId')
  @ApiOperation({ summary: 'Delete a workflow phase' })
  deletePhase(@Param('phaseId') phaseId: string) {
    return this.workflowService.deletePhase(phaseId);
  }

  @Get('phases/:phaseId/mappings')
  @ApiOperation({ summary: 'Get status mappings for a phase' })
  getMappings(@Param('phaseId') phaseId: string) {
    return this.workflowService.findPhaseMappings(phaseId);
  }

  @Post('phases/:phaseId/mappings')
  @ApiOperation({ summary: 'Add a status → phase mapping' })
  addMapping(@Param('phaseId') phaseId: string, @Body() dto: CreateStatusMappingDto) {
    return this.workflowService.addStatusMapping(phaseId, dto);
  }

  @Delete('phases/:phaseId/mappings/:mappingId')
  @ApiOperation({ summary: 'Remove a status mapping' })
  removeMapping(@Param('mappingId') mappingId: string) {
    return this.workflowService.removeStatusMapping(mappingId);
  }
}
