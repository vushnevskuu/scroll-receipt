-- Default daily receipt send time: 18:00 local

alter table public.profiles
  alter column report_time_local set default '18:00';

update public.profiles
set report_time_local = '18:00'
where report_time_local = '00:05';
