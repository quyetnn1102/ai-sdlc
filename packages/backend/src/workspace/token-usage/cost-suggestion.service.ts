import { Injectable } from '@nestjs/common';
import { TokenUsageService } from './token-usage.service';

export interface CostSuggestion {
  type: 'high_usage_agent' | 'model_downgrade' | 'prompt_caching';
  message: string;
  affectedEntity: string;
  estimatedMonthlySavings: number;
}

@Injectable()
export class CostSuggestionService {
  constructor(private readonly tokenUsageService: TokenUsageService) {}

  /**
   * Analyze last 30 days of logs and generate cost optimization suggestions.
   * Returns empty list with message if fewer than 10 records exist.
   */
  async getSuggestions(projectId: string): Promise<{
    suggestions: CostSuggestion[];
    message?: string;
  }> {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);

    const logs = await this.tokenUsageService.queryLogs(
      projectId,
      fromDate,
      toDate,
    );

    if (logs.length < 10) {
      return {
        suggestions: [],
        message:
          'Insufficient data. At least 10 token usage records are needed for analysis.',
      };
    }

    const suggestions: CostSuggestion[] = [];

    // Calculate project-wide average tokens per call
    const totalTokensAllLogs = logs.reduce(
      (sum, log) => sum + log.inputTokens + log.outputTokens,
      0,
    );
    const projectAvgTokensPerCall = totalTokensAllLogs / logs.length;

    // Group logs by agent
    const byAgent = new Map<string, typeof logs>();
    for (const log of logs) {
      const agentLogs = byAgent.get(log.agentProfileId) ?? [];
      agentLogs.push(log);
      byAgent.set(log.agentProfileId, agentLogs);
    }

    // Detect high-usage agents
    for (const [agentId, agentLogs] of byAgent) {
      const agentTotalTokens = agentLogs.reduce(
        (sum, log) => sum + log.inputTokens + log.outputTokens,
        0,
      );
      const agentAvg = agentTotalTokens / agentLogs.length;

      if (agentAvg > 3 * projectAvgTokensPerCall) {
        const ratio = (agentAvg / projectAvgTokensPerCall).toFixed(1);
        const estimatedSavings =
          (agentTotalTokens - projectAvgTokensPerCall * agentLogs.length) *
          0.000003; // rough estimate using mid-range pricing
        suggestions.push({
          type: 'high_usage_agent',
          message: `Agent '${agentId}' uses ${ratio}x more tokens than the project average.`,
          affectedEntity: agentId,
          estimatedMonthlySavings: Math.max(0, estimatedSavings),
        });
      }
    }

    // Detect model downgrade candidates
    for (const [agentId, agentLogs] of byAgent) {
      const allLowOutput = agentLogs.every(
        (log) => log.outputTokens < 1000,
      );
      if (allLowOutput) {
        // Estimate savings from switching to cheapest model
        const currentCost = agentLogs.reduce(
          (sum, log) => sum + log.estimatedCost,
          0,
        );
        const estimatedCheapCost = agentLogs.reduce(
          (sum, log) =>
            sum +
            log.inputTokens * 0.00000015 +
            log.outputTokens * 0.0000006,
          0,
        );
        suggestions.push({
          type: 'model_downgrade',
          message: `Agent '${agentId}' consistently uses fewer than 1,000 output tokens. Consider using gpt-4o-mini.`,
          affectedEntity: agentId,
          estimatedMonthlySavings: Math.max(0, currentCost - estimatedCheapCost),
        });
      }
    }

    // Detect prompt caching opportunities
    const byHash = new Map<string, typeof logs>();
    for (const log of logs) {
      if (!log.promptHash) continue;
      const hashLogs = byHash.get(log.promptHash) ?? [];
      hashLogs.push(log);
      byHash.set(log.promptHash, hashLogs);
    }

    for (const [hash, hashLogs] of byHash) {
      // Check if > 5 occurrences within any 7-day window
      const sorted = hashLogs.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );

      let hasWindow = false;
      for (let i = 0; i <= sorted.length - 6; i++) {
        const windowEnd = new Date(sorted[i].createdAt);
        windowEnd.setDate(windowEnd.getDate() + 7);
        const inWindow = sorted.filter(
          (log) =>
            log.createdAt >= sorted[i].createdAt &&
            log.createdAt <= windowEnd,
        );
        if (inWindow.length > 5) {
          hasWindow = true;
          break;
        }
      }

      if (hasWindow) {
        // Estimate savings from caching (assume 90% input token reduction)
        const totalInputCost = hashLogs.reduce(
          (sum, log) => sum + log.inputTokens * 0.000003,
          0,
        );
        suggestions.push({
          type: 'prompt_caching',
          message: `Prompt hash '${hash.substring(0, 8)}...' appears ${hashLogs.length} times in the last 30 days. Consider enabling prompt caching.`,
          affectedEntity: hash,
          estimatedMonthlySavings: totalInputCost * 0.9,
        });
      }
    }

    return { suggestions };
  }
}
