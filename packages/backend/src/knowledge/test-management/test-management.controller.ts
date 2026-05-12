import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Query, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../platform/auth/guards/jwt-auth.guard';
import { TestCasesService, CreateTestCaseDto } from './test-cases.service';
import { TestPlansService, CreateTestPlanDto } from './test-plans.service';
import { TestRunsService, CreateTestRunDto, BulkTestRunDto } from './test-runs.service';

@ApiTags('Test Management')
@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TestManagementController {
  constructor(
    private readonly testCasesService: TestCasesService,
    private readonly testPlansService: TestPlansService,
    private readonly testRunsService: TestRunsService,
  ) {}

  // ── Test Cases ─────────────────────────────────────────────────────
  @Post('test-cases')
  @ApiOperation({ summary: 'Create a test case' })
  createCase(@Param('projectId') projectId: string, @Body() dto: CreateTestCaseDto) {
    return this.testCasesService.create(projectId, dto);
  }

  @Get('test-cases')
  @ApiOperation({ summary: 'List test cases' })
  @ApiQuery({ name: 'linkedRequirementId', required: false })
  listCases(
    @Param('projectId') projectId: string,
    @Query('linkedRequirementId') linkedRequirementId?: string,
  ) {
    return this.testCasesService.findByProject(projectId, linkedRequirementId);
  }

  @Get('test-cases/coverage')
  @ApiOperation({ summary: 'Test coverage % per requirement' })
  coverage(@Param('projectId') projectId: string) {
    return this.testCasesService.coverageByRequirement(projectId);
  }

  @Get('test-cases/:id')
  @ApiOperation({ summary: 'Get test case with run history' })
  getCase(@Param('id') id: string) {
    return this.testCasesService.findById(id);
  }

  @Put('test-cases/:id')
  @ApiOperation({ summary: 'Update a test case' })
  updateCase(@Param('id') id: string, @Body() dto: Partial<CreateTestCaseDto>) {
    return this.testCasesService.update(id, dto);
  }

  @Delete('test-cases/:id')
  @ApiOperation({ summary: 'Delete a test case' })
  deleteCase(@Param('id') id: string) {
    return this.testCasesService.delete(id);
  }

  // ── Test Plans ─────────────────────────────────────────────────────
  @Post('test-plans')
  @ApiOperation({ summary: 'Create a test plan' })
  createPlan(@Param('projectId') projectId: string, @Body() dto: CreateTestPlanDto) {
    return this.testPlansService.create(projectId, dto);
  }

  @Get('test-plans')
  @ApiOperation({ summary: 'List test plans' })
  listPlans(@Param('projectId') projectId: string) {
    return this.testPlansService.findByProject(projectId);
  }

  @Get('test-plans/:planId')
  @ApiOperation({ summary: 'Get test plan with runs' })
  getPlan(@Param('planId') planId: string) {
    return this.testPlansService.findById(planId);
  }

  @Get('test-plans/:planId/summary')
  @ApiOperation({ summary: 'Pass/fail/blocked summary for a test plan' })
  planSummary(@Param('planId') planId: string) {
    return this.testPlansService.summary(planId);
  }

  @Put('test-plans/:planId')
  @ApiOperation({ summary: 'Update a test plan' })
  updatePlan(
    @Param('planId') planId: string,
    @Body() dto: Partial<CreateTestPlanDto> & { status?: string },
  ) {
    return this.testPlansService.update(planId, dto);
  }

  @Delete('test-plans/:planId')
  @ApiOperation({ summary: 'Delete a test plan' })
  deletePlan(@Param('planId') planId: string) {
    return this.testPlansService.delete(planId);
  }

  // ── Test Runs ──────────────────────────────────────────────────────
  @Post('test-runs')
  @ApiOperation({ summary: 'Record a test run result' })
  createRun(@Body() dto: CreateTestRunDto) {
    return this.testRunsService.create(dto);
  }

  @Post('test-runs/bulk')
  @ApiOperation({ summary: 'Record multiple test run results at once' })
  bulkRun(@Body() dto: BulkTestRunDto) {
    return this.testRunsService.createBulk(dto);
  }

  @Post('test-runs/ci-ingest')
  @ApiOperation({ summary: 'Ingest automated CI test results with auto-matching' })
  @ApiQuery({ name: 'testPlanId', required: false })
  ciIngest(
    @Param('projectId') projectId: string,
    @Query('testPlanId') testPlanId: string,
    @Body() body: { results: Array<{ name: string; result: 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIP'; duration?: number }> },
  ) {
    return this.testRunsService.ingestCiResults(projectId, testPlanId, body.results);
  }

  @Get('test-runs/by-case/:testCaseId')
  @ApiOperation({ summary: 'Get all runs for a test case' })
  runsByCase(@Param('testCaseId') testCaseId: string) {
    return this.testRunsService.findByTestCase(testCaseId);
  }

  @Get('test-runs/by-plan/:testPlanId')
  @ApiOperation({ summary: 'Get all runs for a test plan' })
  runsByPlan(@Param('testPlanId') testPlanId: string) {
    return this.testRunsService.findByPlan(testPlanId);
  }
}
