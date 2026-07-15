# Scroll Receipt — Browser Extension

Chromium extension that tracks **active** short-form video viewing on YouTube Shorts, Instagram Reels, and TikTok in your browser. Data stays local by default; optional email receipts via Supabase + Resend.

## Quick start

```bash
pnpm install
pnpm build
```

Load unpacked in Chrome: `apps/extension/.output/chrome-mv3`

**Landing + download:** https://scroll.outthere.day/

The published zip already includes the backend URL needed for email sign-in and receipts.
After install, local tracking starts in the browser right away. To receive daily email receipts,
open **Options**, enter your email, and finish email verification from the code or sign-in link
that arrives in your inbox.

If your inbox shows a Supabase sign-in link instead of a numeric code, paste that full link into
the same verification field in **Options**. The extension rewrites the broken localhost redirect
and completes sign-in in a new tab.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Extension dev server |
| `pnpm build` | Production build |
| `pnpm zip` | Package for Chrome Web Store |
| `pnpm test` | Unit tests |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript |

## How it works

1. Content scripts on supported sites detect playing vertical video (≥60% visible, tab focused, time advancing).
2. Background service worker aggregates sessions into daily totals.
3. Popup shows today's thermal receipt; dashboard shows history and insights.
4. All data in `chrome.storage.local` — pause, export, or delete anytime.

## Optional email receipts (v2)

Copy `apps/extension/.env.example` to `apps/extension/.env` and configure Supabase + Resend.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/BACKEND_SETUP.md](docs/BACKEND_SETUP.md).

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Privacy](docs/PRIVACY.md)
- [Platform adapters](docs/PLATFORM_ADAPTERS.md)
- [Chrome Web Store listing draft](docs/STORE_LISTING.md)

## Limitations

- Browser only — not native mobile apps
- DOM selectors may break when platforms update UI
- Not affiliated with Instagram, YouTube, or TikTok
