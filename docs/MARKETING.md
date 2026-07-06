# Marketing & SEO setup

Configured using [marketingskills](https://github.com/coreyhaines31/marketingskills) (skills in `.agents/skills/`).

## What’s in place

| Asset | Purpose |
|-------|---------|
| `.agents/product-marketing.md` | Positioning, audience, voice, objections |
| `docs/index.html` | Minimal receipt + print animation |
| `docs/about.html` | Product copy, benefits |
| `docs/install.html` | Install steps + HowTo schema |
| `docs/faq.html` | FAQ + FAQPage schema |
| `docs/privacy.html` | Trust + indexable policy page |
| `docs/robots.txt` | Crawl rules + sitemap pointer |
| `docs/sitemap.xml` | Home + privacy |
| `docs/llms.txt` | AI search / citation (AEO) |
| `docs/og-image.svg` | Social preview |
| `docs/STORE_LISTING.md` | Chrome Web Store ASO draft |

## JSON-LD (homepage)

- `WebSite`, `Organization`, `SoftwareApplication`, `FAQPage`

## Next steps (manual)

1. **Google Search Console** — add property `https://vushnevskuu.github.io/scroll-receipt/`, submit sitemap
2. **Chrome Web Store** — publish using `STORE_LISTING.md` when ready
3. **Analytics** — add Plausible/GA4 only if you want traffic metrics (not included by default for privacy)
4. **Resend** — complete email backend (`docs/BACKEND_SETUP.md`) for receipt feature in marketing copy
5. **Social proof** — add real testimonials when available (do not fabricate)

## Skills used

- `product-marketing` — context doc
- `copywriting` + `cro` — landing copy and structure
- `seo-audit` — meta, canonical, sitemap, robots
- `schema` — JSON-LD
- `ai-seo` — `llms.txt`, FAQ blocks
- `aso` — store listing

## Re-run marketing work

In Cursor, skills auto-load from `.agents/skills/`. Ask e.g. “Run seo-audit on the landing page” or “Improve hero copy using copywriting skill.”
