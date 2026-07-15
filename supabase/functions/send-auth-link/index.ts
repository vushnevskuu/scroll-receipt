import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUTH_WINDOW_MINUTES = 10;
const AUTH_WINDOW_LIMIT = 3;
const AUTH_DAILY_LIMIT = 8;
const EMAIL_SUPPRESSED_ERROR =
  'This email address is temporarily blocked because previous emails to it bounced or were marked as spam. Use another address or clear the suppression after fixing the inbox.';
const AUTH_RATE_LIMIT_ERROR =
  'Too many sign-in emails were requested for this address. Wait a few minutes before trying again.';

type Locale = 'ru' | 'en';
type AuthPurpose = 'sign-in' | 'delete-account';

interface RequestBody {
  email?: string;
  locale?: Locale;
  redirectTo?: string;
  purpose?: AuthPurpose;
}

interface ResendTag {
  name: string;
  value: string;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
    .eq('flow', 'auth_link')
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
    new Date(now - AUTH_WINDOW_MINUTES * 60_000).toISOString(),
  );
  if (recentAttempts >= AUTH_WINDOW_LIMIT) {
    throw new Error(AUTH_RATE_LIMIT_ERROR);
  }

  const dailyAttempts = await countAttempts(
    supabase,
    email,
    new Date(now - 24 * 60 * 60_000).toISOString(),
  );
  if (dailyAttempts >= AUTH_DAILY_LIMIT) {
    throw new Error(AUTH_RATE_LIMIT_ERROR);
  }
}

async function recordEmailAttempt(
  supabase: ReturnType<typeof createClient>,
  params: {
    email: string;
    status: 'sent' | 'failed' | 'blocked';
    providerMessageId?: string | null;
    error?: string | null;
  },
) {
  const { error } = await supabase.from('email_send_attempts').insert({
    email: params.email,
    flow: 'auth_link',
    status: params.status,
    provider_message_id: params.providerMessageId ?? null,
    error: params.error ?? null,
  });

  if (error) {
    console.warn('Failed to record auth email attempt', error.message);
  }
}

function getFallbackCallback(email: string): string {
  const url = new URL('auth.html', getPublicAppUrl());
  url.searchParams.set('email', email);
  return url.toString();
}

function sanitizeRedirectTo(redirectTo: string | undefined, email: string): string {
  if (!redirectTo) return getFallbackCallback(email);

  try {
    const url = new URL(redirectTo);
    if (url.protocol !== 'https:' && url.protocol !== 'chrome-extension:') {
      return getFallbackCallback(email);
    }
    return url.toString();
  } catch {
    return getFallbackCallback(email);
  }
}

function rewriteActionLink(actionLink: string, redirectTo: string): string {
  const url = new URL(actionLink);
  url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
}

