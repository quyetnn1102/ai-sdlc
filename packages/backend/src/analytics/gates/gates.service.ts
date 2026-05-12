import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateGateDto } from './dto/create-gate.dto';

export interface RuleConfig {
  threshold?: number;     // for MIN_COVERAGE
  max?: number;           // for MAX_CRITICAL_ISSUES
  checkName?: string;     // for CI_CHECK_PASS
  severity?: string;      // for MAX_CRITICAL_ISSUES (CRITICAL | BLOCKER)
}

@Injectable()
export class GatesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────
  async create(projectId: string, dto: CreateGateDto) {
    return this.prisma.gateDefinition.create({
      data: {
        projectId,
        workflowPhaseId: dto.workflowPhaseId,
        name: dto.name,
        ruleType: dto.ruleType,
        ruleConfig: dto.ruleConfig as object,
        enforcement: dto.enforcement ?? 'ADVISORY',
      },
    });
  }

  async findByProject(projectId: string) {
    return this.prisma.gateDefinition.findMany({
      where: { projectId },
      include: {
        workflowPhase: { select: { id: true, name: true, order: true } },
        evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 1 },
      },
      orderBy: [{ workflowPhase: { order: 'asc' } }, { createdAt: 'asc' }],
    });
  }

  async findById(id: string) {
    const gate = await this.prisma.gateDefinition.findUnique({
      where: { id },
      include: {
        workflowPhase: true,
        evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 5 },
      },
    });
    if (!gate) throw new NotFoundException('Gate definition not found');
    return gate;
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.gateDefinition.delete({ where: { id } });
  }

  // ── Evaluation engine ─────────────────────────────────────────────────
  /**
   * Evaluate all gates for a project when a new build arrives.
   * Returns a summary with pass/fail per gate.
   */
  async evaluateForBuild(projectId: string, buildId: string) {
    const build = await this.prisma.build.findUnique({
      where: { id: buildId },
      include: { qualityReports: true },
    });
    if (!build) throw new NotFoundException('Build not found');

    const gates = await this.prisma.gateDefinition.findMany({ where: { projectId } });
    const results: Array<{ gateId: string; gateName: string; status: string; details: object }> = [];

    for (const gate of gates) {
      const config = gate.ruleConfig as RuleConfig;
      let status = 'PENDING';
      let details: object = {};

      switch (gate.ruleType) {
        case 'MIN_COVERAGE': {
          const report = build.qualityReports.find((r) => r.coverage !== null);
          if (report) {
            const coverage = report.coverage!;
            const threshold = config.threshold ?? 80;
            status = coverage >= threshold ? 'PASS' : 'FAIL';
            details = { coverage, threshold, source: report.source };
          }
          break;
        }
        case 'MAX_CRITICAL_ISSUES': {
          const report = build.qualityReports[0];
          if (report?.issues) {
            const issues = report.issues as Record<string, number>;
            const sev = (config.severity ?? 'critical').toLowerCase();
            const count = issues[sev] ?? 0;
            const max = config.max ?? 0;
            status = count <= max ? 'PASS' : 'FAIL';
            details = { count, max, severity: sev, source: report.source };
          }
          break;
        }
        case 'CI_CHECK_PASS': {
          const checkName = config.checkName ?? '';
          // For demonstration: PASS if build status is SUCCESS and name matches
          const match = !checkName || build.name?.includes(checkName);
          status = build.status === 'SUCCESS' && match ? 'PASS' : 'FAIL';
          details = { buildStatus: build.status, checkName, matched: match };
          break;
        }
        default:
          status = 'PENDING';
      }

      // Persist evaluation
      await this.prisma.gateEvaluation.create({
        data: { gateDefinitionId: gate.id, buildId, status, details },
      });

      results.push({ gateId: gate.id, gateName: gate.name, status, details });
    }

    return { buildId, projectId, results };
  }

  /**
   * Get the latest evaluation status for each gate in a project.
   */
  async latestStatus(projectId: string) {
    const gates = await this.prisma.gateDefinition.findMany({
      where: { projectId },
      include: {
        evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 1 },
        workflowPhase: { select: { name: true, order: true } },
      },
    });

    return gates.map((g) => ({
      id: g.id,
      name: g.name,
      phase: g.workflowPhase.name,
      ruleType: g.ruleType,
      enforcement: g.enforcement,
      latestStatus: g.evaluations[0]?.status ?? 'PENDING',
      lastEvaluated: g.evaluations[0]?.evaluatedAt ?? null,
    }));
  }
}
