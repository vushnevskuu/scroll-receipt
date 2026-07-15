import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  generateReceiptNumber,
  getPreviousLocalDate,
  renderEmailReceipt,
  type Platform,
} from './_shared/receipt.ts';

const RECEIPT_SEND_WINDOW_MINUTES = 5;
const CRON_SECRET_NAME = 'daily_receipt';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const PLATFORMS: Platform[] = ['instagram', 'youtube', 'tiktok'];

interface ResendTag {
  name: string;
  value: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }

  return diff === 0;
}

function getPublicAppUrl(): string {
  return Deno.env.get('PUBLIC_APP_URL')?.trim() || 'https://scroll.outthere.day/';
}

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

async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  options?: { tags?: ResendTag[]; idempotencyKey?: string },
) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const from = Deno.env.get('RESEND_FROM')?.trim();
  if (!from) {
    throw new Error(
      'RESEND_FROM not configured. Set it to a verified sender address, for example Scroll Receipt <hello@mail.yourdomain.com>.',
    );
  }

  const allowTestMode = Deno.env.get('RESEND_ALLOW_TEST_MODE') === 'true';
  if (!allowTestMode && from.toLowerCase().includes('onboarding@resend.dev')) {
    throw new Error(
      'Resend test mode is enabled. Verify a domain in Resend and set RESEND_FROM to an address on that domain before sending emails to users.',
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (options?.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
      tags: options?.tags,
    }),
  });

  const responseText = await res.text();
  if (!res.ok) {
    if (responseText.includes('domain is not verified')) {
      throw new Error(
        'Resend sender domain is not verified. Verify the domain in Resend and keep RESEND_FROM on that domain.',
      );
    }
    throw new Error(`Resend error: ${responseText}`);
  }

  return JSON.parse(responseText) as { id: string };
}

async function isSuppressedEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  const { data, error } = await supabase
    .from('email_suppressions')
    .select('email')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.email);
}

async function recordEmailAttempt(
  supabase: ReturnType<typeof createClient>,
  params: {
    email: string;
    userId: string;
    status: 'sent' | 'failed' | 'blocked';
    providerMessageId?: string | null;
    error?: string | null;
  },
) {
  const { error } = await supabase.from('email_send_attempts').insert({
    email: params.email,
    flow: 'daily_receipt',
    user_id: params.userId,
    status: params.status,
    provider_message_id: params.providerMessageId ?? null,
    error: params.error ?? null,
  });

  if (error) {
    console.warn('Failed to record daily receipt attempt', error.message);
  }
}

async function authorizeCron(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  const providedSecret = req.headers.get('x-cron-secret')?.trim();
  if (!providedSecret) return false;

  const { data, error } = await supabase
    .from('cron_secrets')
    .select('sha256')
    .eq('name', CRON_SECRET_NAME)
    .maybeSingle();

  if (error || !data?.sha256) {
    console.error('Missing cron secret hash', error?.message ?? 'no-row');
    return false;
  }

  const providedHash = await sha256(providedSecret);
  return timingSafeEqual(providedHash, data.sha256);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!serviceKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: 'Missing Supabase secrets' }), { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  if (!(await authorizeCron(req, supabase))) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const manageUrl = getPublicAppUrl();
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
    const recipientEmail = normalizeEmail(profile.email ?? '');
    if (!recipientEmail) continue;

    const { data: existing } = await supabase
      .from('receipt_deliveries')
      .select('id, status, attempt_count')
      .eq('user_id', profile.user_id)
      .eq('usage_date', usageDate)
      .maybeSingle();

    if (existing?.status === 'sent') continue;

    if (await isSuppressedEmail(supabase, recipientEmail)) {
      await supabase
        .from('profiles')
        .update({ report_enabled: false })
        .eq('user_id', profile.user_id);

      await supabase.from('receipt_deliveries').upsert({
        user_id: profile.user_id,
        usage_date: usageDate,
        status: 'failed',
        last_error: 'Recipient suppressed after a previous bounce or complaint.',
        attempt_count: (existing?.attempt_count ?? 0) + 1,
      });

      await recordEmailAttempt(supabase, {
        email: recipientEmail,
        userId: profile.user_id,
        status: 'blocked',
        error: 'Recipient suppressed after a previous bounce or complaint.',
      });
      continue;
    }

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
      const result = await sendResendEmail(recipientEmail, email.subject, email.html, email.text, {
        idempotencyKey: `daily-${profile.user_id}-${usageDate}`,
        tags: [
          { name: 'category', value: 'daily_receipt' },
          { name: 'usage_date', value: usageDate.replace(/-/g, '') },
        ],
      });
      await supabase.from('receipt_deliveries').upsert({
        user_id: profile.user_id,
        usage_date: usageDate,
        status: 'sent',
        provider_message_id: result.id,
        sent_at: new Date().toISOString(),
        attempt_count: (existing?.attempt_count ?? 0) + 1,
      });
      await recordEmailAttempt(supabase, {
        email: recipientEmail,
        userId: profile.user_id,
        status: 'sent',
        providerMessageId: result.id,
      });
      sent += 1;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown';
      await supabase.from('receipt_deliveries').upsert({
        user_id: profile.user_id,
        usage_date: usageDate,
        status: 'failed',
        last_error: errorMessage,
        attempt_count: (existing?.attempt_count ?? 0) + 1,
      });
      await recordEmailAttempt(supabase, {
        email: recipientEmail,
        userId: profile.user_id,
        status: 'failed',
        error: errorMessage,
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
});
