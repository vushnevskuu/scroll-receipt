import './zod-config.js';
import { z } from 'zod';
export const platformSchema = z.enum(['instagram', 'youtube', 'tiktok']);
export const usageSyncPayloadSchema = z.object({
    deviceId: z.string().uuid(),
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timezone: z.string().min(1).max(64),
    platform: platformSchema,
    seconds: z.number().int().min(0).max(86400),
    views: z.number().int().min(0).max(10000),
    clientUpdatedAt: z.string().datetime(),
});
export const usageSyncBatchSchema = z.object({
    records: z.array(usageSyncPayloadSchema).min(1).max(12),
});
export const profileUpdateSchema = z.object({
    timezone: z.string().min(1).max(64).optional(),
    reportEnabled: z.boolean().optional(),
    reportTimeLocal: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    locale: z.enum(['ru', 'en']).optional(),
});
export const testReceiptSchema = z.object({
    locale: z.enum(['ru', 'en']).default('ru'),
});
