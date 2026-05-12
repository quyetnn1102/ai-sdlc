import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CreateTestPlanDto {
  name: string;
  description?: string;
  sprintName?: string;
  testCaseIds?: string[];
}

@Injectable()
export class TestPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateTestPlanDto) {
    return this.prisma.testPlan.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        sprintName: dto.sprintName,
        testCaseIds: dto.testCaseIds ?? [],
        status: 'DRAFT',
      },
    });
  }

  async findByProject(projectId: string) {
    return this.prisma.testPlan.findMany({
      where: { projectId },
      include: {
        testRuns: {
          include: { testCase: { select: { id: true, title: true, priority: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const plan = await this.prisma.testPlan.findUnique({
      where: { id },
      include: {
        testRuns: {
          include: { testCase: true },
          orderBy: { executedAt: 'desc' },
        },
      },
    });
    if (!plan) throw new NotFoundException('Test plan not found');
    return plan;
  }

  async update(id: string, dto: Partial<CreateTestPlanDto> & { status?: string }) {
    await this.findById(id);
    return this.prisma.testPlan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.sprintName !== undefined ? { sprintName: dto.sprintName } : {}),
        ...(dto.testCaseIds !== undefined ? { testCaseIds: dto.testCaseIds } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.testPlan.delete({ where: { id } });
  }

  // ── Summary: pass/fail/blocked counts for a plan ─────────────────────
  async summary(planId: string) {
    const plan = await this.findById(planId);
    const counts: Record<string, number> = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIP: 0, PENDING: 0 };

    // For each linked test case, get latest run result
    for (const tcId of plan.testCaseIds) {
      const latestRun = plan.testRuns.find((r) => r.testCaseId === tcId);
      const result = latestRun?.result ?? 'PENDING';
      counts[result] = (counts[result] ?? 0) + 1;
    }

    const total = plan.testCaseIds.length;
    return { planId, total, counts, completionPct: total
      ? Math.round(((counts.PASS + counts.FAIL + counts.BLOCKED + counts.SKIP) / total) * 100)
      : 0 };
  }
}
