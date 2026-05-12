import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto, organizationId: string) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description,
        timezone: dto.timezone || 'UTC',
        organizationId,
      },
    });
  }

  async findByOrganization(organizationId: string) {
    return this.prisma.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, key: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: string, data: Partial<CreateProjectDto>) {
    await this.findById(id); // ensure exists
    return this.prisma.project.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findById(id); // ensure exists
    return this.prisma.project.delete({ where: { id } });
  }
}
