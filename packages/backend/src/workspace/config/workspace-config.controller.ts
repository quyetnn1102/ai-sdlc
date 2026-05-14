import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { WorkspaceConfigService } from './workspace-config.service';
import { InspectorService } from '../inspector/inspector.service';
import { UpdateConfigDto } from './dto/update-config.dto';

@ApiTags('Workspace Config')
@Controller('projects/:projectId/workspace')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkspaceConfigController {
  constructor(
    private readonly workspaceConfigService: WorkspaceConfigService,
    private readonly inspectorService: InspectorService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Get current workspace config' })
  getConfig(@Param('projectId') projectId: string) {
    return this.workspaceConfigService.getConfig(projectId);
  }

  @Put('config')
  @ApiOperation({ summary: 'Update workspace config' })
  updateConfig(
    @Param('projectId') projectId: string,
    @Body() dto: UpdateConfigDto,
  ) {
    return this.workspaceConfigService.updateConfig(projectId, dto);
  }

  @Get('yaml')
  @ApiOperation({ summary: 'Generate workspace.yaml content' })
  generateYaml(@Param('projectId') projectId: string) {
    return this.workspaceConfigService.generateYaml(projectId);
  }

  @Post('inspect')
  @ApiOperation({ summary: 'Parse, validate, and resolve workspace.yaml' })
  inspect(@Param('projectId') projectId: string) {
    return this.inspectorService.inspect(projectId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get workspace status (counts, active runs)' })
  getStatus(@Param('projectId') projectId: string) {
    return this.workspaceConfigService.getStatus(projectId);
  }
}
