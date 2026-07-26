import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

/** Prisma access only. Settings are key/value/group rows with JSON values. */
export const settingsRepository = {
  list() {
    return prisma.setting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
  },
  listByGroups(groups: string[]) {
    return prisma.setting.findMany({
      where: { group: { in: groups } },
      orderBy: [{ group: 'asc' }, { key: 'asc' }],
    });
  },
  findByKey(key: string) {
    return prisma.setting.findUnique({ where: { key } });
  },
  upsert(key: string, value: Prisma.InputJsonValue, group?: string) {
    return prisma.setting.upsert({
      where: { key },
      create: { key, value, ...(group ? { group } : {}) },
      update: { value, ...(group ? { group } : {}) },
    });
  },
};
