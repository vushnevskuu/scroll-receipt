import type { SupportedPlatform } from '@src/types';

export const PLATFORM_LABELS: Record<SupportedPlatform, string> = {
  youtube: 'YOUTUBE SHORTS',
  instagram: 'INSTAGRAM REELS',
  tiktok: 'TIKTOK',
};

export const DEFAULT_EQUIVALENT_RATES = {
  readingPagesPerMinute: 0.45,
  walkingStepsPerMinute: 90,
  languageCardsPerMinute: 0.6,
  scrollDistancePerAdvance: 12,
} as const;

export const SESSION_GAP_MERGE_SECONDS = 30;
export const HEARTBEAT_INTERVAL_MS = 5000;
export const STALE_SESSION_SECONDS = 30;
export const VIEWED_THRESHOLD_SECONDS = 3;
export const ENGAGED_THRESHOLD_SECONDS = 10;
export const COMPLETED_THRESHOLD_RATIO = 0.9;
export const VISIBILITY_THRESHOLD = 0.6;
export const RETENTION_DAYS_DEFAULT = 90;

export const ALARM_NAMES = {
  STALE_SESSION: 'scroll-receipt-stale-session',
  DAILY_RECEIPT: 'scroll-receipt-daily-receipt',
  CHECKPOINT: 'scroll-receipt-checkpoint',
} as const;

export const STORAGE_KEYS = {
  settings: 'local:settings',
  checkpoint: 'local:checkpoint',
  sessions: 'local:sessions',
  dailyAggregates: 'local:dailyAggregates',
  contentHashSalt: 'local:contentHashSalt',
  processedEventIds: 'local:processedEventIds',
  adapterHealth: 'local:adapterHealth',
  contentProgress: 'local:contentProgress',
} as const;
