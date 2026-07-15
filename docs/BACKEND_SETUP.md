# Backend setup — Scroll Receipt

Project: **scroll-receipt** (`lqkxaykwsnrouqwsbivr`)  
URL: https://lqkxaykwsnrouqwsbivr.supabase.co  
Dashboard: https://supabase.com/dashboard/project/lqkxaykwsnrouqwsbivr

## Already configured

- PostgreSQL schema (profiles, device_usage, receipt_deliveries + RLS)
- Edge Functions: `sync-usage`, `send-auth-link`, `send-test-receipt`, `daily-receipt`, `resend-events`
- pg_cron job every 5 minutes → `daily-receipt`
- Cron auth is stored in Supabase Vault and validated by the function
- Email suppression and email attempt audit tables are live in Postgres
- Extension `.env` with anon key (local build)

## Required: production email sender

Emails won't send until you add Resend API key to Supabase. This is required for:

- `send-test-receipt`
- `daily-receipt`
- `send-auth-link` (custom auth mailer for extension sign-in)
- `resend-events` (webhook handler for bounce/complaint/suppression events)

1. Create account at https://resend.com
2. Add and verify a domain you control in Resend:
   - Docs: https://resend.com/docs/dashboard/domains/introduction
   - Important: `onboarding@resend.dev` is test-only and cannot send to all users
3. Create API key
4. Supabase → Project → Edge Functions → Secrets:

```
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM=Scroll Receipt <hello@mail.yourdomain.com>
PUBLIC_APP_URL=https://app.yourdomain.com/
```

`RESEND_FROM` must use the verified domain from step 2.

Important for deliverability:
- Resend recommends using a subdomain for sending, for example `mail.yourdomain.com` or `updates.yourdomain.com`
- Resend also recommends that links inside the email match your sending domain family
- For this project, set `PUBLIC_APP_URL` to your public app domain, for example `https://app.yourdomain.com/`

Recommended production setup:
- App / landing: `https://app.yourdomain.com/`
- Sender: `Scroll Receipt <hello@mail.yourdomain.com>`

Optional local-only test mode:

```
RESEND_FROM=Scroll Receipt <onboarding@resend.dev>
RESEND_ALLOW_TEST_MODE=true
```

This mode only sends to the Resend account owner's email and is not valid for public users.

## Recommended: Resend webhook for reputation safety

Create a webhook in Resend pointing to:

```text
https://lqkxaykwsnrouqwsbivr.supabase.co/functions/v1/resend-events
```

Select these events:
- `email.bounced`
- `email.complained`
- `email.suppressed`
- `email.failed`

Then add one more secret in Supabase Edge Functions:

```text
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxx
```

This project will verify the webhook signature and automatically disable future daily receipts for addresses that bounce, complain, or become suppressed.

## Built-in delivery safeguards

These protections are already implemented in production:

- `send-auth-link` checks the suppression list before sending
- `send-test-receipt` checks the suppression list before sending
- `daily-receipt` checks the suppression list before sending
- bounced / complained / suppressed recipients are stored in `public.email_suppressions`
- every auth / test / daily email attempt can be logged in `public.email_send_attempts`
- auth emails are app-rate-limited to reduce abuse and protect sender reputation
- test receipts are app-rate-limited to reduce abuse and protect sender reputation

Current app-level rate limits:

- Sign-in email: 3 per 10 minutes per address, 8 per 24 hours per address
- Test receipt: 2 per 10 minutes per address, 6 per 24 hours per address

These are in addition to any Resend or Supabase Auth provider-side limits.

## Recovering a suppressed address

If a real user fixes their inbox and should receive mail again:

1. Open the recipient in the Resend Emails dashboard
2. Use **Remove from suppression list**
   Docs: https://resend.com/docs/dashboard/emails/email-suppressions
3. Re-enable reports for that address in Supabase if needed:

```sql
update public.profiles
set report_enabled = true
where email = lower('user@example.com');

delete from public.email_suppressions
where email = lower('user@example.com');
```

Only do this after the underlying inbox issue is actually fixed, otherwise Resend will suppress the address again on the next failure.

## Daily receipt cron security

`daily-receipt` should never stay publicly callable in production.

This project now uses:
- a raw cron secret stored in `vault.decrypted_secrets` as `daily_receipt_cron_secret`
- a SHA-256 hash of that secret in `public.cron_secrets`
- `pg_cron` sends the raw secret in the `x-cron-secret` header
- the Edge Function compares the header value against the stored hash before sending mail

If you ever recreate the cron job manually, keep that header in place.

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
| OTP not arriving | Check Resend domain verification, auth email flow, spam, and sender domain alignment |
| Address is blocked after a bounce or spam complaint | Remove it from Resend suppression list, then clear it from `public.email_suppressions` and re-enable `report_enabled` |
| Too many sign-in/test emails | Wait for the app cooldown window, then retry. This protects sender reputation and reduces provider throttling |
| Test receipt fails | Add `RESEND_API_KEY` secret, redeploy not needed |
| No daily email | Need activity synced + `report_enabled` + Resend configured |
| Emails deliver but land in spam | Use a verified subdomain, publish DMARC, and make `PUBLIC_APP_URL` match your sender brand domain |
| Sync pending | Sign in via OTP first |
