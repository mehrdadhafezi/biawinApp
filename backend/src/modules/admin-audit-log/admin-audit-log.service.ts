import { Injectable, Logger } from '@nestjs/common';
import type { AdminAuditAction } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface RecordAuditEntryInput {
  adminUserId: string | null;
  action: AdminAuditAction;
  resourceType: string;
  resourceId?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
  ip?: string;
  userAgent?: string;
}

/**
 * Append-only — this service intentionally exposes no update/delete method
 * (docs/admin-architecture-decision-record.md §8). `record()` never throws:
 * a transient audit-write failure must not block the admin action it's
 * describing (the same "non-critical side effect shouldn't break the
 * critical path" reasoning `AuthService.completeSignup` already applies to
 * its own best-effort membership-code registration) — it's logged loudly
 * instead, since silent audit gaps are worse than a logged one.
 */
@Injectable()
export class AdminAuditLogService {
  private readonly logger = new Logger(AdminAuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: RecordAuditEntryInput): Promise<void> {
    try {
      await this.prisma.adminAuditLog.create({
        data: {
          adminUserId: entry.adminUserId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId ?? null,
          beforeJson: entry.beforeJson ?? undefined,
          afterJson: entry.afterJson ?? undefined,
          ip: entry.ip,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write admin audit log entry (action=${entry.action}, resourceType=${entry.resourceType})`,
        error as Error,
      );
    }
  }

  async list(skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminAuditLog.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminAuditLog.count(),
    ]);
    return { items, total, skip, take };
  }
}
