import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { createYouTubeAdapter } from '@src/adapters/youtube';
import { createInstagramAdapter } from '@src/adapters/instagram';
import { createTikTokAdapter } from '@src/adapters/tiktok';

function loadFixture(name: string): void {
  const html = readFileSync(resolve(__dirname, '../fixtures', name), 'utf-8');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  document.body.innerHTML = doc.body.innerHTML;
  document.title = doc.title;

  for (const video of document.querySelectorAll('video')) {
    video.getBoundingClientRect = () =>
      ({
        top: 0,
        left: 0,
        right: 360,
        bottom: 640,
        width: 360,
        height: 640,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
  }
}

describe('platform adapter fixtures', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '';
  });

  it('finds video element on youtube short fixture', () => {
    loadFixture('youtube-short.html');
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.youtube.com/shorts/abc123'),
      writable: true,
    });

    const adapter = createYouTubeAdapter();
    expect(adapter.matchesCurrentPage()).toBe(true);
    expect(adapter.getActiveVideoElement()).not.toBeNull();
    expect(adapter.getStableContentIdentifier()).toBe('abc123');
  });

  it('finds video element on instagram reel fixture', () => {
    loadFixture('instagram-reel.html');
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.instagram.com/reel/xyz789/'),
      writable: true,
    });

    const adapter = createInstagramAdapter();
    expect(adapter.matchesCurrentPage()).toBe(true);
    expect(adapter.getActiveVideoElement()).not.toBeNull();
  });

  it('finds video element on tiktok feed fixture', () => {
    loadFixture('tiktok-feed.html');
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.tiktok.com/@user/video/1234567890'),
      writable: true,
    });

    const adapter = createTikTokAdapter();
    expect(adapter.matchesCurrentPage()).toBe(true);
    expect(adapter.getActiveVideoElement()).not.toBeNull();
  });

  it('ignores instagram profile without reel route', () => {
    loadFixture('instagram-reel.html');
    Object.defineProperty(window, 'location', {
      value: new URL('https://www.instagram.com/someuser/'),
      writable: true,
    });

    const adapter = createInstagramAdapter();
    expect(adapter.matchesCurrentPage()).toBe(false);
  });
});
