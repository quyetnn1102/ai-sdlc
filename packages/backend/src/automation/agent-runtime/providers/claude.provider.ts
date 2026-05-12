/**
 * Claude provider — Anthropic API
 *
 * Supported models (May 2026):
 *   claude-opus-4-5, claude-sonnet-4-5, claude-haiku-3-5
 *
 * Required env var: ANTHROPIC_API_KEY
 */
import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import type { ILlmProvider, LlmMessage, LlmResponse } from './llm-provider.interface';

export class ClaudeProvider implements ILlmProvider {
  readonly name = 'claude';
  private readonly client: Anthropic;
  private readonly logger = new Logger(ClaudeProvider.name);

  constructor(
    apiKey: string,
    private readonly defaultModel = 'claude-sonnet-4-5',
    private readonly maxTokens = 8192,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async call(messages: LlmMessage[], signal?: AbortSignal): Promise<LlmResponse> {
    // Separate system message from conversation turns
    const systemMsg = messages.find((m) => m.role === 'system');
    const turns = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    this.logger.debug(`Claude call: model=${this.defaultModel} turns=${turns.length}`);

    const response = await this.client.messages.create(
      {
        model: this.defaultModel,
        max_tokens: this.maxTokens,
        ...(systemMsg ? { system: systemMsg.content } : {}),
        messages: turns,
      },
      signal ? { signal } : undefined,
    );

    const content =
      response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('') ?? '';

    return {
      content,
      model: response.model,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
    };
  }
}
