import { z } from 'zod';

export const settingKeyParamSchema = z.object({ key: z.string().min(1).max(120) });

export const updateSettingSchema = z.object({
  value: z.unknown().refine((v) => v !== undefined, 'value is required'),
  group: z.string().min(1).max(60).optional(),
});

export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;
