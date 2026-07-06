import { describe, expect, it, beforeEach } from 'vitest';
import { rebuildDailyAggregates } from '@src/tracking/daily-aggregation';
import type { CompletedSession } from '@src/types';
import { resetTestStorage } from '../setup';

describe('session aggregation', () => {
  beforeEach(() => {
    resetTestStorage();
  });
  it('starts counting on first qualified second via completed session', () => {
    const sessions: CompletedSession[] = [
      {
        id: '1',
        platform: 'tiktok',
        startedAt: '2026-06-25T10:00:00.000Z',
        endedAt: '2026-06-25T10:00:05.000Z',
        activeSeconds: 5,
        videosViewed: 1,
        contentAdvances: 0,
        quickSkips: 0,
        engagedViews: 0,
        completedViews: 0,
      },
    ];

    const aggregates = rebuildDailyAggregates(sessions);
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0]?.activeSeconds).toBe(5);
    expect(aggregates[0]?.videosViewed).toBe(1);
  });

  it('ignores duplicate event ids at storage layer', async () => {
    const { storageRepo } = await import('@src/storage/repositories');
    const first = await storageRepo.addProcessedEventId('evt-1');
    const second = await storageRepo.addProcessedEventId('evt-1');
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('merges short gaps when sessions remain separate records', () => {
    const sessions: CompletedSession[] = [
      {
        id: 'a',
        platform: 'youtube',
        startedAt: '2026-06-25T12:00:00.000Z',
        endedAt: '2026-06-25T12:10:00.000Z',
        activeSeconds: 600,
        videosViewed: 2,
        contentAdvances: 1,
        quickSkips: 0,
        engagedViews: 1,
        completedViews: 0,
      },
      {
        id: 'b',
        platform: 'youtube',
        startedAt: '2026-06-25T12:10:20.000Z',
        endedAt: '2026-06-25T12:20:00.000Z',
        activeSeconds: 580,
        videosViewed: 1,
        contentAdvances: 1,
        quickSkips: 0,
        engagedViews: 0,
        completedViews: 0,
      },
    ];

    const aggregates = rebuildDailyAggregates(sessions);
    expect(aggregates[0]?.sessionCount).toBe(2);
    expect(aggregates[0]?.activeSeconds).toBe(1180);
  });
});
