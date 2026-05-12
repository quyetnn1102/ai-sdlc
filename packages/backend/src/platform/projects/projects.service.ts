import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateProjectDto, organizationId: string, userId?: string) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description,
        timezone: dto.timezone || 'UTC',
        organizationId,
      },
    });
    this.audit.log({ userId, action: 'CREATE_PROJECT', resource: `project:${project.id}`, details: { name: project.name, key: project.key } });
    return project;
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

  async update(id: string, data: Partial<CreateProjectDto>, userId?: string) {
    await this.findById(id);
    const project = await this.prisma.project.update({ where: { id }, data });
    this.audit.log({ userId, action: 'UPDATE_PROJECT', resource: `project:${id}`, details: data as Record<string, unknown> });
    return project;
  }

  async delete(id: string, userId?: string) {
    await this.findById(id);
    this.audit.log({ userId, action: 'DELETE_PROJECT', resource: `project:${id}` });
    return this.prisma.project.delete({ where: { id } });
  }
}
