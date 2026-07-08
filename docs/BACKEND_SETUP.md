# Backend setup — Scroll Receipt

Project: **scroll-receipt** (`lqkxaykwsnrouqwsbivr`)  
URL: https://lqkxaykwsnrouqwsbivr.supabase.co  
Dashboard: https://supabase.com/dashboard/project/lqkxaykwsnrouqwsbivr

## Already configured

- PostgreSQL schema (profiles, device_usage, receipt_deliveries + RLS)
- Edge Functions: `sync-usage`, `send-test-receipt`, `daily-receipt`
- pg_cron job every 5 minutes → `daily-receipt`
- Extension `.env` with anon key (local build)

## Required: production email sender

Emails won't send until you add Resend API key to Supabase. This is required for:

- `send-test-receipt`
- `daily-receipt`
- `send-auth-link` (custom auth mailer for extension sign-in)

1. Create account at https://resend.com
2. Add and verify a domain you control in Resend:
   - Docs: https://resend.com/docs/dashboard/domains/introduction
   - Important: `onboarding@resend.dev` is test-only and cannot send to all users
3. Create API key
4. Supabase → Project → Edge Functions → Secrets:

```
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM=Scroll Receipt <hello@mail.yourdomain.com>
```

`RESEND_FROM` must use the verified domain from step 2. The site can stay on GitHub Pages; the sender domain is a separate requirement from the website URL.

Optional local-only test mode:

```
RESEND_FROM=Scroll Receipt <onboarding@resend.dev>
RESEND_ALLOW_TEST_MODE=true
```

This mode only sends to the Resend account owner's email and is not valid for public users.

## Enable email auth (Supabase)

Dashboard → Authentication → Providers → Email → enable **Email OTP**.

Optional: disable "Confirm email" double opt-in if OTP alone is enough.

## Extension setup

```bash
# already created:
# apps/extension/.env

pnpm build
# Reload unpacked extension in chrome://extensions
```

## User flow

1. Open extension **Options**
2. Accept privacy → enter email → OTP code
3. Click **Send test receipt** to verify email
4. Daily receipt arrives at **18:00 local time** for **yesterday's** activity

## Troubleshooting

| Issue | Fix |
|-------|-----|
| OTP not arriving | Check Supabase Auth email settings / spam |
| Test receipt fails | Add `RESEND_API_KEY` secret, redeploy not needed |
| No daily email | Need activity synced + `report_enabled` + Resend configured |
| Sync pending | Sign in via OTP first |
