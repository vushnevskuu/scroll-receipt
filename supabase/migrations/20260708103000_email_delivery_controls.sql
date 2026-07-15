create table if not exists public.email_suppressions (
  email text primary key,
  reason text not null,
  source_event text not null,
  source_message_id text,
  last_payload jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.email_send_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  flow text not null check (flow in ('auth_link', 'test_receipt', 'daily_receipt')),
  user_id uuid references auth.users (id) on delete set null,
  status text not null check (status in ('sent', 'failed', 'blocked')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists email_send_attempts_email_flow_created_idx
  on public.email_send_attempts (email, flow, created_at desc);
create index if not exists email_send_attempts_user_flow_created_idx
  on public.email_send_attempts (user_id, flow, created_at desc)
  where user_id is not null;

update public.profiles
set email = lower(trim(email))
where email <> lower(trim(email));

alter table public.email_suppressions enable row level security;
alter table public.email_send_attempts enable row level security;

revoke all on table public.email_suppressions from public, anon, authenticated;
revoke all on table public.email_send_attempts from public, anon, authenticated;

grant select, insert, update, delete on table public.email_suppressions to service_role;
grant select, insert on table public.email_send_attempts to service_role;

drop policy if exists "Service role can manage email suppressions" on public.email_suppressions;
create policy "Service role can manage email suppressions"
on public.email_suppressions
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can read email attempts" on public.email_send_attempts;
create policy "Service role can read email attempts"
on public.email_send_attempts
for select
to service_role
using (true);

drop policy if exists "Service role can insert email attempts" on public.email_send_attempts;
create policy "Service role can insert email attempts"
on public.email_send_attempts
for insert
to service_role
with check (true);

create or replace function public.handle_email_suppressions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists email_suppressions_updated_at on public.email_suppressions;
create trigger email_suppressions_updated_at
  before update on public.email_suppressions
  for each row execute function public.handle_email_suppressions_updated_at();
