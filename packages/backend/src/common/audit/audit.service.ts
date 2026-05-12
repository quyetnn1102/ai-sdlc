import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditAction =
  | 'LOGIN'
  | 'REGISTER'
  | 'CREATE_ORG'
  | 'CREATE_PROJECT'
  | 'UPDATE_PROJECT'
  | 'DELETE_PROJECT'
  | 'CREATE_INTEGRATION'
  | 'UPDATE_INTEGRATION'
  | 'DELETE_INTEGRATION'
  | 'CREATE_GATE'
  | 'DELETE_GATE'
  | 'GATE_EVALUATE'
  | 'GATE_OVERRIDE'
  | 'WEBHOOK_RECEIVED'
  | 'WEBHOOK_PROCESSED'
  | 'WEBHOOK_FAILED'
  | 'CREATE_AGENT_PROFILE'
  | 'UPDATE_AGENT_PROFILE'
  | 'DELETE_AGENT_PROFILE'
  | 'CREATE_PHASE_MAPPING'
  | 'DELETE_PHASE_MAPPING'
  | 'START_WORKFLOW_EXECUTION'
  | 'CANCEL_WORKFLOW_EXECUTION'
  | 'PERMISSION_DENIED';

export interface AuditEntry {
  userId?: string;
  action: AuditAction;
  resource?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit log entry.
   * Fire-and-forget: errors are swallowed so callers are never affected.
   */
  log(entry: AuditEntry): void {
    this.prisma.auditLog
      .create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          resource: entry.resource ?? null,
          details: (entry.details ?? {}) as any,
          ipAddress: entry.ipAddress ?? null,
        },
      })
      .catch(() => { /* intentional: audit must not break business flows */ });
  }

  async findByUser(userId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findByResource(resource: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { resource: { startsWith: resource } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findRecent(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }
}
