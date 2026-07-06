import type { Platform } from './types.js';
import { PLATFORM_LABELS } from './types.js';
import {
  formatDurationHms,
  formatReceiptDate,
} from './format.js';
import type { ReceiptTotals } from './types.js';

export interface EmailReceiptContent {
  subject: string;
  previewText: string;
  html: string;
  text: string;
}

export function renderEmailReceipt(
  totals: ReceiptTotals,
  locale: 'ru' | 'en',
  manageUrl: string,
  deleteUrl: string,
): EmailReceiptContent {
  const totalDuration = formatDurationHms(totals.totalSeconds);
  const humanDuration = formatDurationHms(totals.totalSeconds);
  const dateLabel = formatReceiptDate(totals.date, locale);

  const lines = (Object.keys(totals.platforms) as Platform[])
    .filter((p) => totals.platforms[p].seconds > 0 || totals.platforms[p].views > 0)
    .map((platform) => {
      const label = PLATFORM_LABELS[platform][locale];
      const time = formatDurationHms(totals.platforms[platform].seconds);
      const qty = String(totals.platforms[platform].views).padStart(2, ' ');
      return { label, qty, time };
    });

  const subject =
    locale === 'ru'
      ? `Ваш чек внимания за ${dateLabel} — ${humanDuration.slice(0, 5) !== '00:00' ? humanDuration : '0:00:00'}`
      : `Your attention receipt for ${dateLabel} — ${humanDuration}`;

  const previewText =
    locale === 'ru'
      ? `Сегодня короткие видео заняли ${humanDuration}.`
      : `Short videos took ${humanDuration} today.`;

  const textRows = lines
    .map((l) => `${l.label.padEnd(18)} ${l.qty.padStart(3)}  ${l.time}`)
    .join('\n');

  const text = [
    'SCROLL RECEIPT',
    `RECEIPT: ${totals.receiptNumber}`,
    `DATE: ${dateLabel}`,
    `TIMEZONE: ${totals.timezone}`,
    '--------------------------------',
    'ITEM                 QTY      TIME',
    textRows,
    '--------------------------------',
    `TOTAL ITEMS${' '.repeat(11)}${String(totals.totalViews).padStart(3)}`,
    `TOTAL TIME${' '.repeat(10)}${totalDuration}`,
    '--------------------------------',
    locale === 'ru' ? 'ОПЛАЧЕНО: ВАШИМ ВНИМАНИЕМ' : 'PAID WITH: YOUR ATTENTION',
    '',
    locale === 'ru' ? 'Управление отчётами:' : 'Manage reports:',
    manageUrl,
    locale === 'ru' ? 'Удалить данные:' : 'Delete my data:',
    deleteUrl,
    '',
    locale === 'ru'
      ? 'Scroll Receipt не связан с Instagram, YouTube или TikTok.'
      : 'Scroll Receipt is not affiliated with Instagram, YouTube, or TikTok.',
  ].join('\n');

  const htmlRows = lines
    .map(
      (l) =>
        `<tr><td style="padding:4px 0;font-family:monospace">${l.label}</td><td style="text-align:right;font-family:monospace">${l.qty}</td><td style="text-align:right;font-family:monospace">${l.time}</td></tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#f0ede6">
<div style="max-width:360px;margin:0 auto;background:#faf8f2;border:1px dashed #bbb;padding:24px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#1a1a1a">
<div style="text-align:center;font-weight:bold;letter-spacing:2px;margin-bottom:8px">SCROLL RECEIPT</div>
<div style="font-size:12px;margin-bottom:12px">RECEIPT: ${totals.receiptNumber}<br>DATE: ${dateLabel}<br>TIMEZONE: ${totals.timezone}</div>
<div style="border-top:1px dashed #999;border-bottom:1px dashed #999;padding:8px 0;margin:12px 0;font-size:12px">
<table width="100%" cellpadding="0" cellspacing="0">${htmlRows}</table>
</div>
<div style="font-size:12px">TOTAL ITEMS: ${totals.totalViews}<br>TOTAL TIME: ${totalDuration}</div>
<div style="margin-top:16px;font-size:11px;text-align:center">${locale === 'ru' ? 'ОПЛАЧЕНО: ВАШИМ ВНИМАНИЕМ' : 'PAID WITH: YOUR ATTENTION'}</div>
<div style="margin-top:20px;font-size:10px;color:#666;text-align:center">
<a href="${manageUrl}">${locale === 'ru' ? 'Управление отчётами' : 'Manage reports'}</a> ·
<a href="${deleteUrl}">${locale === 'ru' ? 'Удалить данные' : 'Delete my data'}</a>
</div>
</div></body></html>`;

  return { subject, previewText, html, text };
}
