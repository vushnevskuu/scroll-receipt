import { describe, expect, it } from 'vitest';
import { ContentTracker } from '@src/tracking/content-tracker';

describe('view counting', () => {
  it('does not count view before 3 seconds', async () => {
    const tracker = ContentTracker.fromProgress({});
    const salt = 'salt';

    const r1 = await tracker.processQualifiedSecond('a', 30, salt, false);
    const r2 = await tracker.processQualifiedSecond('a', 30, salt, false);
    expect(r1.videoViewed).toBe(false);
    expect(r2.videoViewed).toBe(false);
  });

  it('counts view at 3 second threshold', async () => {
    const tracker = ContentTracker.fromProgress({});
    const salt = 'salt';

    await tracker.processQualifiedSecond('a', 30, salt, false);
    await tracker.processQualifiedSecond('a', 30, salt, false);
    const r3 = await tracker.processQualifiedSecond('a', 30, salt, false);
    expect(r3.videoViewed).toBe(true);
  });

  it('does not count same video twice same day', async () => {
    const tracker = ContentTracker.fromProgress({});
    const salt = 'salt';

    for (let i = 0; i < 3; i += 1) {
      await tracker.processQualifiedSecond('a', 30, salt, false);
    }
    const again = await tracker.processQualifiedSecond('a', 30, salt, false);
    expect(again.videoViewed).toBe(false);
  });

  it('counts different videos separately', async () => {
    const tracker = ContentTracker.fromProgress({});
    const salt = 'salt';

    for (let i = 0; i < 3; i += 1) {
      await tracker.processQualifiedSecond('a', 30, salt, false);
    }
    await tracker.processQualifiedSecond('a', 30, salt, false);
    await tracker.processQualifiedSecond('b', 30, salt, true);
    await tracker.processQualifiedSecond('b', 30, salt, false);
    const r = await tracker.processQualifiedSecond('b', 30, salt, false);
    expect(r.videoViewed).toBe(true);
  });
});
