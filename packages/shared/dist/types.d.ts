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
export declare const PLATFORMS: Platform[];
export declare const PLATFORM_LABELS: Record<Platform, {
    ru: string;
    en: string;
}>;
export declare const MAX_DELTA_SECONDS = 30;
export declare const VIEW_THRESHOLD_SECONDS = 3;
export declare const HEARTBEAT_INTERVAL_MS = 5000;
export declare const SYNC_MIN_INTERVAL_MS = 30000;
//# sourceMappingURL=types.d.ts.map