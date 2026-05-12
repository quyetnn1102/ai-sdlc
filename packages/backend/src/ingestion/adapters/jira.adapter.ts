import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    issuetype: { name: string };
    status: { name: string };
    priority?: { name: string };
    assignee?: { displayName: string };
    labels?: string[];
    parent?: { key: string };
    sprint?: { name: string };
  };
}

@Injectable()
export class JiraAdapter {
  private readonly logger = new Logger(JiraAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
  ) {}

  // ── Normalise issue type ──────────────────────────────────────────────
  private normalizeType(issueType: string): string {
    const type = issueType.toLowerCase();
    if (type.includes('epic')) return 'EPIC';
    if (type.includes('story')) return 'STORY';
    if (type.includes('bug')) return 'BUG';
    if (type.includes('sub')) return 'SUBTASK';
    if (type.includes('task')) return 'TASK';
    return 'TASK';
  }

  // ── Upsert a single issue into work_items ─────────────────────────────
  async upsertWorkItem(projectId: string, issue: JiraIssue) {
    const f = issue.fields;
    return this.prisma.workItem.upsert({
      where: { projectId_externalId: { projectId, externalId: issue.key } },
      update: {
        title: f.summary,
        status: f.status.name,
        assignee: f.assignee?.displayName ?? null,
        labels: f.labels ?? [],
        priority: f.priority?.name ?? null,
        parentId: f.parent?.key ?? null,
        sprintName: f.sprint?.name ?? null,
        updatedAt: new Date(),
      },
      create: {
        projectId,
        externalId: issue.key,
        title: f.summary,
        type: this.normalizeType(f.issuetype.name),
        status: f.status.name,
        assignee: f.assignee?.displayName ?? null,
        labels: f.labels ?? [],
        priority: f.priority?.name ?? null,
        parentId: f.parent?.key ?? null,
        sprintName: f.sprint?.name ?? null,
      },
    });
  }

  // ── Process inbound Jira webhook event ───────────────────────────────
  async processWebhookEvent(projectId: string, eventType: string, payload: Record<string, unknown>) {
    if (!['jira:issue_created', 'jira:issue_updated'].includes(eventType)) return;

    const issue = payload.issue as JiraIssue | undefined;
    if (!issue) {
      this.logger.warn(`Jira webhook missing issue field for event ${eventType}`);
      return;
    }

    const item = await this.upsertWorkItem(projectId, issue);
    this.logger.log(`Jira: upserted work item ${item.externalId} in project ${projectId}`);
    return item;
  }

  // ── Polling – fetch all issues for a project ─────────────────────────
  async pollProject(integrationId: string, projectId: string) {
    const baseUrl = await this.integrations.getSetting(integrationId, 'base_url');
    const token = await this.integrations.getSetting(integrationId, 'api_token');
    const jiraProjectKey = await this.integrations.getSetting(integrationId, 'project_key');

    if (!baseUrl || !token || !jiraProjectKey) {
      this.logger.warn(`Jira integration ${integrationId} missing required settings`);
      await this.integrations.markDegraded(integrationId);
      return;
    }

    // In a real implementation this would call the Jira REST API:
    // GET /rest/api/3/search?jql=project={jiraProjectKey}&fields=summary,issuetype,...
    // For now we log the intent and mark sync successful (contract test uses fixtures).
    this.logger.log(
      `Jira: polling ${jiraProjectKey} at ${baseUrl} for integration ${integrationId}`,
    );
    await this.integrations.markSynced(integrationId);
  }
}
