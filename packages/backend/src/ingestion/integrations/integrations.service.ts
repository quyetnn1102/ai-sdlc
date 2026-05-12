import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateIntegrationDto, UpdateIntegrationDto } from './dto/create-integration.dto';
import * as crypto from 'crypto';

@Injectable()
export class IntegrationsService {
  private readonly algorithm = 'aes-256-gcm';

  constructor(private readonly prisma: PrismaService) {}

  // ── Encryption helpers (envelope encryption stub) ──────────────────────
  private getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY || '0'.repeat(64);
    return Buffer.from(key.padEnd(64, '0').slice(0, 64), 'hex');
  }

  encryptToken(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptToken(ciphertext: string): string {
    const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  // ── Sensitive key detection ────────────────────────────────────────────
  private isSensitiveKey(key: string): boolean {
    return ['api_token', 'token', 'secret', 'password', 'webhook_secret'].some((k) =>
      key.toLowerCase().includes(k),
    );
  }

  // ── CRUD ───────────────────────────────────────────────────────────────
  async create(projectId: string, dto: CreateIntegrationDto) {
    const integration = await this.prisma.integration.create({
      data: { projectId, type: dto.type },
    });

    if (dto.settings) {
      await this.upsertSettings(integration.id, dto.settings);
    }
    return this.findById(integration.id);
  }

  async findByProject(projectId: string) {
    return this.prisma.integration.findMany({
      where: { projectId },
      include: { settings: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { id },
      include: { settings: true },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    return integration;
  }

  async update(id: string, dto: UpdateIntegrationDto) {
    await this.findById(id);
    if (dto.settings) {
      await this.upsertSettings(id, dto.settings);
    }
    return this.prisma.integration.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        updatedAt: new Date(),
      },
      include: { settings: true },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.integration.delete({ where: { id } });
  }

  async markSynced(id: string, status = 'ACTIVE') {
    return this.prisma.integration.update({
      where: { id },
      data: { lastSyncAt: new Date(), status },
    });
  }

  async markDegraded(id: string) {
    return this.prisma.integration.update({
      where: { id },
      data: { status: 'DEGRADED' },
    });
  }

  // ── Settings helpers ───────────────────────────────────────────────────
  private async upsertSettings(integrationId: string, settings: Record<string, string>) {
    for (const [key, rawValue] of Object.entries(settings)) {
      const value = this.isSensitiveKey(key) ? this.encryptToken(rawValue) : rawValue;
      await this.prisma.integrationSetting.upsert({
        where: { integrationId_key: { integrationId, key } },
        update: { value },
        create: { integrationId, key, value },
      });
    }
  }

  async getSetting(integrationId: string, key: string): Promise<string | null> {
    const setting = await this.prisma.integrationSetting.findUnique({
      where: { integrationId_key: { integrationId, key } },
    });
    if (!setting) return null;
    return this.isSensitiveKey(key) ? this.decryptToken(setting.value) : setting.value;
  }
}
