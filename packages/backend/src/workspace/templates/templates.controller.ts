import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ApplyTemplateDto } from './dto/apply-template.dto';

@ApiTags('Workspace Templates')
@Controller('organizations/:orgId/workspace-templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List templates (built-in + custom)' })
  findAll(@Param('orgId') orgId: string) {
    return this.templatesService.findAll(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template details' })
  findById(@Param('id') id: string) {
    return this.templatesService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Save current workspace as template' })
  saveAsTemplate(
    @Param('orgId') orgId: string,
    @Body() dto: CreateTemplateDto & { projectId: string },
  ) {
    return this.templatesService.saveAsTemplate(orgId, dto.projectId, dto);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Apply template to a project' })
  applyTemplate(
    @Param('id') id: string,
    @Body() dto: ApplyTemplateDto & { projectId: string },
  ) {
    return this.templatesService.applyTemplate(id, dto.projectId, dto.conflictResolution);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a custom template' })
  delete(@Param('id') id: string) {
    return this.templatesService.delete(id);
  }
}
