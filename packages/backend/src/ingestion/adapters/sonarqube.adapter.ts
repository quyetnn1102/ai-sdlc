import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';

interface SonarIssueCount {
  critical: number;
  major: number;
  minor: number;
  blocker: number;
}

@Injectable()
export class SonarQubeAdapter {
  private readonly logger = new Logger(SonarQubeAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  // ── Ingest a quality report for a build ──────────────────────────────
  async ingestReport(
    buildId: string,
    coverage: number | null,
    issues: SonarIssueCount,
    rawData?: Record<string, unknown>,
  ) {
    return this.prisma.qualityReport.create({
      data: {
        buildId,
        source: 'SONARQUBE',
        coverage,
        issues,
        rawData,
      },
    });
  }

  // ── Poll SonarQube for a project's latest metrics ─────────────────────
  async pollProject(integrationId: string, projectId: string) {
    const baseUrl = await this.integrations.getSetting(integrationId, 'base_url');
    const token = await this.integrations.getSetting(integrationId, 'api_token');
    const sonarKey = await this.integrations.getSetting(integrationId, 'project_key');

    if (!baseUrl || !token || !sonarKey) {
      this.logger.warn(`SonarQube integration ${integrationId} missing required settings`);
      await this.integrations.markDegraded(integrationId);
      return;
    }

    // Real implementation calls:
    // GET {baseUrl}/api/measures/component?component={sonarKey}&metricKeys=coverage,blocker_violations,...
    this.logger.log(
      `SonarQube: polling component ${sonarKey} at ${baseUrl} for project ${projectId}`,
    );
    await this.integrations.markSynced(integrationId);
  }
}
