export type Platform = 'instagram' | 'youtube' | 'tiktok';

export interface PlatformTotals {
  seconds: number;
  views: number;
}

export interface DailyUsage {
  date: string;
  timezone: string;
  platforms: Record<Platform, PlatformTotals>;
  watchedVideoHashes: string[];
}

export interface ReceiptTotals {
  date: string;
  timezone: string;
  receiptNumber: string;
  platforms: Record<Platform, PlatformTotals>;
  totalSeconds: number;
  totalViews: number;
}

export interface UserProfile {
  userId: string;
  email: string;
  timezone: string;
  locale: 'ru' | 'en';
  reportEnabled: boolean;
  reportTimeLocal: string;
  emailVerified: boolean;
}

export const PLATFORMS: Platform[] = ['instagram', 'youtube', 'tiktok'];

export const PLATFORM_LABELS: Record<Platform, { ru: string; en: string }> = {
  instagram: { ru: 'INSTAGRAM REELS', en: 'INSTAGRAM REELS' },
  youtube: { ru: 'YOUTUBE SHORTS', en: 'YOUTUBE SHORTS' },
  tiktok: { ru: 'TIKTOK', en: 'TIKTOK' },
};

export const MAX_DELTA_SECONDS = 30;
export const VIEW_THRESHOLD_SECONDS = 3;
export const HEARTBEAT_INTERVAL_MS = 5000;
export const SYNC_MIN_INTERVAL_MS = 30_000;
