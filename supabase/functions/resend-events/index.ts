import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Webhook } from 'https://esm.sh/svix@1.66.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, svix-id, svix-signature, svix-timestamp',
};

type ResendEventType =
  | 'email.bounced'
  | 'email.complained'
  | 'email.suppressed'
  | 'email.failed'
  | 'email.delivered'
  | 'email.sent';

interface ResendEventPayload {
  type: ResendEventType | string;
  created_at?: string;
  data?: {
    email_id?: string;
    message_id?: string;
    subject?: string;
    to?: string[];
    tags?: Array<{ name?: string; value?: string }>;
    failed?: { reason?: string };
    bounce?: { type?: string; subType?: string; message?: string };
  };
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getRecipient(event: ResendEventPayload): string | null {
  return event.data?.to?.[0]?.trim().toLowerCase() ?? null;
}

function getSuppressionReason(event: ResendEventPayload): string {
  if (event.type === 'email.complained') {
    return 'Recipient marked the email as spam.';
  }

  if (event.type === 'email.suppressed') {
    return 'Recipient is on the provider suppression list.';
  }

  return (
    event.data?.bounce?.message?.trim() ||
    event.data?.failed?.reason?.trim() ||
    'Recipient bounced on a previous delivery attempt.'
  );
}

function getServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase secrets');
  }

  return createClient(supabaseUrl, serviceKey);
}

function verifyWebhookRequest(payload: string, req: Request): ResendEventPayload {
  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  if (!webhookSecret) {
    throw new Error('RESEND_WEBHOOK_SECRET not configured');
  }

  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  };

  const verifier = new Webhook(webhookSecret);
  return verifier.verify(payload, headers) as ResendEventPayload;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const payload = await req.text();
    const event = verifyWebhookRequest(payload, req);
    const recipient = getRecipient(event);

    if (!recipient) {
      return json({ ok: true, ignored: true, reason: 'no-recipient' });
    }

    const supabase = getServiceClient();

    switch (event.type) {
      case 'email.bounced':
      case 'email.complained':
      case 'email.suppressed': {
        const { error: suppressionError } = await supabase.from('email_suppressions').upsert({
          email: recipient,
          reason: getSuppressionReason(event),
          source_event: event.type,
          source_message_id: event.data?.message_id ?? event.data?.email_id ?? null,
          last_payload: event,
        });

        if (suppressionError) {
          throw suppressionError;
        }

        const { error } = await supabase
          .from('profiles')
          .update({ report_enabled: false })
          .eq('email', recipient);

        if (error) {
          throw error;
        }

        return json({
          ok: true,
          action: 'disabled-reporting',
          recipient,
          eventType: event.type,
        });
      }

      case 'email.failed':
        console.warn('Resend email.failed', event.data?.failed?.reason ?? 'unknown', recipient);
        return json({
          ok: true,
          action: 'logged-failure',
          recipient,
          eventType: event.type,
          reason: event.data?.failed?.reason ?? null,
        });

      default:
        return json({
          ok: true,
          action: 'ignored',
          recipient,
          eventType: event.type,
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook';
    return json({ error: message }, 400);
  }
});
