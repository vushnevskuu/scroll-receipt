import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Missing Supabase secrets' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data, error: userError } = await userClient.auth.getUser();
    if (userError || !data.user?.email) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = data.user.email.trim().toLowerCase();

    const { error: attemptsError } = await admin
      .from('email_send_attempts')
      .delete()
      .or(`user_id.eq.${data.user.id},email.eq.${email}`);
    if (attemptsError) throw attemptsError;

    const { error: suppressionError } = await admin
      .from('email_suppressions')
      .delete()
      .eq('email', email);
    if (suppressionError) throw suppressionError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
    if (deleteError) throw deleteError;

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not delete account';
    return json({ error: message }, 400);
  }
});
