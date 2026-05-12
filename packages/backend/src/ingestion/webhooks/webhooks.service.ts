import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { GitHubAdapter } from '../adapters/github.adapter';
import { JiraAdapter } from '../adapters/jira.adapter';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly github: GitHubAdapter,
    private readonly jira: JiraAdapter,
  ) {}

  // ── Store raw event record ────────────────────────────────────────────
  private async storeEvent(
    source: string,
    eventType: string,
    payload: Record<string, unknown>,
    externalId?: string,
  ) {
    return this.prisma.webhookEvent.create({
      data: { source, eventType, payload, externalId },
    });
  }

  // ── Mark event as processed or failed ────────────────────────────────
  private async markEvent(id: string, status: 'PROCESSED' | 'FAILED', error?: string) {
    return this.prisma.webhookEvent.update({
      where: { id },
      data: { status, error, processedAt: new Date() },
    });
  }

  // ── Find the GitHub integration for a project ─────────────────────────
  private async findIntegrationByType(projectId: string, type: string) {
    return this.prisma.integration.findFirst({
      where: { projectId, type },
      include: { settings: true },
    });
  }

  // ── Handle GitHub webhook ─────────────────────────────────────────────
  async handleGitHub(
    projectId: string,
    eventType: string,
    signature: string,
    rawBody: Buffer,
    payload: Record<string, unknown>,
  ) {
    const externalId = (payload.delivery ?? payload.id) as string | undefined;
    const event = await this.storeEvent('GITHUB', eventType, payload, externalId);

    try {
      // Signature verification
      const integration = await this.findIntegrationByType(projectId, 'GITHUB');
      if (integration) {
        const secret = await this.integrations.getSetting(integration.id, 'webhook_secret');
        if (secret && signature) {
          const valid = this.github.verifySignature(rawBody, signature, secret);
          if (!valid) {
            await this.markEvent(event.id, 'FAILED', 'Invalid HMAC signature');
            throw new UnauthorizedException('Invalid webhook signature');
          }
        }
      }

      await this.github.processWebhookEvent(projectId, eventType, payload);
      await this.markEvent(event.id, 'PROCESSED');
      this.logger.log(`GitHub webhook processed: ${eventType} for project ${projectId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.markEvent(event.id, 'FAILED', msg);
      throw err;
    }
  }

  // ── Handle Jira webhook ───────────────────────────────────────────────
  async handleJira(
    projectId: string,
    eventType: string,
    _signature: string,
    payload: Record<string, unknown>,
  ) {
    const event = await this.storeEvent('JIRA', eventType, payload);

    try {
      await this.jira.processWebhookEvent(projectId, eventType, payload);
      await this.markEvent(event.id, 'PROCESSED');
      this.logger.log(`Jira webhook processed: ${eventType} for project ${projectId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.markEvent(event.id, 'FAILED', msg);
      throw err;
    }
  }
}
