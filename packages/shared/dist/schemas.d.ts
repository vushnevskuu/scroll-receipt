import { z } from 'zod';
export declare const platformSchema: z.ZodEnum<{
    instagram: "instagram";
    youtube: "youtube";
    tiktok: "tiktok";
}>;
export declare const usageSyncPayloadSchema: z.ZodObject<{
    deviceId: z.ZodString;
    localDate: z.ZodString;
    timezone: z.ZodString;
    platform: z.ZodEnum<{
        instagram: "instagram";
        youtube: "youtube";
        tiktok: "tiktok";
    }>;
    seconds: z.ZodNumber;
    views: z.ZodNumber;
    clientUpdatedAt: z.ZodString;
}, z.core.$strip>;
export declare const usageSyncBatchSchema: z.ZodObject<{
    records: z.ZodArray<z.ZodObject<{
        deviceId: z.ZodString;
        localDate: z.ZodString;
        timezone: z.ZodString;
        platform: z.ZodEnum<{
            instagram: "instagram";
            youtube: "youtube";
            tiktok: "tiktok";
        }>;
        seconds: z.ZodNumber;
        views: z.ZodNumber;
        clientUpdatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const profileUpdateSchema: z.ZodObject<{
    timezone: z.ZodOptional<z.ZodString>;
    reportEnabled: z.ZodOptional<z.ZodBoolean>;
    reportTimeLocal: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const testReceiptSchema: z.ZodObject<{
    locale: z.ZodDefault<z.ZodEnum<{
        ru: "ru";
        en: "en";
    }>>;
}, z.core.$strip>;
export type UsageSyncPayload = z.infer<typeof usageSyncPayloadSchema>;
export type UsageSyncBatch = z.infer<typeof usageSyncBatchSchema>;
//# sourceMappingURL=schemas.d.ts.map