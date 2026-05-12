import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface WorkItemFilters {
  projectId: string;
  phase?: string;
  type?: string;
  assignee?: string;
  label?: string;
  sprintName?: string;
}

@Injectable()
export class WorkItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: WorkItemFilters) {
    const { projectId, phase, type, assignee, label, sprintName } = filters;

    return this.prisma.workItem.findMany({
      where: {
        projectId,
        ...(phase ? { phase } : {}),
        ...(type ? { type } : {}),
        ...(assignee ? { assignee: { contains: assignee, mode: 'insensitive' } } : {}),
        ...(label ? { labels: { has: label } } : {}),
        ...(sprintName ? { sprintName: { contains: sprintName, mode: 'insensitive' } } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(id: string) {
    const item = await this.prisma.workItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Work item not found');
    return item;
  }

  async countByPhase(projectId: string) {
    const groups = await this.prisma.workItem.groupBy({
      by: ['phase'],
      where: { projectId },
      _count: { _all: true },
    });

    return groups.map((g) => ({
      phase: g.phase ?? 'Unassigned',
      count: g._count._all,
    }));
  }

  // ── Apply status mappings from workflow phases ────────────────────────
  async applyStatusMappings(projectId: string) {
    const mappings = await this.prisma.statusMapping.findMany({
      where: { workflowPhase: { projectId } },
      include: { workflowPhase: true },
    });

    if (!mappings.length) return 0;

    let updated = 0;
    for (const mapping of mappings) {
      const result = await this.prisma.workItem.updateMany({
        where: {
          projectId,
          status: { equals: mapping.externalStatus, mode: 'insensitive' },
        },
        data: { phase: mapping.workflowPhase.name },
      });
      updated += result.count;
    }
    return updated;
  }

  // ── Aging WIP: items in a phase beyond threshold days ─────────────────
  async getAgingWip(projectId: string, thresholdDays = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - thresholdDays);

    return this.prisma.workItem.findMany({
      where: {
        projectId,
        phase: { not: null },
        updatedAt: { lt: cutoff },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }
}
