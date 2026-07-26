import type { Paginated } from '@elite/shared';
import type { Notification, Prisma } from '@prisma/client';

import { ApiError } from '../../utils/ApiError.js';
import { parsePagination } from '../../utils/http.js';

import { notificationRepository } from './notification.repository.js';
import type { NotificationDTO, NotifyInput } from './notification.types.js';

function toDTO(n: Notification): NotificationDTO {
  return {
    id: n.id,
    channel: n.channel,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    meta: n.meta ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Write a notification row (in-app by default).
 * Standalone + dependency-light so it is safe to call from a BullMQ worker.
 */
export async function notify(input: NotifyInput): Promise<NotificationDTO> {
  const row = await notificationRepository.create({
    userId: input.userId,
    channel: input.channel ?? 'IN_APP',
    title: input.title,
    body: input.body,
    meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
  });
  return toDTO(row);
}

export const notificationService = {
  async list(userId: string, query: Record<string, unknown>): Promise<Paginated<NotificationDTO>> {
    const { page, pageSize, skip, take } = parsePagination(query);
    const unreadOnly = query.unreadOnly === true || query.unreadOnly === 'true';
    const [rows, total] = await notificationRepository.listByUser(userId, {
      skip,
      take,
      unreadOnly,
    });
    return {
      items: rows.map(toDTO),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 0,
    };
  },

  async markRead(userId: string, id: string): Promise<NotificationDTO> {
    const existing = await notificationRepository.findById(id);
    if (!existing || existing.userId !== userId) throw ApiError.notFound('Notification not found');
    return toDTO(await notificationRepository.markRead(id));
  },

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await notificationRepository.markAllRead(userId);
    return { updated: res.count };
  },
};
