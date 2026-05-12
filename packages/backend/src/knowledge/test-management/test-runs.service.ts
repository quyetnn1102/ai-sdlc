import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type TestResult = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIP';

export interface CreateTestRunDto {
  testCaseId: string;
  testPlanId?: string;
  result: TestResult;
  executedBy?: string;
  notes?: string;
  duration?: number;
}

export interface BulkTestRunDto {
  runs: CreateTestRunDto[];
}

@Injectable()
export class TestRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTestRunDto) {
    // Verify test case exists
    const tc = await this.prisma.testCase.findUnique({ where: { id: dto.testCaseId } });
    if (!tc) throw new NotFoundException('Test case not found');

    return this.prisma.testRun.create({
      data: {
        testCaseId: dto.testCaseId,
        testPlanId: dto.testPlanId,
        result: dto.result,
        executedBy: dto.executedBy,
        notes: dto.notes,
        duration: dto.duration,
      },
    });
  }

  async createBulk(bulk: BulkTestRunDto) {
    const results = await Promise.allSettled(bulk.runs.map((r) => this.create(r)));
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    return { succeeded, failed, total: bulk.runs.length };
  }

  async findByTestCase(testCaseId: string) {
    return this.prisma.testRun.findMany({
      where: { testCaseId },
      orderBy: { executedAt: 'desc' },
    });
  }

  async findByPlan(testPlanId: string) {
    return this.prisma.testRun.findMany({
      where: { testPlanId },
      include: { testCase: { select: { id: true, title: true, priority: true, type: true } } },
      orderBy: { executedAt: 'desc' },
    });
  }

  /**
   * Ingest automated test results from CI.
   * Matches test cases by title (exact) then falls back to partial match.
   * Unmatched results are returned for manual mapping.
   */
  async ingestCiResults(
    projectId: string,
    testPlanId: string | undefined,
    results: Array<{ name: string; result: TestResult; duration?: number }>,
  ) {
    const testCases = await this.prisma.testCase.findMany({ where: { projectId } });
    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const r of results) {
      // Tier 1: exact match
      let tc = testCases.find((t) => t.title === r.name);
      // Tier 2: case-insensitive partial match
      if (!tc) tc = testCases.find((t) => t.title.toLowerCase().includes(r.name.toLowerCase()));

      if (tc) {
        await this.create({ testCaseId: tc.id, testPlanId, result: r.result, duration: r.duration, executedBy: 'CI' });
        matched.push(r.name);
      } else {
        unmatched.push(r.name);
      }
    }

    return { matched: matched.length, unmatched, total: results.length };
  }
}
