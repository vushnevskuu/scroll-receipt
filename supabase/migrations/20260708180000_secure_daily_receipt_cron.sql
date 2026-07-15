create table if not exists public.cron_secrets (
  name text primary key,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.cron_secrets enable row level security;

revoke all on table public.cron_secrets from public, anon, authenticated;
grant select on table public.cron_secrets to service_role;

drop policy if exists "Service role can read cron secrets" on public.cron_secrets;

create policy "Service role can read cron secrets"
on public.cron_secrets
for select
to service_role
using (true);

do $$
declare
  cron_secret_name constant text := 'daily_receipt_cron_secret';
  secret_description constant text := 'Daily receipt cron invocation secret';
  secret_id uuid;
  raw_secret text := encode(gen_random_bytes(32), 'hex');
begin
  select id
  into secret_id
  from vault.decrypted_secrets
  where name = cron_secret_name
  limit 1;

  if secret_id is null then
    perform vault.create_secret(raw_secret, cron_secret_name, secret_description);
  else
    perform vault.update_secret(secret_id, raw_secret, cron_secret_name, secret_description);
  end if;

  insert into public.cron_secrets (name, sha256)
  values ('daily_receipt', encode(digest(raw_secret, 'sha256'), 'hex'))
  on conflict (name) do update
  set sha256 = excluded.sha256,
      updated_at = timezone('utc', now());

  if exists (
    select 1
    from cron.job
    where jobname = 'scroll-receipt-daily-receipt'
  ) then
    perform cron.unschedule('scroll-receipt-daily-receipt');
  end if;

  perform cron.schedule(
    'scroll-receipt-daily-receipt',
    '*/5 * * * *',
    $cron$
      select net.http_post(
        url := 'https://lqkxaykwsnrouqwsbivr.supabase.co/functions/v1/daily-receipt',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'daily_receipt_cron_secret'
          )
        ),
        body := '{}'::jsonb
      ) as request_id;
    $cron$
  );
end
$$;
