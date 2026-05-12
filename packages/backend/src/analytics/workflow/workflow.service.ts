import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export class CreatePhaseDto {
  name: string;
  order: number;
  color?: string;
}

export class CreateStatusMappingDto {
  externalStatus: string;
  source: string; // JIRA | GITHUB | GITLAB
}

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Phases ────────────────────────────────────────────────────────────
  async createPhase(projectId: string, dto: CreatePhaseDto) {
    return this.prisma.workflowPhase.create({
      data: { projectId, name: dto.name, order: dto.order, color: dto.color ?? '#6B7280' },
    });
  }

  async findPhasesByProject(projectId: string) {
    return this.prisma.workflowPhase.findMany({
      where: { projectId },
      include: { statusMappings: true },
      orderBy: { order: 'asc' },
    });
  }

  async updatePhase(id: string, data: Partial<CreatePhaseDto>) {
    return this.prisma.workflowPhase.update({ where: { id }, data });
  }

  async deletePhase(id: string) {
    return this.prisma.workflowPhase.delete({ where: { id } });
  }

  // ── Status Mappings ───────────────────────────────────────────────────
  async addStatusMapping(phaseId: string, dto: CreateStatusMappingDto) {
    return this.prisma.statusMapping.create({
      data: {
        workflowPhaseId: phaseId,
        externalStatus: dto.externalStatus,
        source: dto.source,
      },
    });
  }

  async removeStatusMapping(id: string) {
    return this.prisma.statusMapping.delete({ where: { id } });
  }

  async findPhaseMappings(phaseId: string) {
    const phase = await this.prisma.workflowPhase.findUnique({
      where: { id: phaseId },
      include: { statusMappings: true },
    });
    if (!phase) throw new NotFoundException('Workflow phase not found');
    return phase;
  }
}
