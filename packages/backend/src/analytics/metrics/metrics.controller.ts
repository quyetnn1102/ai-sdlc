import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { MetricsService, MetricsPeriod } from './metrics.service';

@ApiTags('Metrics')
@Controller('projects/:projectId/metrics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('dora')
  @ApiOperation({ summary: 'Get all four DORA metrics for a project' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  dora(@Param('projectId') projectId: string, @Query('period') period?: MetricsPeriod) {
    return this.metricsService.dora(projectId, period ?? '30d');
  }

  @Get('dora/deployment-frequency')
  @ApiOperation({ summary: 'Deployment frequency' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  deploymentFrequency(
    @Param('projectId') projectId: string,
    @Query('period') period?: MetricsPeriod,
  ) {
    return this.metricsService.deploymentFrequency(projectId, period ?? '30d');
  }

  @Get('dora/lead-time')
  @ApiOperation({ summary: 'Lead time for changes' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  leadTime(@Param('projectId') projectId: string, @Query('period') period?: MetricsPeriod) {
    return this.metricsService.leadTimeForChanges(projectId, period ?? '30d');
  }

  @Get('dora/change-failure-rate')
  @ApiOperation({ summary: 'Change failure rate' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  changeFailureRate(
    @Param('projectId') projectId: string,
    @Query('period') period?: MetricsPeriod,
  ) {
    return this.metricsService.changeFailureRate(projectId, period ?? '30d');
  }

  @Get('dora/mttr')
  @ApiOperation({ summary: 'Mean time to recovery (avg, p50, p90)' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  mttr(@Param('projectId') projectId: string, @Query('period') period?: MetricsPeriod) {
    return this.metricsService.mttr(projectId, period ?? '30d');
  }

  @Get('flow')
  @ApiOperation({ summary: 'Flow metrics: WIP per phase, throughput, avg age' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  flow(@Param('projectId') projectId: string, @Query('period') period?: MetricsPeriod) {
    return this.metricsService.flowMetrics(projectId, period ?? '30d');
  }
}
