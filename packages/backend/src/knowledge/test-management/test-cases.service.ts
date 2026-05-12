import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface TestStep { step: string; expected: string; }

export interface CreateTestCaseDto {
  title: string;
  description?: string;
  preconditions?: string;
  steps?: TestStep[];
  expectedResult?: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  type?: 'UNIT' | 'INTEGRATION' | 'E2E' | 'PERFORMANCE' | 'SECURITY' | 'MANUAL';
  linkedRequirementId?: string;
}

@Injectable()
export class TestCasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateTestCaseDto) {
    return this.prisma.testCase.create({
      data: {
        projectId,
        title: dto.title,
        description: dto.description,
        preconditions: dto.preconditions,
        steps: (dto.steps ?? []) as object[],
        expectedResult: dto.expectedResult,
        priority: dto.priority ?? 'MEDIUM',
        type: dto.type ?? 'MANUAL',
        linkedRequirementId: dto.linkedRequirementId,
      },
    });
  }

  async findByProject(projectId: string, linkedRequirementId?: string) {
    return this.prisma.testCase.findMany({
      where: {
        projectId,
        ...(linkedRequirementId ? { linkedRequirementId } : {}),
      },
      include: { testRuns: { orderBy: { executedAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const tc = await this.prisma.testCase.findUnique({
      where: { id },
      include: { testRuns: { orderBy: { executedAt: 'desc' } } },
    });
    if (!tc) throw new NotFoundException('Test case not found');
    return tc;
  }

  async update(id: string, dto: Partial<CreateTestCaseDto>) {
    await this.findById(id);
    return this.prisma.testCase.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.preconditions !== undefined ? { preconditions: dto.preconditions } : {}),
        ...(dto.steps !== undefined ? { steps: dto.steps as object[] } : {}),
        ...(dto.expectedResult !== undefined ? { expectedResult: dto.expectedResult } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.linkedRequirementId !== undefined
          ? { linkedRequirementId: dto.linkedRequirementId }
          : {}),
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.testCase.delete({ where: { id } });
  }

  // ── Coverage: % of test cases with at least one PASS run ─────────────
  async coverageByRequirement(projectId: string) {
    const cases = await this.prisma.testCase.findMany({
      where: { projectId, linkedRequirementId: { not: null } },
      include: { testRuns: { orderBy: { executedAt: 'desc' }, take: 1 } },
    });

    const byReq: Record<string, { total: number; passed: number }> = {};
    for (const tc of cases) {
      const reqId = tc.linkedRequirementId!;
      if (!byReq[reqId]) byReq[reqId] = { total: 0, passed: 0 };
      byReq[reqId].total++;
      if (tc.testRuns[0]?.result === 'PASS') byReq[reqId].passed++;
    }

    return Object.entries(byReq).map(([reqId, data]) => ({
      requirementId: reqId,
      total: data.total,
      passed: data.passed,
      coverage: Math.round((data.passed / data.total) * 100),
    }));
  }
}
