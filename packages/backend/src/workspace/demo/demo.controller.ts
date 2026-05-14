import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { DemoService } from './demo.service';

@ApiTags('Workspace Demo')
@Controller('projects/:projectId/workspace/demo')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Post('load')
  @ApiOperation({ summary: 'Load demo project' })
  loadDemo(@Param('projectId') projectId: string) {
    return this.demoService.loadDemo(projectId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check if demo is already loaded' })
  getStatus(@Param('projectId') projectId: string) {
    return this.demoService.getStatus(projectId);
  }
}
