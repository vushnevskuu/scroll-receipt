import type { CompletedSession, DailyAggregate, SupportedPlatform } from '@src/types';
import { getLocalTimezone, splitSecondsAtMidnight } from '@src/utils/format';

function emptyPlatformTotals() {
  return { youtube: 0, instagram: 0, tiktok: 0 };
}

export function rebuildDailyAggregates(sessions: CompletedSession[]): DailyAggregate[] {
  const byDate = new Map<string, DailyAggregate>();

  for (const session of sessions) {
    const parts = splitSecondsAtMidnight(
      session.startedAt,
      session.endedAt,
      session.activeSeconds,
    );

    parts.forEach((part, index) => {
      const aggregate = byDate.get(part.date) ?? {
        date: part.date,
        timezone: getLocalTimezone(),
        platformTotals: emptyPlatformTotals(),
        platformViews: emptyPlatformTotals(),
        activeSeconds: 0,
        videosViewed: 0,
        contentAdvances: 0,
        quickSkips: 0,
        engagedViews: 0,
        completedViews: 0,
        sessionCount: 0,
        longestSessionSeconds: 0,
      };

      aggregate.activeSeconds += part.seconds;
        aggregate.platformTotals[session.platform] += part.seconds;
        if (index === 0) {
          aggregate.platformViews[session.platform] += session.videosViewed;
        }
      aggregate.sessionCount += index === 0 ? 1 : 0;
      aggregate.longestSessionSeconds = Math.max(aggregate.longestSessionSeconds, part.seconds);

      if (index === 0) {
        aggregate.videosViewed += session.videosViewed;
        aggregate.contentAdvances += session.contentAdvances;
        aggregate.quickSkips += session.quickSkips;
        aggregate.engagedViews += session.engagedViews;
        aggregate.completedViews += session.completedViews;
      }

      byDate.set(part.date, aggregate);
    });
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function buildWeeklySummary(aggregates: DailyAggregate[]): {
  totalActiveSeconds: number;
  dailyAverage: number;
  mostUsedPlatform: SupportedPlatform | null;
  longestDaySeconds: number;
} {
  if (aggregates.length === 0) {
    return {
      totalActiveSeconds: 0,
      dailyAverage: 0,
      mostUsedPlatform: null,
      longestDaySeconds: 0,
    };
  }

  const totalActiveSeconds = aggregates.reduce((sum, a) => sum + a.activeSeconds, 0);
  const platformTotals = emptyPlatformTotals();

  for (const aggregate of aggregates) {
    platformTotals.youtube += aggregate.platformTotals.youtube;
    platformTotals.instagram += aggregate.platformTotals.instagram;
    platformTotals.tiktok += aggregate.platformTotals.tiktok;
  }

  const sorted = (Object.entries(platformTotals) as Array<[SupportedPlatform, number]>).sort(
    ([, a], [, b]) => b - a,
  );
  const mostUsedPlatform = sorted[0]?.[1] ? sorted[0][0] : null;

  return {
    totalActiveSeconds,
    dailyAverage: Math.round(totalActiveSeconds / aggregates.length),
    mostUsedPlatform,
    longestDaySeconds: Math.max(...aggregates.map((a) => a.activeSeconds)),
  };
}

export function mergeLiveCheckpoint(
  aggregate: DailyAggregate | null,
  checkpoint: {
    activeSeconds: number;
    platform: SupportedPlatform;
    videosViewed: number;
    contentAdvances: number;
    quickSkips: number;
    engagedViews: number;
    completedViews: number;
  } | null,
  date: string,
): DailyAggregate {
  const base = aggregate ?? {
    date,
    timezone: getLocalTimezone(),
    platformTotals: emptyPlatformTotals(),
    platformViews: emptyPlatformTotals(),
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

  const platformTotals = { ...base.platformTotals };
  platformTotals[checkpoint.platform] += checkpoint.activeSeconds;
  const platformViews = { ...base.platformViews };
  platformViews[checkpoint.platform] += checkpoint.videosViewed;

  return {
    ...base,
    activeSeconds: base.activeSeconds + checkpoint.activeSeconds,
    platformTotals,
    platformViews,
    videosViewed: base.videosViewed + checkpoint.videosViewed,
    contentAdvances: base.contentAdvances + checkpoint.contentAdvances,
    quickSkips: base.quickSkips + checkpoint.quickSkips,
    engagedViews: base.engagedViews + checkpoint.engagedViews,
    completedViews: base.completedViews + checkpoint.completedViews,
    longestSessionSeconds: Math.max(base.longestSessionSeconds, checkpoint.activeSeconds),
  };
}
