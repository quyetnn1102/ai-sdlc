import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import {
  AgentsService,
  CreateAgentProfileDto,
  CreateMappingDto,
} from './agents.service';
import { LlmRouterService } from '../agent-runtime/llm-router.service';

@ApiTags('Agent Profiles')
@Controller('projects/:projectId/agents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly llmRouter: LlmRouterService,
  ) {}

  // ── Default seeding ───────────────────────────────────────────────────
  @Post('seed')
  @ApiOperation({ summary: 'Seed default agent profiles (BA, Dev, QA, DevOps) for this project' })
  seedDefaults(@Param('projectId') projectId: string) {
    return this.agentsService.seedDefaults(projectId);
  }

  // ── Agent Profiles CRUD ───────────────────────────────────────────────
  @Post('profiles')
  @ApiOperation({ summary: 'Create a custom agent profile' })
  createProfile(
    @Param('projectId') projectId: string,
    @Body() dto: CreateAgentProfileDto,
  ) {
    return this.agentsService.createProfile(projectId, dto);
  }

  @Get('profiles')
  @ApiOperation({ summary: 'List agent profiles (project-specific + global defaults)' })
  listProfiles(
    @Param('projectId') projectId: string,
    @Query('page')  page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agentsService.listProfiles(projectId, {
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    }).then((res) => res.data); // unwrap for frontend backward compat
  }

  @Get('profiles/:id')
  @ApiOperation({ summary: 'Get agent profile by ID' })
  getProfile(@Param('id') id: string) {
    return this.agentsService.getProfile(id);
  }

  @Put('profiles/:id')
  @ApiOperation({
    summary: 'Update agent profile (rejected if referenced by a running execution)',
  })
  updateProfile(@Param('id') id: string, @Body() dto: Partial<CreateAgentProfileDto>) {
    return this.agentsService.updateProfile(id, dto);
  }

  @Delete('profiles/:id')
  @ApiOperation({
    summary: 'Delete agent profile (rejected if referenced by any phase mapping)',
  })
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
  @ApiOperation({ summary: 'Get mappings for a specific phase (sorted by priority)' })
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

  // ── Req 2.3 / 2.4 — Mapping validation ───────────────────────────────
  @Post('mappings/validate')
  @ApiOperation({
    summary:
      'Validate all phase-agent mappings: checks every phase has a mapping and each agent supports its phase',
  })
  validateMappings(@Param('projectId') projectId: string) {
    return this.agentsService.validateMappings(projectId);
  }

  // ── LLM Provider info ─────────────────────────────────────────────────
  @Get('llm-providers')
  @ApiOperation({
    summary: 'List available LLM providers and the default (claude, openai, azure, simulate)',
  })
  getLlmProviders() {
    return {
      available: this.llmRouter.availableProviders(),
      default: this.llmRouter.getDefaultProvider(),
    };
  }
}
