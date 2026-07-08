import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Locale = 'ru' | 'en';

interface RequestBody {
  email?: string;
  locale?: Locale;
  redirectTo?: string;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getFallbackCallback(email: string): string {
  const url = new URL('https://vushnevskuu.github.io/scroll-receipt/auth.html');
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

function renderAuthEmail(email: string, otp: string, actionLink: string, locale: Locale) {
  const subject =
    locale === 'ru' ? 'Вход в Scroll Receipt' : 'Sign in to Scroll Receipt';
  const preview =
    locale === 'ru'
      ? 'Код и ссылка для входа в Scroll Receipt.'
      : 'Your sign-in code and link for Scroll Receipt.';
  const heading = locale === 'ru' ? 'SCROLL RECEIPT SIGN-IN' : 'SCROLL RECEIPT SIGN-IN';
  const intro =
    locale === 'ru'
      ? 'Используйте код ниже или кнопку, чтобы подтвердить email в расширении.'
      : 'Use the code below or the button to verify your email in the extension.';
  const codeLabel = locale === 'ru' ? 'CODE' : 'CODE';
  const buttonLabel = locale === 'ru' ? 'OPEN SIGN-IN LINK' : 'OPEN SIGN-IN LINK';
  const fallbackLabel =
    locale === 'ru'
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

async function sendResendEmail(to: string, subject: string, html: string, text: string) {
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
    body: JSON.stringify({ from, to, subject, html, text }),
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

  try {
    const body = (await req.json()) as RequestBody;
    const email = body.email?.trim().toLowerCase();
    const locale: Locale = body.locale === 'ru' ? 'ru' : 'en';

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
    const generated = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo,
      },
    });

    if (generated.error || !generated.data?.properties?.action_link || !generated.data.properties.email_otp) {
      return json(
        {
          error:
            generated.error?.message ?? 'Could not generate the sign-in link',
        },
        400,
      );
    }

    const actionLink = rewriteActionLink(generated.data.properties.action_link, redirectTo);
    const otp = generated.data.properties.email_otp;
    const emailContent = renderAuthEmail(email, otp, actionLink, locale);
    const message = await sendResendEmail(email, emailContent.subject, emailContent.html, emailContent.text);

    return json({
      ok: true,
      messageId: message.id,
      verificationType: generated.data.properties.verification_type,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 400);
  }
});
