/**
 * LLM Router Service
 *
 * Resolves the correct LLM provider based on the agent profile config
 * and environment variables. Supports:
 *   - claude   → Anthropic API  (ANTHROPIC_API_KEY)
 *   - openai   → OpenAI API     (OPENAI_API_KEY)
 *   - azure    → Azure OpenAI   (AZURE_OPENAI_KEY + AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_DEPLOYMENT)
 *   - simulate → No API call, returns a placeholder (default when no keys set)
 *
 * Provider selection priority:
 *   1. agent profile config.provider field
 *   2. DEFAULT_LLM_PROVIDER env var
 *   3. First available provider based on which API keys are set
 *   4. "simulate" fallback (no real LLM call)
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ILlmProvider, LlmMessage, LlmResponse } from './providers/llm-provider.interface';
import { ClaudeProvider } from './providers/claude.provider';
import { OpenAIProvider } from './providers/openai.provider';

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);
  private readonly providers = new Map<string, ILlmProvider>();
  private readonly defaultProvider: string;

  constructor(private readonly config: ConfigService) {
    // Register Claude if key is present
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      const model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5';
      this.providers.set('claude', new ClaudeProvider(anthropicKey, model));
      this.logger.log(`LLM provider registered: claude (model=${model})`);
    }

    // Register OpenAI if key is present
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      const model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o';
      this.providers.set('openai', new OpenAIProvider(openaiKey, model));
      this.logger.log(`LLM provider registered: openai (model=${model})`);
    }

    // Register Azure OpenAI if configured (GitHub Copilot uses Azure under the hood)
    const azureKey      = this.config.get<string>('AZURE_OPENAI_KEY');
    const azureEndpoint = this.config.get<string>('AZURE_OPENAI_ENDPOINT');
    const azureDeployment = this.config.get<string>('AZURE_OPENAI_DEPLOYMENT') ?? 'gpt-4o';
    if (azureKey && azureEndpoint) {
      const baseURL = `${azureEndpoint}/openai/deployments/${azureDeployment}`;
      this.providers.set(
        'azure',
        new OpenAIProvider(azureKey, azureDeployment, baseURL, 'azure'),
      );
      this.logger.log(`LLM provider registered: azure (deployment=${azureDeployment})`);
    }

    // Determine default provider
    const envDefault = this.config.get<string>('DEFAULT_LLM_PROVIDER');
    if (envDefault && this.providers.has(envDefault)) {
      this.defaultProvider = envDefault;
    } else if (this.providers.size > 0) {
      this.defaultProvider = [...this.providers.keys()][0];
    } else {
      this.defaultProvider = 'simulate';
      this.logger.warn(
        'No LLM API keys configured — agents will run in simulation mode. ' +
        'Set ANTHROPIC_API_KEY or OPENAI_API_KEY to enable real LLM calls.',
      );
    }

    this.logger.log(`Default LLM provider: ${this.defaultProvider}`);
  }

  /**
   * Route a call to the appropriate provider.
   * Falls back to simulation if the requested provider is not available.
   */
  async call(
    providerName: string | undefined,
    messages: LlmMessage[],
    signal?: AbortSignal,
  ): Promise<LlmResponse> {
    const name = providerName ?? this.defaultProvider;
    const provider = this.providers.get(name);

    if (!provider) {
      if (name !== 'simulate') {
        this.logger.warn(
          `Provider "${name}" not available (missing API key?). Falling back to simulation.`,
        );
      }
      return this._simulate(messages);
    }

    return provider.call(messages, signal);
  }

  /** List registered provider names (for health checks / UI) */
  availableProviders(): string[] {
    const names = [...this.providers.keys()];
    return names.length > 0 ? names : ['simulate'];
  }

  getDefaultProvider(): string {
    return this.defaultProvider;
  }

  // ── Simulation fallback ───────────────────────────────────────────────

  private _simulate(messages: LlmMessage[]): LlmResponse {
    const userMsg = messages.find((m) => m.role === 'user')?.content ?? '';
    const phaseMatch = userMsg.match(/\*\*SDLC Phase\*\*:\s*(.+)/);
    const phase = phaseMatch?.[1]?.trim() ?? 'Unknown Phase';

    return {
      content: [
        `# ${phase} — Agent Output (Simulation)`,
        '',
        '> **Note**: This is a simulated output. Configure `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to enable real LLM-generated content.',
        '',
        '## Overview',
        `This document covers the **${phase}** phase of the SDLC workflow.`,
        '',
        '## Key Deliverables',
        '- [ ] Deliverable 1',
        '- [ ] Deliverable 2',
        '- [ ] Deliverable 3',
        '',
        '## Notes',
        'Replace this simulation with a real LLM provider to generate meaningful content.',
      ].join('\n'),
      model: 'simulation',
      usage: { inputTokens: 0, outputTokens: 0 },
    };
  }
}
