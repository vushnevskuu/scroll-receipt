import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { renderEmailReceipt, type Platform } from './_shared/receipt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendResendEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const configuredFrom = Deno.env.get('RESEND_FROM');
  const fallbackFrom = 'Scroll Receipt <onboarding@resend.dev>';
  const attempt = async (from: string) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
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
    throw new Error(`Resend error: ${fallback.responseText}`);
  }

  throw new Error(`Resend error: ${first.responseText}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const locale = (new URL(req.url).searchParams.get('locale') ?? 'ru') as 'ru' | 'en';
    const today = new Date().toISOString().slice(0, 10);
    const manageUrl = 'https://vushnevskuu.github.io/scroll-receipt/';

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
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        receiptNumber: `SR-TEST-${userData.user.id.slice(0, 4).toUpperCase()}`,
        platforms,
        totalSeconds,
        totalViews,
      },
      locale,
      manageUrl,
      manageUrl,
    );

    const result = await sendResendEmail(userData.user.email!, email.subject, email.html, email.text);

    return new Response(JSON.stringify({ ok: true, messageId: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
