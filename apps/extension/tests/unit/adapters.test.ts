import { describe, expect, it } from 'vitest';
import { createYouTubeAdapter } from '@src/adapters/youtube';
import { createInstagramAdapter } from '@src/adapters/instagram';
import { createTikTokAdapter } from '@src/adapters/tiktok';

describe('platform adapters', () => {
  it('detects youtube shorts routes', () => {
    const adapter = createYouTubeAdapter();
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/shorts/abc123'),
      writable: true,
    });
    expect(adapter.matchesCurrentPage()).toBe(true);
    expect(adapter.getStableContentIdentifier()).toBe('abc123');
  });

  it('detects instagram reels routes', () => {
    const adapter = createInstagramAdapter();
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.instagram.com/reels/'),
      writable: true,
    });
    expect(adapter.matchesCurrentPage()).toBe(true);
  });

  it('detects youtube shorts feed routes', () => {
    const adapter = createYouTubeAdapter();
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/shorts'),
      writable: true,
    });
    expect(adapter.matchesCurrentPage()).toBe(true);
  });

  it('detects tiktok home routes', () => {
    const adapter = createTikTokAdapter();
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.tiktok.com/'),
      writable: true,
    });
    expect(adapter.matchesCurrentPage()).toBe(true);
  });

  it('detects tiktok foryou routes', () => {
    const adapter = createTikTokAdapter();
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.tiktok.com/foryou'),
      writable: true,
    });
    expect(adapter.matchesCurrentPage()).toBe(true);
  });

  it('does not match unrelated youtube pages', () => {
    const adapter = createYouTubeAdapter();
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/watch?v=abc'),
      writable: true,
    });
    expect(adapter.matchesCurrentPage()).toBe(false);
  });
});
