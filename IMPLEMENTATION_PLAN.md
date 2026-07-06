# Scroll Receipt — Implementation Plan

## Architecture

```
pnpm monorepo
├── apps/extension          WXT MV3 + React (tracking, popup, settings, sync)
├── packages/shared         Types, Zod schemas, formatters, email renderer, i18n
└── supabase/
    ├── migrations/         profiles, device_usage, receipt_deliveries + RLS
    └── functions/          sync-usage, daily-receipt, send-test-receipt
```

**Data flow:** Content scripts → 5s playback deltas → background (local truth) → sync to Supabase → cron sends Resend email at user's local report time.

## Phases

| # | Phase | Status |
|---|-------|--------|
| 1 | Monorepo + shared package | Done |
| 2 | Tracking v2 (performance.now, 3s views, max delta cap) | Done |
| 3 | Supabase schema + RLS + edge functions | Done |
| 4 | Extension auth (OTP), sync, onboarding | Done |
| 5 | Email receipt (HTML + plain text) | Done |
| 6 | i18n ru/en, settings, test receipt | Done |
| 7 | Tests + fixtures + build verification | Done |

## Checklist

- [ ] Monorepo builds with `pnpm build`
- [ ] Qualified playback only (not tab time)
- [ ] View counted once at 3s per video per day
- [ ] Local data survives browser restart
- [ ] Sync idempotent upsert by device_id + date + platform
- [ ] OTP email auth via Supabase
- [ ] Daily cron sends one receipt per user per day
- [ ] Test receipt button works
- [ ] No video URLs/IDs sent to backend
- [ ] lint / typecheck / test / build pass

## Manual setup (owner)

1. Create Supabase project; set `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` in extension env
2. Apply migrations: `supabase db push`
3. Deploy functions; set secrets: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
4. Configure cron for `daily-receipt` (every 5 min)
5. Verify domain in Resend
6. Load unpacked extension from `apps/extension/.output/chrome-mv3`
