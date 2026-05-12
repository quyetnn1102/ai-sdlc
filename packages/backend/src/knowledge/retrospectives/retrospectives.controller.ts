import {
  Controller, Get, Post, Put, Delete,
  Param, Query, Body, UseGuards, Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { RetrospectivesService, CreateRetroDto } from './retrospectives.service';

@ApiTags('Retrospectives')
@Controller('projects/:projectId/retros')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RetrospectivesController {
  constructor(private readonly retroService: RetrospectivesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a retrospective' })
  create(@Param('projectId') projectId: string, @Body() dto: CreateRetroDto) {
    return this.retroService.create(projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List retrospectives for a project' })
  @ApiQuery({ name: 'tag', required: false })
  findAll(@Param('projectId') projectId: string, @Query('tag') tag?: string) {
    return this.retroService.findByProject(projectId, tag);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get retrospective by ID' })
  findOne(@Param('id') id: string) {
    return this.retroService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a retrospective' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateRetroDto>) {
    return this.retroService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a retrospective' })
  remove(@Param('id') id: string) {
    return this.retroService.delete(id);
  }

  @Patch(':id/action-items/:index/toggle')
  @ApiOperation({ summary: 'Toggle action item completion' })
  toggleActionItem(
    @Param('id') id: string,
    @Param('index') index: string,
    @Body('completed') completed: boolean,
  ) {
    return this.retroService.toggleActionItem(id, +index, completed);
  }

  @Patch(':id/link-incident')
  @ApiOperation({ summary: 'Link retrospective to an incident (post-mortem)' })
  linkIncident(@Param('id') id: string, @Body('incidentId') incidentId: string) {
    return this.retroService.linkToIncident(id, incidentId);
  }
}
