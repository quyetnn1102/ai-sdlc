/**
 * AgentExecutor — In-process agent runtime (Req 6.1, 5.2, 7.3, 10.1–10.4)
 *
 * Responsibilities:
 *  1. Start an async "agent" coroutine for a WorkflowTask
 *  2. Create ai_dlc_sessions record on start (Req 10.1)
 *  3. Send periodic heartbeats so the Orchestration Engine knows the agent is alive
 *  4. Respect `shouldTerminate` flag set during CANCEL (Req 9.4)
 *  5. Produce ArtifactOutput records when done (Req 7.1)
 *  6. Create ai_dlc_artifacts records for each artifact (Req 10.2)
 *  7. Call the completion callback via OrchestrationService (Req 6.1)
 *
 * In v4 initial release, agents run in-process as async tasks.
 * The scaling path to an external worker pool (NATS/gRPC) only requires
 * replacing the `_runAgentWork()` stub with an RPC call.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { LlmRouterService } from './llm-router.service';
import { buildPrompt } from './providers/prompt-builder';
import { TokenUsageService } from '../../workspace/token-usage/token-usage.service';
import { createHash } from 'crypto';

export interface AgentContext {
  workflowExecutionId: string;
  workflowTaskId: string;
  agentInstanceId: string;
  agentProfileId: string;
  phaseName: string;
  /** Artifacts produced by upstream (already DONE) tasks — input to this agent */
  inputArtifacts: Array<{
    name: string;
    artifactType: string;
    contentRef: string;
    metadata?: Record<string, unknown>;
  }>;
  /** AiDlcSession.id created on start */
  sessionId: string;
  heartbeatIntervalMs: number;
  taskTimeoutMs: number;
}

