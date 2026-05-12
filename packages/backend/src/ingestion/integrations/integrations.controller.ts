import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto/create-integration.dto';

@ApiTags('Integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Post()
  @ApiOperation({ summary: 'Add integration to a project' })
  create(
    @Query('projectId') projectId: string,
    @Body() dto: CreateIntegrationDto,
  ) {
    return this.integrationsService.create(projectId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List integrations for a project' })
  findAll(@Query('projectId') projectId: string) {
    return this.integrationsService.findByProject(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get integration by ID' })
  findOne(@Param('id') id: string) {
    return this.integrationsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update integration settings or status' })
  update(@Param('id') id: string, @Body() dto: UpdateIntegrationDto) {
    return this.integrationsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove integration' })
  remove(@Param('id') id: string) {
    return this.integrationsService.delete(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test integration connectivity' })
  async testConnection(@Param('id') id: string) {
    // Adapter-specific ping is delegated; here we return current health status
    const integration = await this.integrationsService.findById(id);
    return { integrationId: id, type: integration.type, status: integration.status };
  }
}
