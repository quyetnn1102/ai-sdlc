import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';

interface GitHubPRPayload {
  number: number;
  title: string;
  html_url: string;
  state: string;
  head: { ref: string; sha: string };
  user?: { login: string };
  merged_at?: string | null;
}

interface GitHubWorkflowRunPayload {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_branch: string;
  head_sha: string;
  pull_requests?: Array<{ number: number }>;
  run_started_at?: string;
  updated_at?: string;
  run_duration_ms?: number;
}

interface GitHubDeploymentPayload {
  id: number;
  environment: string;
  sha: string;
}

interface GitHubDeploymentStatusPayload {
  state: string;
  deployment: GitHubDeploymentPayload;
  created_at: string;
}

@Injectable()
export class GitHubAdapter {
  private readonly logger = new Logger(GitHubAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  // ── HMAC-SHA256 signature verification ───────────────────────────────
  verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  // ── Extract Jira issue key from branch name ───────────────────────────
  extractIssueKey(branchName: string): string | null {
    const match = branchName.match(/([A-Z][A-Z0-9]+-\d+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  // ── Upsert pull request ───────────────────────────────────────────────
  async upsertPullRequest(projectId: string, pr: GitHubPRPayload) {
    const linkedIssueKey = this.extractIssueKey(pr.head.ref);
    const statusMap: Record<string, string> = { open: 'OPEN', closed: 'CLOSED' };
    const status = pr.merged_at ? 'MERGED' : (statusMap[pr.state] ?? pr.state.toUpperCase());

    return this.prisma.pullRequest.upsert({
      where: { projectId_externalId: { projectId, externalId: String(pr.number) } },
      update: {
        title: pr.title,
        status,
        linkedIssueKey,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
        updatedAt: new Date(),
      },
      create: {
        projectId,
        externalId: String(pr.number),
        externalUrl: pr.html_url,
        title: pr.title,
        branchName: pr.head.ref,
        status,
        author: pr.user?.login ?? null,
        linkedIssueKey,
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
      },
    });
  }

  // ── Upsert build (workflow run) ───────────────────────────────────────
  async upsertBuild(projectId: string, run: GitHubWorkflowRunPayload) {
    const statusMap: Record<string, string> = {
      success: 'SUCCESS',
      failure: 'FAILURE',
      cancelled: 'CANCELLED',
      in_progress: 'IN_PROGRESS',
    };
    const status = statusMap[run.conclusion ?? run.status] ?? 'IN_PROGRESS';

    // Find linked PR if any
    let pullRequestDbId: string | null = null;
    if (run.pull_requests?.length) {
      const pr = await this.prisma.pullRequest.findUnique({
        where: {
          projectId_externalId: {
            projectId,
            externalId: String(run.pull_requests[0].number),
          },
        },
      });
      pullRequestDbId = pr?.id ?? null;
    }

    return this.prisma.build.upsert({
      where: { projectId_externalId: { projectId, externalId: String(run.id) } },
      update: {
        status,
        updatedAt: new Date(),
        finishedAt: run.updated_at ? new Date(run.updated_at) : null,
      },
      create: {
        projectId,
        externalId: String(run.id),
        externalUrl: run.html_url,
        name: run.name,
        status,
        branch: run.head_branch,
        commitSha: run.head_sha,
        pullRequestId: pullRequestDbId,
        startedAt: run.run_started_at ? new Date(run.run_started_at) : null,
        finishedAt: run.updated_at ? new Date(run.updated_at) : null,
      },
    });
  }

  // ── Upsert deployment ─────────────────────────────────────────────────
  async upsertDeployment(projectId: string, deploymentStatus: GitHubDeploymentStatusPayload) {
    const { deployment, state, created_at } = deploymentStatus;
    const statusMap: Record<string, string> = {
      success: 'SUCCESS',
      failure: 'FAILURE',
      in_progress: 'IN_PROGRESS',
    };
    const status = statusMap[state] ?? state.toUpperCase();

    return this.prisma.deployment.upsert({
      where: {
        projectId_externalId: {
          projectId,
          externalId: String(deployment.id),
        },
      } as Parameters<typeof this.prisma.deployment.upsert>[0]['where'],
      update: { status },
      create: {
        projectId,
        externalId: String(deployment.id),
        environment: deployment.environment,
        status,
        commitSha: deployment.sha,
        deployedAt: new Date(created_at),
      },
    });
  }

  // ── Dispatch incoming webhook event ──────────────────────────────────
  async processWebhookEvent(
    projectId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    switch (eventType) {
      case 'pull_request': {
        const pr = payload.pull_request as GitHubPRPayload;
        if (!pr) break;
        const saved = await this.upsertPullRequest(projectId, pr);
        this.logger.log(`GitHub: upserted PR #${saved.externalId} in project ${projectId}`);
        break;
      }
      case 'workflow_run': {
        const run = payload.workflow_run as GitHubWorkflowRunPayload;
        if (!run) break;
        const build = await this.upsertBuild(projectId, run);
        this.logger.log(`GitHub: upserted build ${build.externalId} in project ${projectId}`);
        break;
      }
      case 'deployment_status': {
        const ds = payload as unknown as GitHubDeploymentStatusPayload;
        const dep = await this.upsertDeployment(projectId, ds);
        this.logger.log(
          `GitHub: upserted deployment ${dep.externalId} env:${dep.environment}`,
        );
        break;
      }
      default:
        this.logger.debug(`GitHub: unhandled event type ${eventType}`);
    }
  }
}
