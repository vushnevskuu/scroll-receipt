alter table public.profiles
  add column if not exists locale text not null default 'en';

update public.profiles
set locale = 'en'
where locale is null or locale not in ('ru', 'en');

alter table public.profiles
  drop constraint if exists profiles_locale_check;

alter table public.profiles
  add constraint profiles_locale_check check (locale in ('ru', 'en'));
