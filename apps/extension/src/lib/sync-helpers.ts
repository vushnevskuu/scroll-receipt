import type { Platform } from '@scroll-receipt/shared';
import type { DailyAggregate } from '@src/types';

export function syncRecordsFromAggregate(aggregate: Pick<DailyAggregate, 'date' | 'platformTotals' | 'platformViews'>) {
  const platforms: Platform[] = ['instagram', 'youtube', 'tiktok'];
  return platforms
    .filter((p) => aggregate.platformTotals[p] > 0)
    .map((platform) => ({
      platform,
      seconds: aggregate.platformTotals[platform],
      views: aggregate.platformViews[platform] ?? 0,
    }));
}
