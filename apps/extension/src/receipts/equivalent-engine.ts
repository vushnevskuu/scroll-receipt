import type { DailyAggregate, EquivalentRates, PersonalEquivalent, ReceiptData } from '@src/types';
import { PLATFORM_LABELS } from '@src/utils/constants';
import { formatNumber, formatReceiptDate, getReceiptId } from '@src/utils/format';

export function calculateEquivalents(
  activeSeconds: number,
  rates: EquivalentRates,
): PersonalEquivalent[] {
  const minutes = activeSeconds / 60;

  return [
    {
      id: 'reading',
      label: 'READING',
      value: formatNumber(Math.round(minutes * rates.readingPagesPerMinute)),
      unit: 'PAGES',
    },
    {
      id: 'walking',
      label: 'WALKING',
      value: formatNumber(Math.round((minutes * rates.walkingStepsPerMinute) / 10) * 10),
      unit: 'STEPS',
    },
    {
      id: 'deep_work',
      label: 'DEEP WORK',
      value: formatDurationEquivalent(activeSeconds),
      unit: '',
    },
    {
      id: 'language',
      label: 'LANGUAGE PRACTICE',
      value: formatNumber(Math.round(minutes * rates.languageCardsPerMinute)),
      unit: 'CARDS',
    },
  ];
}

function formatDurationEquivalent(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} MIN`;
  if (minutes === 0) return `${hours} HR`;
  return `${hours} HR ${minutes} MIN`;
}

export function calculateEstimatedScrollDistance(
  contentAdvances: number,
  distancePerAdvance: number,
): string {
  const meters = contentAdvances * distancePerAdvance;
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} KM`;
  }
  return `${formatNumber(Math.round(meters))} M`;
}

export function buildReceiptData(
  aggregate: DailyAggregate,
  rates: EquivalentRates,
): ReceiptData {
  const platformLines = (Object.entries(aggregate.platformTotals) as Array<
    [keyof typeof aggregate.platformTotals, number]
  >)
    .filter(([, seconds]) => seconds > 0)
    .map(([platform, seconds]) => ({
      label: PLATFORM_LABELS[platform],
      seconds,
    }))
    .sort((a, b) => b.seconds - a.seconds);

  const avgViewSeconds =
    aggregate.videosViewed > 0
      ? Math.round(aggregate.activeSeconds / aggregate.videosViewed)
      : 0;

  return {
    receiptId: getReceiptId(aggregate.date),
    date: formatReceiptDate(aggregate.date),
    status: 'AUTOMATIC',
    platformLines,
    videosViewed: aggregate.videosViewed,
    contentAdvances: aggregate.contentAdvances,
    quickSkips: aggregate.quickSkips,
    avgViewSeconds,
    totalActiveSeconds: aggregate.activeSeconds,
    equivalents: calculateEquivalents(aggregate.activeSeconds, rates),
    estimatedScrollDistance:
      aggregate.contentAdvances > 0
        ? calculateEstimatedScrollDistance(
            aggregate.contentAdvances,
            rates.scrollDistancePerAdvance,
          )
        : null,
  };
}

export function mergeAggregateWithCheckpoint(
  aggregate: DailyAggregate | null,
  checkpoint: { activeSeconds: number; platform: keyof DailyAggregate['platformTotals']; videosViewed: number; contentAdvances: number; quickSkips: number; engagedViews: number; completedViews: number } | null,
  date: string,
): DailyAggregate {
  const base = aggregate ?? {
    date,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platformTotals: { youtube: 0, instagram: 0, tiktok: 0 },
    platformViews: { youtube: 0, instagram: 0, tiktok: 0 },
    activeSeconds: 0,
    videosViewed: 0,
    contentAdvances: 0,
    quickSkips: 0,
    engagedViews: 0,
    completedViews: 0,
    sessionCount: 0,
    longestSessionSeconds: 0,
  };

  if (!checkpoint) return base;

  return {
    ...base,
    activeSeconds: base.activeSeconds,
    videosViewed: Math.max(base.videosViewed, checkpoint.videosViewed),
    contentAdvances: Math.max(base.contentAdvances, checkpoint.contentAdvances),
    quickSkips: Math.max(base.quickSkips, checkpoint.quickSkips),
    engagedViews: Math.max(base.engagedViews, checkpoint.engagedViews),
    completedViews: Math.max(base.completedViews, checkpoint.completedViews),
  };
}
