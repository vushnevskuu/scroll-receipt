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

const ESTIMATED_HOURLY_RATE_USD = 15;

function calculateOpportunityCost(seconds: number): number {
  return (seconds / 3600) * ESTIMATED_HOURLY_RATE_USD;
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function renderEmailReceipt(
  totals: ReceiptTotals,
  locale: 'ru' | 'en',
  manageUrl: string,
  deleteUrl: string,
): EmailReceiptContent {
  const totalDuration = formatDurationHms(totals.totalSeconds);
  const dateLabel = formatReceiptDate(totals.date, locale);
  const totalCost = calculateOpportunityCost(totals.totalSeconds);
  const totalCostLabel = formatUsd(totalCost);
  const hourlyRateLabel = formatUsd(ESTIMATED_HOURLY_RATE_USD);

  const lines = (Object.keys(totals.platforms) as Platform[])
    .filter((p) => totals.platforms[p].seconds > 0 || totals.platforms[p].views > 0)
    .map((platform) => {
      const label = PLATFORM_LABELS[platform][locale];
      const time = formatDurationHms(totals.platforms[platform].seconds);
      const qty = String(totals.platforms[platform].views).padStart(2, ' ');
      const cost = formatUsd(calculateOpportunityCost(totals.platforms[platform].seconds));
      return { label, qty, time, cost };
    });

  const subject = `Wasted time — ${totalDuration} · ${totalCostLabel}`;
  const previewText = `You spent ${totalDuration} on short-form video. Estimated cost: ${totalCostLabel}.`;

  const textRows = lines
    .map((l) => `${l.label.padEnd(18)} ${l.qty.padStart(3)}  ${l.time}  ${l.cost.padStart(8)}`)
    .join('\n');

  const text = [
    'WASTED TIME',
    `RECEIPT: ${totals.receiptNumber}`,
    `DATE: ${dateLabel}`,
    `TIMEZONE: ${totals.timezone}`,
    `EST. VALUE RATE: ${hourlyRateLabel}/HR`,
    '--------------------------------',
    'WHERE                QTY      TIME      COST',
    textRows,
    '--------------------------------',
    `TOTAL ITEMS${' '.repeat(11)}${String(totals.totalViews).padStart(3)}`,
    `TOTAL TIME${' '.repeat(10)}${totalDuration}`,
    `MONEY LOST${' '.repeat(10)}${totalCostLabel}`,
    '--------------------------------',
    'PAID WITH: YOUR ATTENTION',
    '',
    'Manage reports:',
    manageUrl,
    'Delete my data:',
    deleteUrl,
    '',
    'Estimated with a flat $15.00/hour opportunity cost.',
    'Scroll Receipt is not affiliated with Instagram, YouTube, or TikTok.',
  ].join('\n');

  const htmlRows = lines
    .map(
      (l) =>
        `<tr>
          <td style="padding:6px 0;font-family:monospace;color:#1f1c16">${l.label}</td>
          <td style="padding:6px 0;text-align:right;font-family:monospace;color:#4a4338">${l.qty}</td>
          <td style="padding:6px 0;text-align:right;font-family:monospace;color:#4a4338">${l.time}</td>
          <td style="padding:6px 0;text-align:right;font-family:monospace;color:#1f1c16;font-weight:700">${l.cost}</td>
        </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#ebe4d8">
<div style="max-width:420px;margin:0 auto;padding:12px 0">
  <div style="background:#fbf8f1;border:1px solid #d8cfbf;box-shadow:0 24px 48px rgba(74,58,33,0.12);font-family:ui-monospace,Menlo,Consolas,monospace;color:#1f1c16">
    <div style="padding:22px 28px 8px;text-align:center;font-size:11px;letter-spacing:0.38em;color:#8f8473">ATTENTION ACCOUNTING</div>
    <div style="padding:0 28px;text-align:center;font-size:42px;line-height:0.96;font-weight:800;letter-spacing:0.18em">WASTED<br>TIME</div>
    <div style="padding:16px 28px 2px;text-align:center;font-size:11px;letter-spacing:0.28em;color:#8f8473">ESTIMATED VALUE LOST</div>
    <div style="padding:0 28px 18px;text-align:center;font-size:30px;font-weight:700;letter-spacing:0.06em">${totalCostLabel}</div>
    <div style="border-top:1px dashed #d3c8b8"></div>
    <div style="padding:14px 28px;font-size:11px;line-height:1.8;color:#655d50">
      <strong style="color:#1f1c16">DATE:</strong> ${dateLabel}<br>
      <strong style="color:#1f1c16">RECEIPT:</strong> ${totals.receiptNumber}<br>
      <strong style="color:#1f1c16">TIMEZONE:</strong> ${totals.timezone}<br>
      <strong style="color:#1f1c16">RATE:</strong> ${hourlyRateLabel}/HR
    </div>
    <div style="border-top:1px dashed #d3c8b8"></div>
    <div style="padding:16px 28px 8px;font-size:11px;letter-spacing:0.28em;color:#8f8473">WHERE IT WENT</div>
    <div style="padding:0 28px 10px">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:12px;border-collapse:collapse">
        <thead>
          <tr>
            <th align="left" style="padding:0 0 8px;font-family:monospace;font-size:11px;letter-spacing:0.18em;color:#8f8473;font-weight:600">SOURCE</th>
            <th align="right" style="padding:0 0 8px;font-family:monospace;font-size:11px;letter-spacing:0.18em;color:#8f8473;font-weight:600">VIEWS</th>
            <th align="right" style="padding:0 0 8px;font-family:monospace;font-size:11px;letter-spacing:0.18em;color:#8f8473;font-weight:600">TIME</th>
            <th align="right" style="padding:0 0 8px;font-family:monospace;font-size:11px;letter-spacing:0.18em;color:#8f8473;font-weight:600">COST</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
    </div>
    <div style="border-top:1px dashed #d3c8b8;margin:0 28px"></div>
    <div style="padding:16px 28px 18px;font-size:12px;line-height:2">
      <div style="display:flex;justify-content:space-between;gap:12px"><span>TOTAL VIEWS</span><strong>${totals.totalViews}</strong></div>
      <div style="display:flex;justify-content:space-between;gap:12px"><span>TOTAL TIME</span><strong>${totalDuration}</strong></div>
      <div style="display:flex;justify-content:space-between;gap:12px;font-size:16px"><span>MONEY LOST</span><strong>${totalCostLabel}</strong></div>
    </div>
    <div style="border-top:1px dashed #d3c8b8"></div>
    <div style="padding:16px 28px 10px;text-align:center;font-size:11px;letter-spacing:0.24em;color:#655d50">PAID WITH YOUR ATTENTION</div>
    <div style="padding:0 28px 20px;text-align:center;font-size:10px;line-height:1.8;color:#8f8473">
      Estimated with a flat ${hourlyRateLabel}/hour opportunity cost.<br>
      <a href="${manageUrl}" style="color:#4c6757">Manage reports</a> ·
      <a href="${deleteUrl}" style="color:#4c6757">Delete my data</a><br>
      Scroll Receipt is not affiliated with Instagram, YouTube, or TikTok.
    </div>
  </div>
</div></body></html>`;

  return { subject, previewText, html, text };
}