function renderAuthEmail(
  email: string,
  otp: string,
  actionLink: string,
  locale: Locale,
  purpose: AuthPurpose,
) {
  const isDeletion = purpose === 'delete-account';
  const subject = isDeletion
    ? 'Confirm Scroll Receipt account deletion'
    : locale === 'ru'
      ? 'Вход в Scroll Receipt'
      : 'Sign in to Scroll Receipt';
  const preview = isDeletion
    ? 'Securely confirm deletion of your Scroll Receipt account and synced data.'
    : locale === 'ru'
      ? 'Код и ссылка для входа в Scroll Receipt.'
      : 'Your sign-in code and link for Scroll Receipt.';
  const heading = isDeletion ? 'ACCOUNT DELETION' : 'SCROLL RECEIPT SIGN-IN';
  const intro = isDeletion
    ? 'Open the secure link below to review and permanently delete your account. Ignore this email if you did not request deletion.'
    : locale === 'ru'
      ? 'Используйте код ниже или кнопку, чтобы подтвердить email в расширении.'
      : 'Use the code below or the button to verify your email in the app or extension.';
  const codeLabel = locale === 'ru' ? 'CODE' : 'CODE';
  const buttonLabel = isDeletion ? 'REVIEW ACCOUNT DELETION' : 'OPEN SIGN-IN LINK';
  const fallbackLabel = isDeletion
    ? 'If the button does not open, use this secure link:'
    : locale === 'ru'
      ? 'Если кнопка не открывается, вставьте эту ссылку в поле подтверждения:'
      : 'If the button does not open, paste this link into the verification field:';

  const text = [
    heading,
    '',
    intro,
    '',
    `${codeLabel}: ${otp}`,
    '',
    actionLink,
    '',
    `Email: ${email}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f4f0e8;color:#151515;font-family:'IBM Plex Mono',Menlo,Consolas,monospace">
    <div style="max-width:420px;margin:0 auto;background:#fbf8f1;border:1px solid #d8d1c4;padding:28px">
      <div style="font-size:12px;letter-spacing:0.35em;text-align:center;color:#7b7467">ATTENTION ACCOUNTING</div>
      <h1 style="margin:16px 0 8px;font-size:28px;letter-spacing:0.28em;text-align:center">${heading}</h1>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.7;color:#5f584c;text-align:center">${intro}</p>
      <div style="border-top:1px dashed #cfc7bb;border-bottom:1px dashed #cfc7bb;padding:18px 0;text-align:center">
        <div style="font-size:11px;letter-spacing:0.25em;color:#7b7467">${codeLabel}</div>
        <div style="margin-top:10px;font-size:34px;letter-spacing:0.35em;font-weight:700">${otp}</div>
      </div>
      <div style="margin-top:22px;text-align:center">
        <a href="${actionLink}" style="display:inline-block;background:#2f6f62;color:#fff;text-decoration:none;padding:14px 24px;font-size:12px;letter-spacing:0.24em;font-weight:700">${buttonLabel}</a>
      </div>
      <p style="margin:22px 0 8px;font-size:11px;line-height:1.7;color:#5f584c">${fallbackLabel}</p>
      <p style="margin:0;word-break:break-all;font-size:11px;line-height:1.7;color:#3a342b">${actionLink}</p>
      <p style="margin:20px 0 0;font-size:10px;color:#8d8578;text-align:center">${preview}</p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
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

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let requestEmail: string | null = null;

  try {
    const body = (await req.json()) as RequestBody;
    const email = body.email ? normalizeEmail(body.email) : undefined;
    requestEmail = email ?? null;
    const locale: Locale = body.locale === 'ru' ? 'ru' : 'en';
    const purpose: AuthPurpose = body.purpose === 'delete-account' ? 'delete-account' : 'sign-in';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Valid email required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Missing Supabase secrets' }, 500);
    }

    const redirectTo = sanitizeRedirectTo(body.redirectTo, email);
    const supabase = createClient(supabaseUrl, serviceKey);
    await assertEmailAllowed(supabase, email);
    await assertWithinRateLimit(supabase, email);

    const generated = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo,
      },
    });

    if (generated.error || !generated.data?.properties?.action_link || !generated.data.properties.email_otp) {
      const generateErrorMessage = generated.error?.message ?? 'Could not generate the sign-in link';
      await recordEmailAttempt(supabase, {
        email,
        status: 'failed',
        error: generateErrorMessage,
      });
      return json(
        {
          error: generateErrorMessage,
        },
        400,
      );
    }

    const actionLink = rewriteActionLink(generated.data.properties.action_link, redirectTo);
    const otp = generated.data.properties.email_otp;
    const emailContent = renderAuthEmail(email, otp, actionLink, locale, purpose);
    const message = await sendResendEmail(email, emailContent.subject, emailContent.html, emailContent.text, {
      tags: [
        { name: 'category', value: 'confirm_email' },
        {
          name: 'flow',
          value: purpose === 'delete-account' ? 'account_deletion' : 'scroll_receipt_auth',
        },
      ],
    });

    await recordEmailAttempt(supabase, {
      email,
      status: 'sent',
      providerMessageId: message.id,
    });

    return json({
      ok: true,
      messageId: message.id,
      verificationType: generated.data.properties.verification_type,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (requestEmail && supabaseUrl && serviceKey) {
        const supabase = createClient(supabaseUrl, serviceKey);
        await recordEmailAttempt(supabase, {
          email: requestEmail,
          status:
            message === EMAIL_SUPPRESSED_ERROR || message === AUTH_RATE_LIMIT_ERROR
              ? 'blocked'
              : 'failed',
          error: message,
        });
      }
    } catch {
      // Best-effort logging only.
    }

    return json({ error: message }, 400);
  }
});
