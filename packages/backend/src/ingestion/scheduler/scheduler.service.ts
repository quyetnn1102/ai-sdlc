import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JiraAdapter } from '../adapters/jira.adapter';
import { SonarQubeAdapter } from '../adapters/sonarqube.adapter';
import { GitHubAdapter } from '../adapters/github.adapter';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jira: JiraAdapter,
    private readonly sonarqube: SonarQubeAdapter,
    private readonly github: GitHubAdapter,
  ) {}

  /**
   * Poll all active integrations.
   * Called via a cron job in production (e.g. every 15 minutes).
   * In v1 this is driven by a simple interval; v2 replaces with NATS/Kafka.
   */
  async pollAll() {
    this.logger.log('Scheduler: starting poll cycle');

    const integrations = await this.prisma.integration.findMany({
      where: { status: { in: ['ACTIVE', 'DEGRADED'] } },
    });

    const results = await Promise.allSettled(
      integrations.map((integration) =>
        this.pollIntegration(integration.id, integration.projectId, integration.type),
      ),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    this.logger.log(`Scheduler: poll complete — ${succeeded} succeeded, ${failed} failed`);
    return { succeeded, failed, total: integrations.length };
  }

  private async pollIntegration(integrationId: string, projectId: string, type: string) {
    try {
      switch (type) {
        case 'JIRA':
          await this.jira.pollProject(integrationId, projectId);
          break;
        case 'SONARQUBE':
          await this.sonarqube.pollProject(integrationId, projectId);
          break;
        case 'GITHUB':
          // GitHub relies primarily on webhooks; polling is a fallback.
          this.logger.debug(`GitHub polling fallback for integration ${integrationId}`);
          break;
        default:
          this.logger.debug(`No poller for type ${type}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Poll failed for integration ${integrationId}: ${msg}`);
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { status: 'DEGRADED' },
      });
      throw err;
    }
  }
}
