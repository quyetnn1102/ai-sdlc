import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ActionItem {
  text: string;
  owner?: string;
  dueDate?: string;
  completed: boolean;
}

export interface CreateRetroDto {
  title: string;
  sprintName?: string;
  participants?: string[];
  wentWell?: string;
  wentWrong?: string;
  actionItems?: ActionItem[];
  tags?: string[];
  incidentId?: string;
}

@Injectable()
export class RetrospectivesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, dto: CreateRetroDto) {
    return this.prisma.retrospective.create({
      data: {
        projectId,
        title: dto.title,
        sprintName: dto.sprintName,
        participants: dto.participants ?? [],
        wentWell: dto.wentWell,
        wentWrong: dto.wentWrong,
        actionItems: (dto.actionItems ?? []) as object[],
        tags: dto.tags ?? [],
        incidentId: dto.incidentId,
      },
    });
  }

  async findByProject(projectId: string, tag?: string) {
    return this.prisma.retrospective.findMany({
      where: {
        projectId,
        ...(tag ? { tags: { has: tag } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const retro = await this.prisma.retrospective.findUnique({ where: { id } });
    if (!retro) throw new NotFoundException('Retrospective not found');
    return retro;
  }

  async update(id: string, dto: Partial<CreateRetroDto>) {
    await this.findById(id);
    return this.prisma.retrospective.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.sprintName !== undefined ? { sprintName: dto.sprintName } : {}),
        ...(dto.participants !== undefined ? { participants: dto.participants } : {}),
        ...(dto.wentWell !== undefined ? { wentWell: dto.wentWell } : {}),
        ...(dto.wentWrong !== undefined ? { wentWrong: dto.wentWrong } : {}),
        ...(dto.actionItems !== undefined ? { actionItems: dto.actionItems as object[] } : {}),
        ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
        ...(dto.incidentId !== undefined ? { incidentId: dto.incidentId } : {}),
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.retrospective.delete({ where: { id } });
  }

  // ── Toggle a single action item completion ────────────────────────────
  async toggleActionItem(retroId: string, itemIndex: number, completed: boolean) {
    const retro = await this.findById(retroId);
    const items = (retro.actionItems as ActionItem[]) ?? [];
    if (itemIndex < 0 || itemIndex >= items.length) {
      throw new NotFoundException('Action item index out of range');
    }
    items[itemIndex] = { ...items[itemIndex], completed };
    return this.prisma.retrospective.update({
      where: { id: retroId },
      data: { actionItems: items as object[] },
    });
  }

  // ── Link retro to incident (post-mortem) ──────────────────────────────
  async linkToIncident(retroId: string, incidentId: string) {
    return this.prisma.retrospective.update({
      where: { id: retroId },
      data: { incidentId },
    });
  }
}
