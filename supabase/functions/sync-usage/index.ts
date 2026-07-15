import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { z } from 'https://esm.sh/zod@3.24.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const recordSchema = z.object({
  deviceId: z.string().uuid(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().min(1).max(64),
  platform: z.enum(['instagram', 'youtube', 'tiktok']),
  seconds: z.number().int().min(0).max(86400),
  views: z.number().int().min(0).max(10000),
  clientUpdatedAt: z.string().datetime(),
});

const batchSchema = z.object({
  records: z.array(recordSchema).min(1).max(12),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const body = batchSchema.parse(await req.json());
    const userId = userData.user.id;

    for (const record of body.records) {
      const { error } = await supabase.from('device_usage').upsert(
        {
          user_id: userId,
          device_id: record.deviceId,
          local_date: record.localDate,
          platform: record.platform,
          seconds: record.seconds,
          views: record.views,
          client_updated_at: record.clientUpdatedAt,
          server_updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,device_id,local_date,platform' },
      );
      if (error) throw error;
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('report_enabled, report_time_local, locale')
      .eq('user_id', userId)
      .maybeSingle();

    await supabase.from('profiles').upsert(
      {
        user_id: userId,
        email: userData.user.email?.trim().toLowerCase() ?? '',
        timezone: body.records[0]?.timezone ?? 'UTC',
        report_time_local: existingProfile?.report_time_local ?? '18:00',
        report_enabled: existingProfile?.report_enabled ?? true,
        locale: existingProfile?.locale ?? 'en',
      },
      { onConflict: 'user_id' },
    );

    return new Response(JSON.stringify({ ok: true }), {
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
