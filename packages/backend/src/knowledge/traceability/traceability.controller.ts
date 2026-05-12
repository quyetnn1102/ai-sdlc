import {
  Controller, Get, Post, Delete,
  Param, Query, Body, UseGuards, Res, Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { TraceabilityService, CreateTraceLinkDto } from './traceability.service';

@ApiTags('Traceability')
@Controller('projects/:projectId/trace')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TraceabilityController {
  constructor(private readonly traceabilityService: TraceabilityService) {}

  @Get()
  @ApiOperation({ summary: 'Full trace chain for a requirement (epic key)' })
  @ApiQuery({ name: 'epicKey', required: true })
  getTrace(
    @Param('projectId') projectId: string,
    @Query('epicKey') epicKey: string,
  ) {
    return this.traceabilityService.getRequirementTrace(projectId, epicKey);
  }

  @Get('links')
  @ApiOperation({ summary: 'List trace links' })
  @ApiQuery({ name: 'sourceType', required: false })
  @ApiQuery({ name: 'sourceId', required: false })
  listLinks(
    @Param('projectId') projectId: string,
    @Query('sourceType') sourceType?: string,
    @Query('sourceId') sourceId?: string,
  ) {
    return this.traceabilityService.listLinks(projectId, sourceType, sourceId);
  }

  @Post('links')
  @ApiOperation({ summary: 'Create a manual trace link' })
  createLink(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTraceLinkDto,
  ) {
    return this.traceabilityService.createLink(projectId, dto);
  }

  @Delete('links/:id')
  @ApiOperation({ summary: 'Delete a trace link' })
  deleteLink(@Param('id') id: string) {
    return this.traceabilityService.deleteLink(id);
  }

  @Get('rtm')
  @ApiOperation({ summary: 'Requirements Traceability Matrix — in-app view' })
  getRtm(@Param('projectId') projectId: string) {
    return this.traceabilityService.getRtm(projectId);
  }

  @Get('rtm/export')
  @ApiOperation({ summary: 'Export RTM as CSV (sync stub; production queues as background job)' })
  @Header('Content-Type', 'text/csv')
  async exportRtm(@Param('projectId') projectId: string, @Res() res: Response) {
    const csv = await this.traceabilityService.exportRtmCsv(projectId);
    res.setHeader('Content-Disposition', `attachment; filename="rtm-${projectId}.csv"`);
    res.send(csv);
  }
}
