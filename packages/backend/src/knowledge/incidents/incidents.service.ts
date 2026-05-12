import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface TimelineEvent {
  timestamp: string;
  description: string;
}

export interface CreateIncidentDto {
  title: string;
  severity: 'P1' | 'P2' | 'P3' | 'P4';
  startAt?: string;
  endAt?: string;
  affectedService?: string;
  rootCauseCommitId?: string;
  linkedDeploymentId?: string;
  rootCauseNotes?: string;
  timeline?: TimelineEvent[];
  externalId?: string;
}

export interface AddTimelineEventDto {
  timestamp?: string;
  description: string;
}

export interface IncidentFilters {
  severity?: string;
  status?: string;
}

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateIncidentDto) {
    return this.prisma.incident.create({
      data: {
        projectId,
        title: dto.title,
        severity: dto.severity,
        status: 'OPEN',
        startAt: dto.startAt ? new Date(dto.startAt) : new Date(),
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        affectedService: dto.affectedService,
        rootCauseCommitId: dto.rootCauseCommitId,
        linkedDeploymentId: dto.linkedDeploymentId,
        rootCauseNotes: dto.rootCauseNotes,
        timeline: (dto.timeline ?? []) as object[],
        externalId: dto.externalId,
      },
    });
  }

  async findByProject(projectId: string, filters: IncidentFilters = {}) {
    return this.prisma.incident.findMany({
      where: {
        projectId,
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const incident = await this.prisma.incident.findUnique({ where: { id } });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  async update(id: string, dto: Partial<CreateIncidentDto>) {
    await this.findById(id);
    return this.prisma.incident.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
        ...(dto.startAt !== undefined ? { startAt: new Date(dto.startAt!) } : {}),
        ...(dto.endAt !== undefined ? { endAt: new Date(dto.endAt!) } : {}),
        ...(dto.affectedService !== undefined ? { affectedService: dto.affectedService } : {}),
        ...(dto.rootCauseCommitId !== undefined ? { rootCauseCommitId: dto.rootCauseCommitId } : {}),
        ...(dto.linkedDeploymentId !== undefined ? { linkedDeploymentId: dto.linkedDeploymentId } : {}),
        ...(dto.rootCauseNotes !== undefined ? { rootCauseNotes: dto.rootCauseNotes } : {}),
      },
    });
  }

  async resolve(id: string, endAt: Date) {
    return this.prisma.incident.update({
      where: { id },
      data: { status: 'RESOLVED', endAt },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.incident.delete({ where: { id } });
  }

  // ── Timeline ─────────────────────────────────────────────────────────
  async addTimelineEvent(id: string, dto: AddTimelineEventDto) {
    const incident = await this.findById(id);
    const events = (incident.timeline as unknown as TimelineEvent[]) ?? [];
    events.push({
      timestamp: dto.timestamp ?? new Date().toISOString(),
      description: dto.description,
    });
    return this.prisma.incident.update({
      where: { id },
      data: { timeline: events as object[] },
    });
  }

  async linkToDeployment(id: string, deploymentId: string) {
    return this.prisma.incident.update({
      where: { id },
      data: { linkedDeploymentId: deploymentId },
    });
  }

  // ── Stats: MTTR p50/p90, CFR, counts by severity ─────────────────────
  async stats(projectId: string, period: '7d' | '30d' | '90d' = '30d') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const incidents = await this.prisma.incident.findMany({
      where: { projectId, createdAt: { gte: since } },
    });

    // MTTR (resolved incidents only)
    const resolved = incidents.filter((i) => i.startAt && i.endAt && i.status === 'RESOLVED');
    const recoveryMins = resolved
      .map((i) => (i.endAt!.getTime() - i.startAt!.getTime()) / 60000)
      .sort((a, b) => a - b);

    const mttrAvg = recoveryMins.length
      ? recoveryMins.reduce((a, b) => a + b, 0) / recoveryMins.length
      : null;
    const mttrP50 = recoveryMins.length
      ? recoveryMins[Math.floor(recoveryMins.length * 0.5)]
      : null;
    const mttrP90 = recoveryMins.length
      ? recoveryMins[Math.floor(recoveryMins.length * 0.9)]
      : null;

    // Counts by severity
    const bySeverity: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
    for (const i of incidents) {
      bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    }

    // CFR: incidents linked to deployments / total deployments in window
    const totalDeployments = await this.prisma.deployment.count({
      where: { projectId, deployedAt: { gte: since } },
    });
    const deploymentsWithIncidents = incidents.filter((i) => i.linkedDeploymentId).length;
    const cfr = totalDeployments ? deploymentsWithIncidents / totalDeployments : 0;

    return {
      period,
      total: incidents.length,
      open: incidents.filter((i) => i.status === 'OPEN').length,
      resolved: resolved.length,
      bySeverity,
      mttr: {
        avgMinutes: mttrAvg !== null ? Math.round(mttrAvg) : null,
        p50Minutes: mttrP50 !== null ? Math.round(mttrP50) : null,
        p90Minutes: mttrP90 !== null ? Math.round(mttrP90) : null,
        samples: recoveryMins.length,
      },
      changeFailureRate: {
        rate: Math.round(cfr * 10000) / 100,
        deploymentsWithIncidents,
        totalDeployments,
      },
    };
  }

  // ── PagerDuty alert ingestion with deduplication ──────────────────────
  async ingestPagerDuty(projectId: string, payload: Record<string, unknown>) {
    const messages = (payload.messages as Array<Record<string, unknown>>) ?? [payload];

    const results = [];
    for (const msg of messages) {
      const event = msg.event as string;
      const incident = msg.incident as Record<string, unknown> | undefined;
      if (!incident) continue;

      const externalId = incident.id as string;
      const title = (incident.title ?? incident.description ?? 'PagerDuty Alert') as string;
      const severity = this.mapPdUrgency(incident.urgency as string);

      // Deduplication: skip if same externalId within 5-minute window
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existing = await this.prisma.incident.findFirst({
        where: { projectId, externalId, createdAt: { gte: fiveMinAgo } },
      });

      if (existing) {
        results.push({ externalId, action: 'deduplicated' });
        continue;
      }

      if (event === 'incident.trigger') {
        const created = await this.create(projectId, { title, severity, externalId });
        results.push({ externalId, action: 'created', id: created.id });
      } else if (event === 'incident.resolve') {
        const open = await this.prisma.incident.findFirst({
          where: { projectId, externalId, status: { in: ['OPEN', 'INVESTIGATING'] } },
        });
        if (open) {
          await this.resolve(open.id, new Date());
          results.push({ externalId, action: 'resolved', id: open.id });
        }
      }
    }

    return { ingested: results.length, results };
  }

  private mapPdUrgency(urgency: string): 'P1' | 'P2' | 'P3' | 'P4' {
    switch (urgency?.toLowerCase()) {
      case 'high':   return 'P1';
      case 'low':    return 'P3';
      default:       return 'P2';
    }
  }
}
