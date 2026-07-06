import { describe, expect, it } from 'vitest';
import { ContentTracker } from '@src/tracking/content-tracker';

describe('content tracker', () => {
  it('marks viewed at 3 second threshold and deduplicates same day', async () => {
    const tracker = ContentTracker.fromProgress({});
    const salt = 'test-salt';

    let result = await tracker.processQualifiedSecond('video-1', 30, salt, false);
    expect(result.videoViewed).toBe(false);
    result = await tracker.processQualifiedSecond('video-1', 30, salt, false);
    expect(result.videoViewed).toBe(false);
    result = await tracker.processQualifiedSecond('video-1', 30, salt, false);
    expect(result.videoViewed).toBe(true);
    result = await tracker.processQualifiedSecond('video-1', 30, salt, false);
    expect(result.videoViewed).toBe(false);
  });

  it('increments content advances when identifier changes', async () => {
    const tracker = ContentTracker.fromProgress({});
    const salt = 'test-salt';

    await tracker.processQualifiedSecond('video-1', 30, salt, false);
    await tracker.processQualifiedSecond('video-1', 30, salt, false);
    const result = await tracker.processQualifiedSecond('video-2', 30, salt, true);

    expect(result.contentAdvance).toBe(true);
  });
});
