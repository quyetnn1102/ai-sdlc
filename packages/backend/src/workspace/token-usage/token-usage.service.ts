import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { calculateCost } from './model-pricing.config';

@Injectable()
export class TokenUsageService {
  private readonly logger = new Logger(TokenUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a single LLM call's token usage. Fire-and-forget.
   * Errors are logged but not propagated.
   */
  async log(params: {
    projectId: string;
    epicRunId: string;
    epicRunStepId: string;
    agentProfileId: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    promptHash?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const estimatedCost = calculateCost(
        params.model,
        params.inputTokens,
        params.outputTokens,
      );

      await this.prisma.tokenUsageLog.create({
        data: {
          projectId: params.projectId,
          epicRunId: params.epicRunId,
          epicRunStepId: params.epicRunStepId,
          agentProfileId: params.agentProfileId,
          model: params.model,
          provider: params.provider,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          estimatedCost,
          promptHash: params.promptHash ?? null,
          metadata: (params.metadata as any) ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to log token usage: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get aggregated token usage for an epic run.
   */
  async getEpicRunUsage(epicRunId: string): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
  }> {
    const result = await this.prisma.tokenUsageLog.aggregate({
      where: { epicRunId },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        estimatedCost: true,
      },
    });

    return {
      totalInputTokens: result._sum.inputTokens ?? 0,
      totalOutputTokens: result._sum.outputTokens ?? 0,
      totalCost: result._sum.estimatedCost ?? 0,
    };
  }

  /**
   * Get aggregated token usage for a specific step.
   */
  async getStepUsage(epicRunStepId: string): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
  }> {
    const result = await this.prisma.tokenUsageLog.aggregate({
      where: { epicRunStepId },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        estimatedCost: true,
      },
    });

    return {
      totalInputTokens: result._sum.inputTokens ?? 0,
      totalOutputTokens: result._sum.outputTokens ?? 0,
      totalCost: result._sum.estimatedCost ?? 0,
    };
  }

  /**
   * Get today's usage summary for a project.
   */
  async getTodaySummary(projectId: string): Promise<{
    totalTokens: number;
    estimatedCost: number;
  }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const result = await this.prisma.tokenUsageLog.aggregate({
      where: {
        projectId,
        createdAt: { gte: todayStart },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        estimatedCost: true,
      },
    });

    const totalTokens =
      (result._sum.inputTokens ?? 0) + (result._sum.outputTokens ?? 0);

    return {
      totalTokens,
      estimatedCost: result._sum.estimatedCost ?? 0,
    };
  }

  /**
   * Get the full report data for the report panel.
   */
  async getReport(projectId: string): Promise<{
    today: { totalTokens: number; estimatedCost: number };
    thisMonth: { totalTokens: number; estimatedCost: number };
    byModel: Array<{ model: string; tokens: number; percentage: number }>;
    byAgent: Array<{ agentName: string; tokens: number; percentage: number }>;
    dailyTrend: Array<{ date: string; cost: number }>;
  }> {
    const today = await this.getTodaySummary(projectId);

    // This month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthResult = await this.prisma.tokenUsageLog.aggregate({
      where: {
        projectId,
        createdAt: { gte: monthStart },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        estimatedCost: true,
      },
    });

    const thisMonth = {
      totalTokens:
        (monthResult._sum.inputTokens ?? 0) +
        (monthResult._sum.outputTokens ?? 0),
      estimatedCost: monthResult._sum.estimatedCost ?? 0,
    };

    // By model breakdown
    const byModelRaw = await this.prisma.tokenUsageLog.groupBy({
      by: ['model'],
      where: { projectId, createdAt: { gte: monthStart } },
      _sum: { inputTokens: true, outputTokens: true },
    });

    const totalModelTokens = byModelRaw.reduce(
      (sum, m) =>
        sum + (m._sum.inputTokens ?? 0) + (m._sum.outputTokens ?? 0),
      0,
    );

    const byModel = byModelRaw.map((m) => {
      const tokens = (m._sum.inputTokens ?? 0) + (m._sum.outputTokens ?? 0);
      return {
        model: m.model,
        tokens,
        percentage: totalModelTokens > 0 ? (tokens / totalModelTokens) * 100 : 0,
      };
    });

    // By agent breakdown
    const byAgentRaw = await this.prisma.tokenUsageLog.groupBy({
      by: ['agentProfileId'],
      where: { projectId, createdAt: { gte: monthStart } },
      _sum: { inputTokens: true, outputTokens: true },
    });

    const totalAgentTokens = byAgentRaw.reduce(
      (sum, a) =>
        sum + (a._sum.inputTokens ?? 0) + (a._sum.outputTokens ?? 0),
      0,
    );

    // Fetch agent names
    const agentIds = byAgentRaw.map((a) => a.agentProfileId);
    const agents = await this.prisma.agentProfile.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

    const byAgent = byAgentRaw.map((a) => {
      const tokens = (a._sum.inputTokens ?? 0) + (a._sum.outputTokens ?? 0);
      return {
        agentName: agentNameMap.get(a.agentProfileId) ?? a.agentProfileId,
        tokens,
        percentage: totalAgentTokens > 0 ? (tokens / totalAgentTokens) * 100 : 0,
      };
    });

    // Daily trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyLogs = await this.prisma.tokenUsageLog.findMany({
      where: {
        projectId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { createdAt: true, estimatedCost: true },
    });

    // Group by date
    const dailyMap = new Map<string, number>();
    for (const log of dailyLogs) {
      const dateStr = log.createdAt.toISOString().split('T')[0];
      dailyMap.set(dateStr, (dailyMap.get(dateStr) ?? 0) + log.estimatedCost);
    }

    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { today, thisMonth, byModel, byAgent, dailyTrend };
  }

  /**
   * Query usage logs with date range filter for the cost suggestion engine.
   */
  async queryLogs(
    projectId: string,
    fromDate: Date,
    toDate: Date,
  ) {
    return this.prisma.tokenUsageLog.findMany({
      where: {
        projectId,
        createdAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
