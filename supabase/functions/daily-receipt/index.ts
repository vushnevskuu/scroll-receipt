import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { renderEmailReceipt } from '../../../packages/shared/src/email-receipt.ts';
import {
  formatReceiptDate,
  generateReceiptNumber,
  getPreviousLocalDate,
} from '../../../packages/shared/src/format.ts';
import type { Platform } from '../../../packages/shared/src/types.ts';

const PLATFORMS: Platform[] = ['instagram', 'youtube', 'tiktok'];

function isReportDueNow(timezone: string, reportTimeLocal: string, now = new Date()): boolean {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const current = `${hour}:${minute}`;
  const [rh, rm] = reportTimeLocal.split(':');
  const target = `${rh?.padStart(2, '0')}:${rm?.padStart(2, '0')}`;
  return current === target;
}

async function sendResendEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');
  const from = Deno.env.get('RESEND_FROM') ?? 'Scroll Receipt <receipts@scrollreceipt.app>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ id: string }>;
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!serviceKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: 'Missing Supabase secrets' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('user_id, email, timezone, report_enabled, report_time_local')
    .eq('report_enabled', true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;

  for (const profile of profiles ?? []) {
    if (!isReportDueNow(profile.timezone, profile.report_time_local)) continue;

    const usageDate = getPreviousLocalDate(profile.timezone);
    const { data: existing } = await supabase
      .from('receipt_deliveries')
      .select('id, status, attempt_count')
      .eq('user_id', profile.user_id)
      .eq('usage_date', usageDate)
      .maybeSingle();

    if (existing?.status === 'sent') continue;

    const { data: rows } = await supabase
      .from('device_usage')
      .select('platform, seconds, views')
      .eq('user_id', profile.user_id)
      .eq('local_date', usageDate);

    const platforms: Record<Platform, { seconds: number; views: number }> = {
      instagram: { seconds: 0, views: 0 },
      youtube: { seconds: 0, views: 0 },
      tiktok: { seconds: 0, views: 0 },
    };

    for (const row of rows ?? []) {
      const p = row.platform as Platform;
      if (!PLATFORMS.includes(p)) continue;
      platforms[p].seconds += row.seconds;
      platforms[p].views += row.views;
    }

    const totalSeconds = PLATFORMS.reduce((s, p) => s + platforms[p].seconds, 0);
    const totalViews = PLATFORMS.reduce((s, p) => s + platforms[p].views, 0);

    if (totalSeconds === 0 && totalViews === 0) continue;

    const receiptNumber = generateReceiptNumber(usageDate, profile.user_id);
    const email = renderEmailReceipt(
      {
        date: usageDate,
        timezone: profile.timezone,
        receiptNumber,
        platforms,
        totalSeconds,
        totalViews,
      },
      'ru',
      `${supabaseUrl}/functions/v1/settings-link`,
      `${supabaseUrl}/functions/v1/delete-data`,
    );

    try {
      const result = await sendResendEmail(profile.email, email.subject, email.html, email.text);
      await supabase.from('receipt_deliveries').upsert({
        user_id: profile.user_id,
        usage_date: usageDate,
        status: 'sent',
        provider_message_id: result.id,
        sent_at: new Date().toISOString(),
        attempt_count: (existing?.attempt_count ?? 0) + 1,
      });
      sent += 1;
    } catch (e) {
      await supabase.from('receipt_deliveries').upsert({
        user_id: profile.user_id,
        usage_date: usageDate,
        status: 'failed',
        last_error: e instanceof Error ? e.message : 'Unknown',
        attempt_count: (existing?.attempt_count ?? 0) + 1,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