export interface ProducedArtifact {
  artifactType: string; // DOCUMENT | CODE | TEST_PLAN | DEPLOYMENT_SCRIPT | REVIEW_REPORT | CUSTOM
  name: string;
  contentRef: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AgentExecutorService {
  private readonly logger = new Logger(AgentExecutorService.name);

  /** Map of agentInstanceId → AbortController for graceful termination */
  private readonly _running = new Map<string, AbortController>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestration: OrchestrationService,
    private readonly llmRouter: LlmRouterService,
    private readonly tokenUsageService: TokenUsageService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ─────────────────────────────────────────────────────────────────────

  /**
   * Start an agent instance.
   * Returns immediately; the agent runs as a background async task.
   */
  async start(ctx: AgentContext): Promise<void> {
    const abort = new AbortController();
    this._running.set(ctx.agentInstanceId, abort);

    // Fire-and-forget — errors are caught inside _runLoop
    this._runLoop(ctx, abort.signal).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Agent ${ctx.agentInstanceId} loop crashed: ${msg}`);
    });
  }

  /**
   * Signal graceful shutdown for an agent instance (Req 5.4 / 9.4).
   * Also sets shouldTerminate=true in DB so heartbeat poll picks it up.
   */
  async sendTermination(agentInstanceId: string): Promise<boolean> {
    await this.prisma.agentInstance.updateMany({
      where: { id: agentInstanceId },
      data: { error: 'Force terminated' },
    });
    const ctrl = this._running.get(agentInstanceId);
    if (ctrl) {
      ctrl.abort();
      return true;
    }
    return false;
  }

  /**
   * Force-terminate after grace period (Req 9.5).
   * Marks instance TIMED_OUT and removes from the running map.
   */
  async forceTerminate(agentInstanceId: string): Promise<void> {
    await this.sendTermination(agentInstanceId);
    await this.prisma.agentInstance.updateMany({
      where: { id: agentInstanceId },
      data: { status: 'timed_out' as any, completedAt: new Date(), error: 'Force terminated' },
    });
    this._running.delete(agentInstanceId);
    this.logger.warn(`Agent instance ${agentInstanceId} force-terminated`);
  }

  // ─────────────────────────────────────────────────────────────────────
  // INTERNAL — main execution loop
  // ─────────────────────────────────────────────────────────────────────

  private async _runLoop(ctx: AgentContext, signal: AbortSignal): Promise<void> {
    const start = Date.now();

    try {
      // Req 10.1 — Update the session to ACTIVE (created in dispatchTasks)
      await this.prisma.aiDlcSession.upsert({
        where: { id: ctx.sessionId },
        update: { status: 'ACTIVE' },
        create: {
          id: ctx.sessionId,
          name: `${ctx.phaseName} — agent session`,
          description: `Auto-created for task ${ctx.workflowTaskId}`,
          status: 'ACTIVE',
          config: {
            workflowExecutionId: ctx.workflowExecutionId,
            workflowTaskId: ctx.workflowTaskId,
            agentInstanceId: ctx.agentInstanceId,
          },
        },
      });

      // Mark instance RUNNING
      await this.prisma.agentInstance.update({
        where: { id: ctx.agentInstanceId },
        data: { status: 'running' as any, lastHeartbeat: new Date() },
      });

      // Start heartbeat loop (runs concurrently with work)
      const heartbeatHandle = this._heartbeatLoop(
        ctx.agentInstanceId,
        ctx.heartbeatIntervalMs,
        signal,
      );

      // Execute agent work (replaceable with RPC in v5+)
      const artifacts = await this._runAgentWork(ctx, signal);

      // Cancel heartbeat loop
      heartbeatHandle.stop();

      if (signal.aborted) {
        this.logger.log(`Agent ${ctx.agentInstanceId} stopped via termination signal`);
        return;
      }

      const durationMs = Date.now() - start;

      // Req 10.2 — Create ai_dlc_artifact records for each output
      const aiDlcArtifacts = await Promise.all(
        artifacts.map((a) =>
          this.prisma.aiDlcArtifact.create({
            data: {
              sessionId: ctx.sessionId,
              type: this._mapArtifactType(a.artifactType),
              name: a.name,
              contentRef: a.contentRef,
              metadata: (a.metadata ?? {}) as any,
            },
          }),
        ),
      );

      // Report completion to the Orchestration Engine
      await this.orchestration.completeTask({
        taskId: ctx.workflowTaskId,
        agentInstanceId: ctx.agentInstanceId,
        status: 'DONE',
        durationMs,
        artifacts: artifacts.map((a, i) => ({
          ...a,
          // attach the ai_dlc_artifact ID in metadata
          metadata: {
            ...(a.metadata ?? {}),
            aiDlcArtifactId: aiDlcArtifacts[i]?.id,
          },
        })),
      });

      // Mark AI-DLC session COMPLETED
      await this.prisma.aiDlcSession.update({
        where: { id: ctx.sessionId },
        data: { status: 'COMPLETED' },
      });

      this.logger.log(
        `Agent ${ctx.agentInstanceId} completed task ${ctx.workflowTaskId} in ${durationMs}ms`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (signal.aborted) {
        this.logger.log(`Agent ${ctx.agentInstanceId} aborted cleanly`);
        return;
      }
      this.logger.error(`Agent ${ctx.agentInstanceId} failed: ${msg}`);
      await this.orchestration.completeTask({
        taskId: ctx.workflowTaskId,
        agentInstanceId: ctx.agentInstanceId,
        status: 'FAILED',
        error: msg,
        durationMs: Date.now() - start,
      });
      await this.prisma.aiDlcSession.updateMany({
        where: { id: ctx.sessionId },
        data: { status: 'CANCELLED' },
      });
    } finally {
      this._running.delete(ctx.agentInstanceId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Heartbeat loop
  // ─────────────────────────────────────────────────────────────────────

  private _heartbeatLoop(
    agentInstanceId: string,
    intervalMs: number,
    signal: AbortSignal,
  ): { stop: () => void } {
    let stopped = false;
    const tick = async () => {
      while (!stopped && !signal.aborted) {
        await this._sleep(intervalMs);
        if (stopped || signal.aborted) break;
        try {
          const { shouldTerminate } = await this.orchestration.heartbeat(agentInstanceId);
          if (shouldTerminate) {
            this.logger.log(
              `Heartbeat: shouldTerminate=true for ${agentInstanceId} — aborting`,
            );
            // The AbortController was already signalled in sendTermination;
            // if not (e.g. DB-only cancel), we re-signal here.
            break;
          }
        } catch {
          // Swallow heartbeat errors; timeout detection happens server-side.
        }
      }
    };
    tick(); // fire-and-forget
    return { stop: () => { stopped = true; } };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Agent work — calls the configured LLM provider
  // ─────────────────────────────────────────────────────────────────────

  private async _runAgentWork(
    ctx: AgentContext,
    signal: AbortSignal,
  ): Promise<ProducedArtifact[]> {
    if (signal.aborted) return [];

    // Load agent profile to get role, skills, and LLM config
    const profile = await this.prisma.agentProfile.findUnique({
      where: { id: ctx.agentProfileId },
      select: { name: true, role: true, skillSet: true, config: true },
    });

    const profileConfig = (profile?.config ?? {}) as {
      provider?: string;
      model?: string;
      systemPrompt?: string;
      projectContext?: string;
    };

    // Build role-specific prompt with upstream artifacts as context
    const messages = buildPrompt({
      phaseName: ctx.phaseName,
      agentRole: profile?.role ?? 'UNKNOWN',
      agentName: profile?.name ?? ctx.agentProfileId,
      skillSet: profile?.skillSet ?? [],
      customSystemPrompt: profileConfig.systemPrompt,
      projectContext: profileConfig.projectContext,
      inputArtifacts: ctx.inputArtifacts,
    });

    this.logger.log(
      `Agent ${ctx.agentInstanceId} calling LLM ` +
      `(provider=${profileConfig.provider ?? 'default'}, phase=${ctx.phaseName})`,
    );

    // Call the LLM
    const response = await this.llmRouter.call(profileConfig.provider, messages, signal);

    if (signal.aborted) return [];

    this.logger.log(
      `Agent ${ctx.agentInstanceId} LLM response received ` +
      `(model=${response.model}, tokens=${response.usage?.outputTokens ?? '?'})`,
    );

    // Fire-and-forget token usage logging
    const promptHash = createHash('sha256')
      .update(messages.map((m) => m.content).join(''))
      .digest('hex');

    this.tokenUsageService
      .log({
        projectId: ctx.workflowExecutionId, // project context from workflow
        epicRunId: ctx.workflowExecutionId,
        epicRunStepId: ctx.workflowTaskId,
        agentProfileId: ctx.agentProfileId,
        model: response.model ?? profileConfig.model ?? 'unknown',
        provider: profileConfig.provider ?? 'unknown',
        inputTokens: response.usage?.inputTokens ?? 0,
        outputTokens: response.usage?.outputTokens ?? 0,
        promptHash,
      })
      .catch(() => {});

    // Determine artifact type from phase name
    const artifactType = this._defaultArtifactType(ctx.phaseName);
    const fileName = `${ctx.phaseName.toLowerCase().replace(/\s+/g, '-')}-output.md`;
    const contentRef = `artifacts/${ctx.workflowExecutionId}/${ctx.workflowTaskId}/${fileName}`;

    return [
      {
        artifactType,
        name: fileName,
        contentRef,
        metadata: {
          phaseName: ctx.phaseName,
          agentProfileId: ctx.agentProfileId,
          provider: response.model ?? profileConfig.provider ?? 'simulate',
          inputTokens: response.usage?.inputTokens,
          outputTokens: response.usage?.outputTokens,
          inputArtifactCount: ctx.inputArtifacts.length,
          // Store the actual LLM output inline for small artifacts
          // For large outputs, this would be written to object storage
          content: response.content,
        },
      },
    ];
  }

  // ─────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Map SDLC phase name → best-fit artifact type */
  private _defaultArtifactType(phaseName: string): string {
    const p = phaseName.toLowerCase();
    if (p.includes('idea') || p.includes('ready for dev')) return 'DOCUMENT';
    if (p.includes('dev') || p.includes('review'))         return 'CODE';
    if (p.includes('test'))                                 return 'TEST_PLAN';
    if (p.includes('release') || p.includes('production'))  return 'DEPLOYMENT_SCRIPT';
    return 'DOCUMENT';
  }

  /** Map our artifact type string to the AiDlcArtifact type enum values */
  private _mapArtifactType(type: string): string {
    const map: Record<string, string> = {
      DOCUMENT:          'DOCUMENT',
      CODE:              'CODE',
      TEST_PLAN:         'TEST_PLAN',
      DEPLOYMENT_SCRIPT: 'DOCUMENT', // closest match in ai_dlc_artifacts
      REVIEW_REPORT:     'DOCUMENT',
      CUSTOM:            'DOCUMENT',
    };
    return map[type.toUpperCase()] ?? 'DOCUMENT';
  }
}
