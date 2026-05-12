import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { GatesService } from './gates.service';
import { CreateGateDto } from './dto/create-gate.dto';

@ApiTags('Gates')
@Controller('projects/:projectId/gates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GatesController {
  constructor(private readonly gatesService: GatesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a quality gate definition' })
  create(@Param('projectId') projectId: string, @Body() dto: CreateGateDto) {
    return this.gatesService.create(projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List gate definitions with latest evaluation' })
  findAll(@Param('projectId') projectId: string) {
    return this.gatesService.findByProject(projectId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Latest pass/fail status for all gates' })
  latestStatus(@Param('projectId') projectId: string) {
    return this.gatesService.latestStatus(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get gate definition with evaluation history' })
  findOne(@Param('id') id: string) {
    return this.gatesService.findById(id);
  }

  @Post('evaluate')
  @ApiOperation({ summary: 'Evaluate all gates for a build' })
  evaluate(
    @Param('projectId') projectId: string,
    @Query('buildId') buildId: string,
  ) {
    return this.gatesService.evaluateForBuild(projectId, buildId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a gate definition' })
  remove(@Param('id') id: string) {
    return this.gatesService.delete(id);
  }
}
