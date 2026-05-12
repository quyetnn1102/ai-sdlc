import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateOrganizationDto, userId: string) {
    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description,
        memberships: {
          create: { userId, role: 'ADMIN' },
        },
      },
    });
    this.audit.log({
      userId,
      action: 'CREATE_ORG',
      resource: `org:${org.id}`,
      details: { name: org.name, key: org.key },
    });
    return org;
  }

  async findAll(userId: string, query: PaginationQuery = {}): Promise<PaginatedResult<any>> {
    const page  = Math.max(1, query.page  ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip  = (page - 1) * limit;

    const where = { memberships: { some: { userId } } };

    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        include: { _count: { select: { memberships: true, projects: true } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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
