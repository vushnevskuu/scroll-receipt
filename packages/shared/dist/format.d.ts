import type { Platform } from './types.js';
export declare function getLocalDateString(date?: Date, timeZone?: string): string;
export declare function getLocalTimezone(): string;
export declare function getPreviousLocalDate(timeZone: string, now?: Date): string;
export declare function formatDurationHms(totalSeconds: number): string;
export declare function formatDurationHuman(totalSeconds: number, locale?: 'ru' | 'en'): string;
export declare function formatReceiptDate(date: string, locale?: 'ru' | 'en'): string;
export declare function generateReceiptNumber(date: string, userSuffix: string): string;
export declare function emptyPlatformTotals(): Record<Platform, {
    seconds: number;
    views: number;
}>;
export declare function sumPlatformTotals(a: Record<Platform, {
    seconds: number;
    views: number;
}>, b: Record<Platform, {
    seconds: number;
    views: number;
}>): Record<Platform, {
    seconds: number;
    views: number;
}>;
export declare function capDeltaSeconds(deltaMs: number, maxSeconds?: number): number;
//# sourceMappingURL=format.d.ts.map