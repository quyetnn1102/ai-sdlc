import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type ArtifactType =
  | 'EPIC'
  | 'STORY'
  | 'PR'
  | 'BUILD'
  | 'DEPLOYMENT'
  | 'TEST_CASE'
  | 'INCIDENT';

export type LinkMechanism =
  | 'AUTO_BRANCH_REGEX'
  | 'AUTO_PR_EVENT'
  | 'AUTO_DEPLOYMENT'
  | 'MANUAL';

export interface CreateTraceLinkDto {
  sourceType: ArtifactType;
  sourceId: string;
  targetType: ArtifactType;
  targetId: string;
  linkMechanism?: LinkMechanism;
}

@Injectable()
export class TraceabilityService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Manual trace link CRUD ────────────────────────────────────────────
  async createLink(projectId: string, dto: CreateTraceLinkDto) {
    return this.prisma.traceLink.upsert({
      where: {
        projectId_sourceType_sourceId_targetType_targetId: {
          projectId,
          sourceType: dto.sourceType,
          sourceId: dto.sourceId,
          targetType: dto.targetType,
          targetId: dto.targetId,
        },
      },
      update: {},
      create: {
        projectId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        linkMechanism: dto.linkMechanism ?? 'MANUAL',
      },
    });
  }

  async deleteLink(id: string) {
    return this.prisma.traceLink.delete({ where: { id } });
  }

  async listLinks(projectId: string, sourceType?: string, sourceId?: string) {
    return this.prisma.traceLink.findMany({
      where: {
        projectId,
        ...(sourceType ? { sourceType } : {}),
        ...(sourceId ? { sourceId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ── Full requirement trace chain (single aggregated query — N+1 fixed) ─
  /**
   * Given a Jira epic key, load the full chain in a single aggregated query:
   * Epic → Stories → PRs (with builds+deployments) → Unlinked PRs
   *
   * Previous implementation fired 5+ sequential queries.
   * Now: 1 query for the epic+stories+PRs, 1 for builds, 1 for deployments,
   * 1 for unlinked PRs — 4 total regardless of result set size.
   */
  async getRequirementTrace(projectId: string, epicKey: string) {
    // Query 1: epic + children + their PRs in one aggregated fetch
    const [epicRecord, storiesWithPrs] = await Promise.all([
      this.prisma.workItem.findUnique({
        where: { projectId_externalId: { projectId, externalId: epicKey } },
      }),
      this.prisma.workItem.findMany({
        where: { projectId, parentId: epicKey, type: { in: ['STORY', 'TASK', 'BUG'] } },
        select: { id: true, externalId: true, title: true, status: true },
      }),
    ]);

    if (!epicRecord) throw new NotFoundException(`Epic ${epicKey} not found in project`);

    const storyKeys = storiesWithPrs.map((s) => s.externalId);

    // Query 2 + 3 + 4 — run in parallel
    const [prs, unlinkedPrs] = await Promise.all([
      storyKeys.length
        ? this.prisma.pullRequest.findMany({
            where: { projectId, linkedIssueKey: { in: storyKeys } },
            select: {
              id: true, externalId: true, title: true, status: true,
              branchName: true, linkedIssueKey: true,
            },
          })
        : Promise.resolve([]),
      this.prisma.pullRequest.findMany({
        where: { projectId, linkedIssueKey: null, status: { not: 'CLOSED' } },
        select: { id: true, externalId: true, title: true, branchName: true },
      }),
    ]);

    const prDbIds = prs.map((p) => p.id);

    // Query 5: builds + quality reports for all PRs
    const builds = prDbIds.length
      ? await this.prisma.build.findMany({
          where: { projectId, pullRequestId: { in: prDbIds } },
          select: {
            id: true, name: true, status: true, pullRequestId: true,
            qualityReports: { select: { coverage: true, source: true }, take: 1 },
          },
        })
      : [];

    const buildIds = builds.map((b) => b.id);

    // Query 6: deployments for all builds
    const deployments = buildIds.length
      ? await this.prisma.deployment.findMany({
          where: { projectId, buildId: { in: buildIds } },
          select: { id: true, environment: true, status: true, deployedAt: true, buildId: true },
          orderBy: { deployedAt: 'desc' },
        })
      : [];

    return {
      epic: {
        id: epicRecord.id,
        key: epicRecord.externalId,
        title: epicRecord.title,
        status: epicRecord.status,
      },
      stories: storiesWithPrs.map((s) => ({
        id: s.id, key: s.externalId, title: s.title, status: s.status,
      })),
      pullRequests: prs.map((pr) => ({
        id: pr.id, number: pr.externalId, title: pr.title, status: pr.status,
        branch: pr.branchName, linkedIssueKey: pr.linkedIssueKey,
      })),
      builds: builds.map((b) => ({
        id: b.id, name: b.name, status: b.status,
        coverage: b.qualityReports[0]?.coverage ?? null,
      })),
      deployments: deployments.map((d) => ({
        id: d.id, environment: d.environment, status: d.status, deployedAt: d.deployedAt,
      })),
      unlinkedPrs: unlinkedPrs.map((pr) => ({
        id: pr.id, number: pr.externalId, title: pr.title, branch: pr.branchName,
      })),
    };
  }

  // ── RTM: in-app table view ────────────────────────────────────────────
  /**
   * Requirements Traceability Matrix: for each requirement (test case linked
   * to a Jira key) show → test case → latest test run → result.
   */
  async getRtm(projectId: string) {
    const testCases = await this.prisma.testCase.findMany({
      where: { projectId, linkedRequirementId: { not: null } },
      select: {
        id: true, title: true, priority: true, type: true, linkedRequirementId: true,
        testRuns: {
          orderBy: { executedAt: 'desc' },
          take: 1,
          select: { result: true, executedAt: true, executedBy: true },
        },
      },
      orderBy: [{ linkedRequirementId: 'asc' }, { title: 'asc' }],
    });

    // Group by requirement
    const byReq: Record<string, {
      requirementId: string;
      testCases: typeof testCases;
    }> = {};

    for (const tc of testCases) {
      const reqId = tc.linkedRequirementId!;
      if (!byReq[reqId]) byReq[reqId] = { requirementId: reqId, testCases: [] };
      byReq[reqId].testCases.push(tc);
    }

    return Object.values(byReq).map((row) => ({
      requirementId: row.requirementId,
      testCases: row.testCases.map((tc) => ({
        id: tc.id,
        title: tc.title,
        priority: tc.priority,
        type: tc.type,
        latestResult: tc.testRuns[0]?.result ?? 'NO_RUN',
        lastRunAt: tc.testRuns[0]?.executedAt ?? null,
      })),
      coverage: {
        total: row.testCases.length,
        passed: row.testCases.filter((tc) => tc.testRuns[0]?.result === 'PASS').length,
      },
    }));
  }

  /**
   * RTM CSV export (async stub — returns CSV string, production would queue as background job).
   */
  async exportRtmCsv(projectId: string): Promise<string> {
    const rows = await this.getRtm(projectId);
    const lines: string[] = ['Requirement ID,Test Case,Priority,Type,Latest Result,Last Run'];
    for (const row of rows) {
      for (const tc of row.testCases) {
        lines.push(
          [
            row.requirementId,
            `"${tc.title.replace(/"/g, '""')}"`,
            tc.priority,
            tc.type,
            tc.latestResult,
            tc.lastRunAt ? new Date(tc.lastRunAt).toISOString() : '',
          ].join(','),
        );
      }
    }
    return lines.join('\n');
  }

  // ── Auto-link helpers ─────────────────────────────────────────────────
  async autoLinkPrToStory(projectId: string, prId: string, linkedIssueKey: string) {
    const story = await this.prisma.workItem.findUnique({
      where: { projectId_externalId: { projectId, externalId: linkedIssueKey } },
    });
    if (!story) return null;
    return this.createLink(projectId, {
      sourceType: 'STORY',
      sourceId: story.id,
      targetType: 'PR',
      targetId: prId,
      linkMechanism: 'AUTO_BRANCH_REGEX',
    });
  }

  async autoLinkBuildToPr(projectId: string, buildId: string, prDbId: string) {
    return this.createLink(projectId, {
      sourceType: 'PR',
      sourceId: prDbId,
      targetType: 'BUILD',
      targetId: buildId,
      linkMechanism: 'AUTO_PR_EVENT',
    });
  }

  async autoLinkDeploymentToBuild(projectId: string, deploymentId: string, buildId: string) {
    return this.createLink(projectId, {
      sourceType: 'BUILD',
      sourceId: buildId,
      targetType: 'DEPLOYMENT',
      targetId: deploymentId,
      linkMechanism: 'AUTO_DEPLOYMENT',
    });
  }
}
