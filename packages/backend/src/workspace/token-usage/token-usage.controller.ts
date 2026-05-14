import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { TokenUsageService } from './token-usage.service';
import { CostSuggestionService } from './cost-suggestion.service';

@ApiTags('Token Usage')
@Controller('projects/:projectId/workspace/token-usage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TokenUsageController {
  constructor(
    private readonly tokenUsageService: TokenUsageService,
    private readonly costSuggestionService: CostSuggestionService,
  ) {}

  @Get('today')
  @ApiOperation({ summary: "Get today's token usage summary" })
  getTodaySummary(@Param('projectId') projectId: string) {
    return this.tokenUsageService.getTodaySummary(projectId);
  }

  @Get('report')
  @ApiOperation({ summary: 'Get full token usage report' })
  getReport(@Param('projectId') projectId: string) {
    return this.tokenUsageService.getReport(projectId);
  }

  @Get('epic-run/:epicRunId')
  @ApiOperation({ summary: 'Get token usage for an epic run' })
  getEpicRunUsage(@Param('epicRunId') epicRunId: string) {
    return this.tokenUsageService.getEpicRunUsage(epicRunId);
  }

  @Get('step/:stepId')
  @ApiOperation({ summary: 'Get token usage for a step' })
  getStepUsage(@Param('stepId') stepId: string) {
    return this.tokenUsageService.getStepUsage(stepId);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Get cost optimization suggestions' })
  getSuggestions(@Param('projectId') projectId: string) {
    return this.costSuggestionService.getSuggestions(projectId);
  }
}
