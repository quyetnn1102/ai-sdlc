import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, UseGuards, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { AgentsService, CreateAgentProfileDto, CreateMappingDto } from './agents.service';

@ApiTags('Agent Profiles')
@Controller('projects/:projectId/agents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  // ── Agent Profiles ────────────────────────────────────────────────────
  @Post('seed')
  @ApiOperation({ summary: 'Seed default agent profiles for this project' })
  seedDefaults(@Param('projectId') projectId: string) {
    return this.agentsService.seedDefaults(projectId);
  }

  @Post('profiles')
  @ApiOperation({ summary: 'Create a custom agent profile' })
  createProfile(
    @Param('projectId') projectId: string,
    @Body() dto: CreateAgentProfileDto,
  ) {
    return this.agentsService.createProfile(projectId, dto);
  }

  @Get('profiles')
  @ApiOperation({ summary: 'List agent profiles (project + global defaults)' })
  listProfiles(@Param('projectId') projectId: string) {
    return this.agentsService.listProfiles(projectId);
  }

  @Get('profiles/:id')
  @ApiOperation({ summary: 'Get agent profile by ID' })
  getProfile(@Param('id') id: string) {
    return this.agentsService.getProfile(id);
  }

  @Put('profiles/:id')
  @ApiOperation({ summary: 'Update agent profile' })
  updateProfile(@Param('id') id: string, @Body() dto: Partial<CreateAgentProfileDto>) {
    return this.agentsService.updateProfile(id, dto);
  }

  @Delete('profiles/:id')
  @ApiOperation({ summary: 'Delete agent profile' })
  deleteProfile(@Param('id') id: string) {
    return this.agentsService.deleteProfile(id);
  }

  // ── Phase-to-Agent Mappings ───────────────────────────────────────────
  @Post('mappings')
  @ApiOperation({ summary: 'Map a workflow phase to an agent profile' })
  createMapping(
    @Param('projectId') projectId: string,
    @Body() dto: CreateMappingDto,
  ) {
    return this.agentsService.createMapping(projectId, dto);
  }

  @Get('mappings')
  @ApiOperation({ summary: 'List all phase-to-agent mappings for this project' })
  listMappings(@Param('projectId') projectId: string) {
    return this.agentsService.listMappings(projectId);
  }

  @Get('mappings/by-phase/:phaseId')
  @ApiOperation({ summary: 'Get mappings for a specific phase' })
  getMappingsByPhase(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
  ) {
    return this.agentsService.getMappingsByPhase(projectId, phaseId);
  }

  @Delete('mappings/:id')
  @ApiOperation({ summary: 'Remove a phase-agent mapping' })
  deleteMapping(@Param('id') id: string) {
    return this.agentsService.deleteMapping(id);
  }
}
