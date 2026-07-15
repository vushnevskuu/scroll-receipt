create policy "receipt_deliveries_select_own"
on public.receipt_deliveries
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to public
using ((select auth.uid()) = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to public
with check ((select auth.uid()) = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to public
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists device_usage_select_own on public.device_usage;
create policy device_usage_select_own
on public.device_usage
for select
to public
using ((select auth.uid()) = user_id);

drop policy if exists device_usage_insert_own on public.device_usage;
create policy device_usage_insert_own
on public.device_usage
for insert
to public
with check ((select auth.uid()) = user_id);

drop policy if exists device_usage_update_own on public.device_usage;
create policy device_usage_update_own
on public.device_usage
for update
to public
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists device_usage_delete_own on public.device_usage;
create policy device_usage_delete_own
on public.device_usage
for delete
to public
using ((select auth.uid()) = user_id);

create or replace function public.handle_email_suppressions_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;
