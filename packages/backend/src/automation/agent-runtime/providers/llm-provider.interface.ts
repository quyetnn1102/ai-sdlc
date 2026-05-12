/**
 * Common interface every LLM provider must implement.
 * Keeps the router and executor decoupled from specific SDKs.
 */
export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmResponse {
  content: string;
  /** Provider-reported token usage (optional — for observability) */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  /** Raw model identifier returned by the provider */
  model?: string;
}

export interface ILlmProvider {
  readonly name: string;
  call(messages: LlmMessage[], signal?: AbortSignal): Promise<LlmResponse>;
}
