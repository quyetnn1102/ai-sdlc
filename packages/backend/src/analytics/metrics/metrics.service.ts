import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type MetricsPeriod = '7d' | '30d' | '90d';

function periodToDays(period: MetricsPeriod): number {
  return period === '7d' ? 7 : period === '30d' ? 30 : 90;
}

function periodStart(period: MetricsPeriod): Date {
  const d = new Date();
  d.setDate(d.getDate() - periodToDays(period));
  return d;
}

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────
  // DORA 1: Deployment Frequency
  // Number of successful production deployments / period length (per day)
  // ─────────────────────────────────────────────────────────────────────
  async deploymentFrequency(projectId: string, period: MetricsPeriod = '30d') {
    const since = periodStart(period);
    const count = await this.prisma.deployment.count({
      where: {
        projectId,
        environment: 'production',
        status: 'SUCCESS',
        deployedAt: { gte: since },
      },
    });
    const days = periodToDays(period);
    return {
      metric: 'deployment_frequency',
      period,
      count,
      perDay: count / days,
      perWeek: (count / days) * 7,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // DORA 2: Lead Time for Changes
  // Avg time from first commit on a PR to production deployment
  // ─────────────────────────────────────────────────────────────────────
  async leadTimeForChanges(projectId: string, period: MetricsPeriod = '30d') {
    const since = periodStart(period);

    // Find successful production deployments in window
    const deployments = await this.prisma.deployment.findMany({
      where: {
        projectId,
        environment: 'production',
        status: 'SUCCESS',
        deployedAt: { gte: since },
      },
    });

    if (!deployments.length) {
      return { metric: 'lead_time_for_changes', period, avgHours: null, samples: 0 };
    }

    // For each deployment, find matching build → PR → earliest commit
    const leadTimes: number[] = [];
    for (const dep of deployments) {
      const build = dep.buildId
        ? await this.prisma.build.findUnique({ where: { id: dep.buildId } })
        : null;

      if (!build?.pullRequestId) continue;

      const commits = await this.prisma.commit.findMany({
        where: { pullRequestId: build.pullRequestId },
        orderBy: { committedAt: 'asc' },
        take: 1,
      });

      if (!commits.length) continue;

      const firstCommit = commits[0];
      const diffMs = dep.deployedAt.getTime() - firstCommit.committedAt.getTime();
      if (diffMs > 0) leadTimes.push(diffMs / (1000 * 60 * 60)); // hours
    }

    const avgHours = leadTimes.length
      ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
      : null;

    return {
      metric: 'lead_time_for_changes',
      period,
      avgHours: avgHours !== null ? Math.round(avgHours * 100) / 100 : null,
      avgDays: avgHours !== null ? Math.round((avgHours / 24) * 100) / 100 : null,
      samples: leadTimes.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // DORA 3: Change Failure Rate (requires incidents)
  // Deployments that caused incidents / total deployments
  // ─────────────────────────────────────────────────────────────────────
  async changeFailureRate(projectId: string, period: MetricsPeriod = '30d') {
    const since = periodStart(period);

    const totalDeployments = await this.prisma.deployment.count({
      where: { projectId, environment: 'production', deployedAt: { gte: since } },
    });

    const failedDeployments = await this.prisma.incident.count({
      where: {
        projectId,
        linkedDeploymentId: { not: null },
        createdAt: { gte: since },
      },
    });

    const rate = totalDeployments ? failedDeployments / totalDeployments : 0;
    return {
      metric: 'change_failure_rate',
      period,
      failedDeployments,
      totalDeployments,
      rate: Math.round(rate * 10000) / 100, // percentage
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // DORA 4: MTTR — Mean Time to Recovery
  // Uses incident startAt / endAt; includes avg, p50, p90
  // ─────────────────────────────────────────────────────────────────────
  async mttr(projectId: string, period: MetricsPeriod = '30d') {
    const since = periodStart(period);

    const incidents = await this.prisma.incident.findMany({
      where: {
        projectId,
        status: 'RESOLVED',
        startAt: { gte: since },
        endAt: { not: null },
      },
    });

    const recoveryMinutes = incidents
      .filter((i) => i.startAt && i.endAt)
      .map((i) => (i.endAt!.getTime() - i.startAt!.getTime()) / (1000 * 60));

    if (!recoveryMinutes.length) {
      return { metric: 'mttr', period, avgMinutes: null, p50: null, p90: null, samples: 0 };
    }

    recoveryMinutes.sort((a, b) => a - b);
    const avg = recoveryMinutes.reduce((a, b) => a + b, 0) / recoveryMinutes.length;
    const p50 = recoveryMinutes[Math.floor(recoveryMinutes.length * 0.5)];
    const p90 = recoveryMinutes[Math.floor(recoveryMinutes.length * 0.9)];

    return {
      metric: 'mttr',
      period,
      avgMinutes: Math.round(avg),
      p50Minutes: Math.round(p50),
      p90Minutes: Math.round(p90),
      samples: recoveryMinutes.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // All DORA metrics combined
  // ─────────────────────────────────────────────────────────────────────
  async dora(projectId: string, period: MetricsPeriod = '30d') {
    const [freq, lead, cfr, mttrResult] = await Promise.all([
      this.deploymentFrequency(projectId, period),
      this.leadTimeForChanges(projectId, period),
      this.changeFailureRate(projectId, period),
      this.mttr(projectId, period),
    ]);
    return { period, deploymentFrequency: freq, leadTime: lead, changeFailureRate: cfr, mttr: mttrResult };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Flow Metrics
  // WIP per phase, cycle time per phase, throughput
  // ─────────────────────────────────────────────────────────────────────
  async flowMetrics(projectId: string, period: MetricsPeriod = '30d') {
    const since = periodStart(period);

    // WIP per phase (current snapshot)
    const wipGroups = await this.prisma.workItem.groupBy({
      by: ['phase'],
      where: { projectId, phase: { not: null } },
      _count: { _all: true },
    });

    const wip = wipGroups.map((g) => ({
      phase: g.phase!,
      count: g._count._all,
    }));

    // Throughput: items that moved to "In Production" phase in the window
    const throughput = await this.prisma.workItem.count({
      where: {
        projectId,
        phase: { in: ['In Production', 'Released', 'Done'] },
        updatedAt: { gte: since },
      },
    });

    // Avg age of in-flight items per phase (in days, using updatedAt as proxy)
    const inFlight = await this.prisma.workItem.findMany({
      where: { projectId, phase: { not: null } },
      select: { phase: true, updatedAt: true, createdAt: true },
    });

    const ageByPhase: Record<string, number[]> = {};
    for (const item of inFlight) {
      const phase = item.phase!;
      const ageDays = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (!ageByPhase[phase]) ageByPhase[phase] = [];
      ageByPhase[phase].push(ageDays);
    }

    const avgAgeByPhase = Object.entries(ageByPhase).map(([phase, ages]) => ({
      phase,
      avgAgeDays: Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10,
    }));

    return {
      period,
      wip,
      throughput: { count: throughput, days: periodToDays(period) },
      avgAge: avgAgeByPhase,
    };
  }
}
