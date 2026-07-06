import { z } from 'zod';

export const supportedPlatformSchema = z.enum(['youtube', 'instagram', 'tiktok']);

export const equivalentRatesSchema = z.object({
  readingPagesPerMinute: z.number().positive(),
  walkingStepsPerMinute: z.number().positive(),
  languageCardsPerMinute: z.number().positive(),
  scrollDistancePerAdvance: z.number().positive(),
});

export const trackingSettingsSchema = z.object({
  trackingEnabled: z.boolean(),
  enabledPlatforms: z.array(supportedPlatformSchema),
  idleDetectionEnabled: z.boolean(),
  dailyReceiptTime: z.string(),
  retentionDays: z.number().int().positive(),
  equivalentRates: equivalentRatesSchema,
  onboardingComplete: z.boolean(),
  locale: z.enum(['ru', 'en']).default('ru'),
  timezone: z.string(),
  reportEnabled: z.boolean(),
  email: z.string().email().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const heartbeatPayloadSchema = z.object({
  eventId: z.string().min(1),
  platform: supportedPlatformSchema,
  timestamp: z.string(),
  contentId: z.string().nullable(),
  contentDurationSeconds: z.number().nullable(),
  deltaSeconds: z.number().int().min(0).max(30).default(0),
  qualifiedActiveSecond: z.boolean(),
  contentChanged: z.boolean(),
  isPlaying: z.boolean(),
  visibilityRatio: z.number().min(0).max(1),
  tabActive: z.boolean(),
  windowFocused: z.boolean(),
  documentVisible: z.boolean(),
  isIdle: z.boolean(),
});

export const contentChangedPayloadSchema = z.object({
  eventId: z.string().min(1),
  platform: supportedPlatformSchema,
  timestamp: z.string(),
  contentId: z.string().nullable(),
  contentDurationSeconds: z.number().nullable(),
});

export const pageStatePayloadSchema = z.object({
  eventId: z.string().min(1),
  platform: supportedPlatformSchema,
  timestamp: z.string(),
  tabActive: z.boolean(),
  windowFocused: z.boolean(),
  documentVisible: z.boolean(),
});

export const playbackStatePayloadSchema = z.object({
  eventId: z.string().min(1),
  platform: supportedPlatformSchema,
  timestamp: z.string(),
  isPlaying: z.boolean(),
  visibilityRatio: z.number().min(0).max(1),
});

export const updateSettingsPayloadSchema = trackingSettingsSchema.partial();

export const extensionMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TRACKING_HEARTBEAT'), payload: heartbeatPayloadSchema }),
  z.object({ type: z.literal('CONTENT_CHANGED'), payload: contentChangedPayloadSchema }),
  z.object({ type: z.literal('PAGE_STATE_CHANGED'), payload: pageStatePayloadSchema }),
  z.object({
    type: z.literal('PLAYBACK_STATE_CHANGED'),
    payload: playbackStatePayloadSchema,
  }),
  z.object({ type: z.literal('GET_TRACKING_STATUS') }),
  z.object({ type: z.literal('GET_TODAY_SUMMARY') }),
  z.object({ type: z.literal('GET_WEEKLY_SUMMARY') }),
  z.object({ type: z.literal('GET_HISTORY') }),
  z.object({ type: z.literal('GET_SETTINGS') }),
  z.object({ type: z.literal('UPDATE_SETTINGS'), payload: updateSettingsPayloadSchema }),
  z.object({ type: z.literal('PAUSE_TRACKING') }),
  z.object({ type: z.literal('RESUME_TRACKING') }),
  z.object({ type: z.literal('DELETE_TODAY') }),
  z.object({ type: z.literal('DELETE_ALL') }),
  z.object({ type: z.literal('EXPORT_DATA') }),
  z.object({ type: z.literal('GET_SYNC_STATE') }),
  z.object({ type: z.literal('SYNC_NOW') }),
  z.object({ type: z.literal('SEND_TEST_RECEIPT'), payload: z.object({ locale: z.enum(['ru', 'en']).optional() }) }),
  z.object({ type: z.literal('SIGN_IN_OTP'), payload: z.object({ email: z.string().email() }) }),
  z.object({ type: z.literal('VERIFY_OTP'), payload: z.object({ email: z.string().email(), token: z.string().min(4) }) }),
  z.object({ type: z.literal('SIGN_OUT') }),
  z.object({ type: z.literal('UPDATE_PROFILE'), payload: z.object({ timezone: z.string().optional(), reportEnabled: z.boolean().optional(), reportTimeLocal: z.string().optional() }) }),
  z.object({ type: z.literal('FINALIZE_STALE_SESSIONS') }),
  z.object({ type: z.literal('REGENERATE_AGGREGATES') }),
]);

export type ExtensionMessage = z.infer<typeof extensionMessageSchema>;

export function parseExtensionMessage(data: unknown): ExtensionMessage | null {
  const result = extensionMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}
