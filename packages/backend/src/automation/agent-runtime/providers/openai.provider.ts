/**
 * OpenAI provider — ChatGPT API
 *
 * Supported models (May 2026):
 *   gpt-4o, gpt-4o-mini, gpt-4-turbo, o1, o3-mini
 *
 * Required env var: OPENAI_API_KEY
 *
 * Azure OpenAI:
 *   Set AZURE_OPENAI_KEY + AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_DEPLOYMENT
 *   and pass provider: "azure" in the agent profile config.
 */
import OpenAI from 'openai';
import { Logger } from '@nestjs/common';
import type { ILlmProvider, LlmMessage, LlmResponse } from './llm-provider.interface';

export class OpenAIProvider implements ILlmProvider {
  readonly name: string;
  private readonly client: OpenAI;
  private readonly logger = new Logger(OpenAIProvider.name);

  constructor(
    apiKey: string,
    private readonly defaultModel = 'gpt-4o',
    baseURL?: string,
    providerName = 'openai',
  ) {
    this.name = providerName;
    this.client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
  }

  async call(messages: LlmMessage[], signal?: AbortSignal): Promise<LlmResponse> {
    this.logger.debug(`OpenAI call: model=${this.defaultModel} messages=${messages.length}`);

    const response = await this.client.chat.completions.create(
      {
        model: this.defaultModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
      signal ? { signal } : undefined,
    );

    const content = response.choices[0]?.message?.content ?? '';

    return {
      content,
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      },
    };
  }
}
