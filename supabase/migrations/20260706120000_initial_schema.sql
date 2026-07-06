-- Scroll Receipt schema v2

create type platform_type as enum ('instagram', 'youtube', 'tiktok');

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  timezone text not null default 'UTC',
  report_enabled boolean not null default true,
  report_time_local text not null default '00:05',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.device_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid not null,
  local_date date not null,
  platform platform_type not null,
  seconds integer not null default 0 check (seconds >= 0 and seconds <= 86400),
  views integer not null default 0 check (views >= 0 and views <= 10000),
  client_updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  unique (user_id, device_id, local_date, platform)
);

create table if not exists public.receipt_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  status text not null default 'pending',
  provider_message_id text,
  attempt_count integer not null default 0,
  sent_at timestamptz,
  last_error text,
  unique (user_id, usage_date)
);

create index if not exists device_usage_user_date_idx on public.device_usage (user_id, local_date);

alter table public.profiles enable row level security;
alter table public.device_usage enable row level security;
alter table public.receipt_deliveries enable row level security;

create policy profiles_select_own on public.profiles
  for select using (auth.uid() = user_id);

create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = user_id);

create policy profiles_update_own on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy device_usage_select_own on public.device_usage
  for select using (auth.uid() = user_id);

create policy device_usage_insert_own on public.device_usage
  for insert with check (auth.uid() = user_id);

create policy device_usage_update_own on public.device_usage
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy device_usage_delete_own on public.device_usage
  for delete using (auth.uid() = user_id);

-- receipt_deliveries: no client write policies (service role only)

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();
