/** Module-local DTOs for platform settings. */

export interface SettingDTO {
  key: string;
  value: unknown;
  group: string;
}

/** Flat map of public settings, key → value. */
export type PublicSettings = Record<string, unknown>;
