import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

/** Result shape for a single audit row joined with its actor's public fields. */
export type AuditRowWithUser = Prisma.AuditLogGetPayload<{
  include: { user: { select: { id: true; name: true; email: true } } };
}>;

/** Prisma access only. No business logic here. */
export const auditRepository = {
  /** Paginated list + total count in one round-trip. */
  list(where: Prisma.AuditLogWhereInput, skip: number, take: number) {
    return prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);
  },

  /** Distinct entity names seen in the log — powers the admin filter dropdown. */
  async distinctEntities(): Promise<string[]> {
    const rows = await prisma.auditLog.findMany({
      distinct: ['entity'],
      select: { entity: true },
      orderBy: { entity: 'asc' },
    });
    return rows.map((r) => r.entity);
  },
};
