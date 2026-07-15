import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { renderEmailReceipt, type Platform } from './_shared/receipt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEST_WINDOW_MINUTES = 10;
const TEST_WINDOW_LIMIT = 2;
const TEST_DAILY_LIMIT = 6;
const EMAIL_SUPPRESSED_ERROR =
  'This email address is temporarily blocked because previous emails to it bounced or were marked as spam. Use another address or clear the suppression after fixing the inbox.';
const TEST_RATE_LIMIT_ERROR =
  'Too many test receipts were requested for this address. Wait a few minutes before trying again.';

interface ResendTag {
  name: string;
  value: string;
}

function getPublicAppUrl(): string {
  return Deno.env.get('PUBLIC_APP_URL')?.trim() || 'https://scroll.outthere.day/';
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function assertEmailAllowed(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  const { data, error } = await supabase
    .from('email_suppressions')
    .select('email')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  if (data?.email) throw new Error(EMAIL_SUPPRESSED_ERROR);
}

async function countAttempts(
  supabase: ReturnType<typeof createClient>,
  email: string,
  sinceIso: string,
) {
  const { count, error } = await supabase
    .from('email_send_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('email', email)
    .eq('flow', 'test_receipt')
    .in('status', ['sent', 'failed'])
    .gte('created_at', sinceIso);

  if (error) throw error;
  return count ?? 0;
}

async function assertWithinRateLimit(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  const now = Date.now();
  const recentAttempts = await countAttempts(
    supabase,
    email,
    new Date(now - TEST_WINDOW_MINUTES * 60_000).toISOString(),
  );
  if (recentAttempts >= TEST_WINDOW_LIMIT) {
    throw new Error(TEST_RATE_LIMIT_ERROR);
  }

  const dailyAttempts = await countAttempts(
    supabase,
    email,
    new Date(now - 24 * 60 * 60_000).toISOString(),
  );
  if (dailyAttempts >= TEST_DAILY_LIMIT) {
    throw new Error(TEST_RATE_LIMIT_ERROR);
  }
}

async function recordEmailAttempt(
  supabase: ReturnType<typeof createClient>,
  params: {
    email: string;
    userId?: string | null;
    status: 'sent' | 'failed' | 'blocked';
    providerMessageId?: string | null;
    error?: string | null;
  },
) {
  const { error } = await supabase.from('email_send_attempts').insert({
    email: params.email,
    flow: 'test_receipt',
    user_id: params.userId ?? null,
    status: params.status,
    provider_message_id: params.providerMessageId ?? null,
    error: params.error ?? null,
  });

  if (error) {
    console.warn('Failed to record test receipt attempt', error.message);
  }
}

async function sendResendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  options?: { tags?: ResendTag[] },
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

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestEmail: string | null = null;
  let requestUserId: string | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from('profiles')
      .select('email, timezone, locale')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    const emailAddress = normalizeEmail(userData.user.email ?? profile?.email ?? '');
    if (!emailAddress) {
      return new Response(JSON.stringify({ error: 'No verified email on this account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    requestEmail = emailAddress;
    requestUserId = userData.user.id;

    await assertEmailAllowed(admin, emailAddress);
    await assertWithinRateLimit(admin, emailAddress);

    const requestedLocale = new URL(req.url).searchParams.get('locale');
    const locale =
      requestedLocale === 'ru'
        ? 'ru'
        : requestedLocale === 'en'
          ? 'en'
          : profile?.locale === 'ru'
            ? 'ru'
            : 'en';
    const today = new Date().toISOString().slice(0, 10);
    const manageUrl = getPublicAppUrl();
    const timezone = profile?.timezone ?? 'UTC';

    const platforms: Record<Platform, { seconds: number; views: number }> = {
      instagram: { seconds: 120, views: 5 },
      youtube: { seconds: 90, views: 3 },
      tiktok: { seconds: 60, views: 4 },
    };

    const totalSeconds = Object.values(platforms).reduce((s, p) => s + p.seconds, 0);
    const totalViews = Object.values(platforms).reduce((s, p) => s + p.views, 0);

    const email = renderEmailReceipt(
      {
        date: today,
        timezone,
        receiptNumber: `SR-TEST-${userData.user.id.slice(0, 4).toUpperCase()}`,
        platforms,
        totalSeconds,
        totalViews,
      },
      locale,
      manageUrl,
      manageUrl,
    );

    const result = await sendResendEmail(emailAddress, email.subject, email.html, email.text, {
      tags: [
        { name: 'category', value: 'test_receipt' },
        { name: 'flow', value: 'extension_test' },
      ],
    });

    await recordEmailAttempt(admin, {
      email: emailAddress,
      userId: userData.user.id,
      status: 'sent',
      providerMessageId: result.id,
    });

    return new Response(JSON.stringify({ ok: true, messageId: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (requestEmail && supabaseUrl && serviceKey) {
        const admin = createClient(supabaseUrl, serviceKey);
        await recordEmailAttempt(admin, {
          email: requestEmail,
          userId: requestUserId,
          status:
            message === EMAIL_SUPPRESSED_ERROR || message === TEST_RATE_LIMIT_ERROR
              ? 'blocked'
              : 'failed',
          error: message,
        });
      }
    } catch {
      // Best-effort logging only.
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
