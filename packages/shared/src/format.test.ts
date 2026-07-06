import { describe, expect, it } from 'vitest';
import { capDeltaSeconds, formatDurationHms, generateReceiptNumber } from '../src/format.js';
import { renderEmailReceipt } from '../src/email-receipt.js';
import { VIEW_THRESHOLD_SECONDS } from '../src/types.js';

describe('shared format', () => {
  it('formats duration as HH:MM:SS', () => {
    expect(formatDurationHms(3661)).toBe('01:01:01');
  });

  it('caps delta after sleep', () => {
    expect(capDeltaSeconds(120_000, 30)).toBe(30);
  });

  it('generates receipt number', () => {
    expect(generateReceiptNumber('2026-07-06', 'abcd1234')).toBe('SR-20260706-ABCD');
  });
});

describe('email receipt', () => {
  it('renders matching html and text totals', () => {
    const content = renderEmailReceipt(
      {
        date: '2026-07-06',
        timezone: 'Asia/Bangkok',
        receiptNumber: 'SR-20260706-ABCD',
        platforms: {
          instagram: { seconds: 2478, views: 32 },
          youtube: { seconds: 1564, views: 18 },
          tiktok: { seconds: 2331, views: 27 },
        },
        totalSeconds: 6373,
        totalViews: 77,
      },
      'ru',
      'https://example.com/settings',
      'https://example.com/delete',
    );
    expect(content.text).toContain('TOTAL TIME');
    expect(content.text).toContain('01:46:13');
    expect(content.html).toContain('01:46:13');
  });
});

describe('view threshold constant', () => {
  it('uses 3 second threshold', () => {
    expect(VIEW_THRESHOLD_SECONDS).toBe(3);
  });
});
