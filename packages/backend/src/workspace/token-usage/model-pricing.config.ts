import { Logger } from '@nestjs/common';

const logger = new Logger('ModelPricing');

export interface ModelPricing {
  model: string;
  provider: string;
  inputPricePerToken: number;
  outputPricePerToken: number;
}

export const MODEL_PRICING: ModelPricing[] = [
  {
    model: 'claude-sonnet-4-5',
    provider: 'claude',
    inputPricePerToken: 0.000003, // $3 per 1M tokens
    outputPricePerToken: 0.000015, // $15 per 1M tokens
  },
  {
    model: 'claude-3-haiku',
    provider: 'claude',
    inputPricePerToken: 0.00000025, // $0.25 per 1M tokens
    outputPricePerToken: 0.00000125, // $1.25 per 1M tokens
  },
  {
    model: 'gpt-4o',
    provider: 'openai',
    inputPricePerToken: 0.0000025, // $2.5 per 1M tokens
    outputPricePerToken: 0.00001, // $10 per 1M tokens
  },
  {
    model: 'gpt-4o-mini',
    provider: 'openai',
    inputPricePerToken: 0.00000015, // $0.15 per 1M tokens
    outputPricePerToken: 0.0000006, // $0.6 per 1M tokens
  },
];

/**
 * Look up pricing for a given model name.
 * Returns undefined if the model is not in the pricing config.
 */
export function getModelPricing(model: string): ModelPricing | undefined {
  return MODEL_PRICING.find((p) => p.model === model);
}

/**
 * Calculate the estimated cost for a given model and token counts.
 * Returns 0 for unknown models and logs a warning.
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getModelPricing(model);
  if (!pricing) {
    logger.warn(`Unknown model "${model}" — using $0 cost fallback`);
    return 0;
  }
  return (
    inputTokens * pricing.inputPricePerToken +
    outputTokens * pricing.outputPricePerToken
  );
}
