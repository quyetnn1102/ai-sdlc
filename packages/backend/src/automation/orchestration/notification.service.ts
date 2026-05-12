/**
 * Notification Service — Agent Workflow Automation
 *
 * Dispatches in-app notifications for workflow lifecycle events:
 *   - Task permanently failed (retries exhausted)   → Req 6.4
 *   - Workflow execution blocked                     → Req 6.4
 *   - Workflow execution completed                   → Req 6.5
 *   - Agent needs clarification                      → Req 10.4
 *
 * Slack / Teams integration is wired here when env vars are present.
 * If SLACK_WEBHOOK_URL is not set the service logs only (graceful degradation).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

export type NotificationChannel = 'in_app' | 'slack' | 'teams';

export interface WorkflowNotification {
  type:
    | 'task_failed'
    | 'workflow_blocked'
    | 'workflow_completed'
    | 'agent_clarification';
  projectId: string;
  executionId: string;
  taskId?: string;
  recipientUserId?: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly slackWebhookUrl: string | undefined;
  private readonly teamsWebhookUrl: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.slackWebhookUrl  = this.config.get<string>('SLACK_WEBHOOK_URL');
    this.teamsWebhookUrl  = this.config.get<string>('TEAMS_WEBHOOK_URL');
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Req 6.4 — Task permanently failed after all retries exhausted */
  async notifyTaskFailed(opts: {
    projectId: string;
    executionId: string;
    taskId: string;
    phaseName: string;
    agentName: string;
    retryCount: number;
    error?: string;
  }) {
    const message =
      `❌ Agent task failed (${opts.retryCount} retries exhausted)\n` +
      `Phase: ${opts.phaseName} | Agent: ${opts.agentName}\n` +
      (opts.error ? `Error: ${opts.error}` : '');

    await this._dispatch({
      type: 'task_failed',
      projectId: opts.projectId,
      executionId: opts.executionId,
      taskId: opts.taskId,
      payload: { phaseName: opts.phaseName, agentName: opts.agentName, error: opts.error },
    }, message);
  }

  /** Req 6.4 — Workflow blocked (no eligible tasks, some failed) */
  async notifyWorkflowBlocked(opts: {
    projectId: string;
    executionId: string;
    reason: string;
  }) {
    const message =
      `🚫 Workflow execution blocked\n` +
      `Execution: ${opts.executionId}\n` +
      `Reason: ${opts.reason}`;

    await this._dispatch({
      type: 'workflow_blocked',
      projectId: opts.projectId,
      executionId: opts.executionId,
      payload: { reason: opts.reason },
    }, message);
  }

  /** Req 6.5 — Workflow execution completed (all tasks terminal) */
  async notifyWorkflowCompleted(opts: {
    projectId: string;
    executionId: string;
    doneCount: number;
    failedCount: number;
    durationMs?: number;
  }) {
    const status = opts.failedCount > 0 ? 'with failures' : 'successfully';
    const message =
      `✅ Workflow execution completed ${status}\n` +
      `Done: ${opts.doneCount} | Failed: ${opts.failedCount}\n` +
      (opts.durationMs ? `Duration: ${Math.round(opts.durationMs / 1000)}s` : '');

    await this._dispatch({
      type: 'workflow_completed',
      projectId: opts.projectId,
      executionId: opts.executionId,
      payload: {
        doneCount: opts.doneCount,
        failedCount: opts.failedCount,
        durationMs: opts.durationMs,
      },
    }, message);
  }

  /** Req 10.4 — Agent needs clarification from a team member */
  async notifyAgentClarification(opts: {
    projectId: string;
    executionId: string;
    taskId: string;
    question: string;
    recipientUserId?: string;
  }) {
    const message =
      `💬 Agent needs clarification\n` +
      `Task: ${opts.taskId}\n` +
      `Question: ${opts.question}`;

    await this._dispatch({
      type: 'agent_clarification',
      projectId: opts.projectId,
      executionId: opts.executionId,
      taskId: opts.taskId,
      recipientUserId: opts.recipientUserId,
      payload: { question: opts.question },
    }, message);
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async _dispatch(notification: WorkflowNotification, message: string) {
    // 1. Always log
    this.logger.log(`[${notification.type}] exec=${notification.executionId} — ${message.split('\n')[0]}`);

    // 2. Persist in-app notification (audit log as lightweight store)
    try {
      await this.prisma.auditLog.create({
        data: {
          action: `WORKFLOW_${notification.type.toUpperCase()}`,
          resource: `workflow_execution:${notification.executionId}`,
          details: notification.payload as any,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to persist notification: ${(err as Error).message}`);
    }

    // 3. Slack (if configured)
    if (this.slackWebhookUrl) {
      await this._sendSlack(message).catch((err) =>
        this.logger.warn(`Slack notification failed: ${(err as Error).message}`),
      );
    }

    // 4. Teams (if configured)
    if (this.teamsWebhookUrl) {
      await this._sendTeams(message).catch((err) =>
        this.logger.warn(`Teams notification failed: ${(err as Error).message}`),
      );
    }
  }

  private async _sendSlack(text: string): Promise<void> {
    const res = await fetch(this.slackWebhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      throw new Error(`Slack responded ${res.status}: ${await res.text()}`);
    }
  }

  private async _sendTeams(text: string): Promise<void> {
    // Teams Incoming Webhook uses the "MessageCard" format
    const body = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: text.split('\n')[0],
      sections: [{ text: text.replace(/\n/g, '<br>') }],
    };
    const res = await fetch(this.teamsWebhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Teams responded ${res.status}: ${await res.text()}`);
    }
  }
}
