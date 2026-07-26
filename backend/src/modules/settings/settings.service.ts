import type { Prisma, Setting } from '@prisma/client';

import { settingsRepository } from './settings.repository.js';
import type { PublicSettings, SettingDTO } from './settings.types.js';

/**
 * Only settings in these groups are exposed to unauthenticated clients.
 * Anything sensitive (payment keys, integration secrets, etc.) must live in a
 * different group and will never leak through GET /public.
 */
const PUBLIC_GROUPS = ['store', 'general', 'public'];

function toDTO(s: Setting): SettingDTO {
  return { key: s.key, value: s.value, group: s.group };
}

export const settingsService = {
  /** Safe subset — flat key/value map from the whitelisted public groups. */
  async getPublic(): Promise<PublicSettings> {
    const rows = await settingsRepository.listByGroups(PUBLIC_GROUPS);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  },

  /** Full list — admin only. */
  async listAll(): Promise<SettingDTO[]> {
    const rows = await settingsRepository.list();
    return rows.map(toDTO);
  },

  /** Upsert a single setting by key. */
  async update(key: string, value: unknown, group?: string): Promise<SettingDTO> {
    const row = await settingsRepository.upsert(key, value as Prisma.InputJsonValue, group);
    return toDTO(row);
  },
};
