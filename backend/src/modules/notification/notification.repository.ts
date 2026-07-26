import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

/** Prisma access only. */
export const notificationRepository = {
  listByUser(userId: string, opts: { skip: number; take: number; unreadOnly: boolean }) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(opts.unreadOnly ? { isRead: false } : {}),
    };
    return prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.notification.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  },

  markRead(id: string) {
    return prisma.notification.update({ where: { id }, data: { isRead: true } });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },

  create(data: Prisma.NotificationUncheckedCreateInput) {
    return prisma.notification.create({ data });
  },
};
