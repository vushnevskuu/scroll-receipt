import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  generateReceiptNumber,
  getPreviousLocalDate,
  renderEmailReceipt,
  type Platform,
} from './_shared/receipt.ts';

const RECEIPT_SEND_WINDOW_MINUTES = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const PLATFORMS: Platform[] = ['instagram', 'youtube', 'tiktok'];

function isReportDueNow(timezone: string, reportTimeLocal: string, now = new Date()): boolean {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const currentMinutes = hour * 60 + minute;

  const [rh, rm] = reportTimeLocal.split(':').map(Number);
  const targetMinutes = (rh ?? 0) * 60 + (rm ?? 0);

  return (
    currentMinutes >= targetMinutes &&
    currentMinutes < targetMinutes + RECEIPT_SEND_WINDOW_MINUTES
  );
}

async function sendResendEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');
  const configuredFrom = Deno.env.get('RESEND_FROM');
  const fallbackFrom = 'Scroll Receipt <onboarding@resend.dev>';
  const attempt = async (from: string) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    const responseText = await res.text();
    return { ok: res.ok, responseText };
  };

  const first = await attempt(configuredFrom ?? fallbackFrom);
  if (first.ok) {
    return JSON.parse(first.responseText) as { id: string };
  }

  const shouldRetryWithFallback =
    configuredFrom &&
    configuredFrom !== fallbackFrom &&
    first.responseText.includes('domain is not verified');

  if (shouldRetryWithFallback) {
    const fallback = await attempt(fallbackFrom);
    if (fallback.ok) {
      return JSON.parse(fallback.responseText) as { id: string };
    }
    throw new Error(fallback.responseText);
  }

  throw new Error(first.responseText);
}

function authorizeCron(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) return true;
  return req.headers.get('x-cron-secret') === cronSecret;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!authorizeCron(req)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!serviceKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: 'Missing Supabase secrets' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const manageUrl = 'https://vushnevskuu.github.io/scroll-receipt/';
  const deleteUrl = manageUrl;

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('user_id, email, timezone, locale, report_enabled, report_time_local')
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
      profile.locale === 'ru' ? 'ru' : 'en',
      manageUrl,
      deleteUrl,
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
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
