import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto, userId: string) {
    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description,
        memberships: {
          create: {
            userId,
            role: 'ADMIN',
          },
        },
      },
    });
    return org;
  }

  async findAll(userId: string) {
    return this.prisma.organization.findMany({
      where: {
        memberships: { some: { userId } },
      },
      include: {
        _count: { select: { memberships: true, projects: true } },
      },
    });
  }

  async findById(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        projects: true,
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async addMember(orgId: string, userId: string, role: string) {
    return this.prisma.membership.create({
      data: { organizationId: orgId, userId, role },
    });
  }
}
