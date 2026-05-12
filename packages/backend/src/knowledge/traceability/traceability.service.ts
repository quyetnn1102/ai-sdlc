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

  // ── Full requirement trace chain ──────────────────────────────────────
  /**
   * Given a Jira epic key, traverse the full trace chain:
   * Epic → Stories → PRs → Builds → Deployments
   * Returns each hop with its status so the UI can render the chain.
   */
  async getRequirementTrace(projectId: string, epicKey: string) {
    // Hop 1: Epic
    const epic = await this.prisma.workItem.findUnique({
      where: { projectId_externalId: { projectId, externalId: epicKey } },
    });
    if (!epic) throw new NotFoundException(`Epic ${epicKey} not found in project`);

    // Hop 2: Stories (children of epic)
    const stories = await this.prisma.workItem.findMany({
      where: { projectId, parentId: epicKey, type: { in: ['STORY', 'TASK', 'BUG'] } },
    });

    // Hop 3: PRs linked to any story key
    const storyKeys = stories.map((s) => s.externalId);
    const prs = storyKeys.length
      ? await this.prisma.pullRequest.findMany({
          where: { projectId, linkedIssueKey: { in: storyKeys } },
        })
      : [];

    // Hop 4: Builds for those PRs
    const prDbIds = prs.map((p) => p.id);
    const builds = prDbIds.length
      ? await this.prisma.build.findMany({
          where: { projectId, pullRequestId: { in: prDbIds } },
          include: { qualityReports: { select: { coverage: true, source: true } } },
        })
      : [];

    // Hop 5: Deployments from those builds
    const buildIds = builds.map((b) => b.id);
    const deployments = buildIds.length
      ? await this.prisma.deployment.findMany({
          where: { projectId, buildId: { in: buildIds } },
          orderBy: { deployedAt: 'desc' },
        })
      : [];

    // Unlinked PRs: PRs in this project where linkedIssueKey could not be parsed
    const unlinkedPrs = await this.prisma.pullRequest.findMany({
      where: { projectId, linkedIssueKey: null, status: { not: 'CLOSED' } },
    });

    return {
      epic: { id: epic.id, key: epic.externalId, title: epic.title, status: epic.status },
      stories: stories.map((s) => ({
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

  // ── Auto-link builder: called after every PR/Build/Deployment upsert ──
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
