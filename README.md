# Scroll Receipt — Browser Extension

Chromium extension that tracks **active** short-form video viewing on YouTube Shorts, Instagram Reels, and TikTok in your browser. Data stays local by default; optional email receipts via Supabase + Resend.

## Quick start

```bash
pnpm install
pnpm build
```

Load unpacked in Chrome: `apps/extension/.output/chrome-mv3`

**Landing + download:** https://vushnevskuu.github.io/scroll-receipt/

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

Copy `.env.example` to `apps/extension/.env` and configure Supabase + Resend. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Privacy](docs/PRIVACY.md)
- [Platform adapters](docs/PLATFORM_ADAPTERS.md)
- [Chrome Web Store listing draft](docs/STORE_LISTING.md)

## Limitations

- Browser only — not native mobile apps
- DOM selectors may break when platforms update UI
- Not affiliated with Instagram, YouTube, or TikTok
