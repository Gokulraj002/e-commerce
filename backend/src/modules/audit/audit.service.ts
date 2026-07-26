import type { Paginated } from '@elite/shared';
import type { Prisma } from '@prisma/client';

import { parsePagination } from '../../utils/http.js';

import { auditRepository, type AuditRowWithUser } from './audit.repository.js';
import type { ListAuditQuery } from './audit.schema.js';
import type { AuditLogDTO } from './audit.types.js';

function toDTO(row: AuditRowWithUser): AuditLogDTO {
  return {
    id: row.id,
    userId: row.userId,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    changes: row.changes ?? null,
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
    actor: row.user
      ? { id: row.user.id, name: row.user.name, email: row.user.email }
      : null,
  };
}

export const auditService = {
  async list(query: ListAuditQuery): Promise<Paginated<AuditLogDTO>> {
    const { page, pageSize, skip, take } = parsePagination(query);

    const where: Prisma.AuditLogWhereInput = {};
    if (query.entity) where.entity = query.entity;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;
    if (query.dateFrom || query.dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.dateFrom) createdAt.gte = query.dateFrom;
      if (query.dateTo) createdAt.lte = query.dateTo;
      where.createdAt = createdAt;
    }

    const [rows, total] = await auditRepository.list(where, skip, take);

    return {
      items: rows.map(toDTO),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  async entities(): Promise<string[]> {
    return auditRepository.distinctEntities();
  },
};
