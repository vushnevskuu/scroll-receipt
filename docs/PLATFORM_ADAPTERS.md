# Platform Adapters

Each platform has an isolated adapter implementing `PlatformAdapter`. Selectors never leak across files.

## YouTube Shorts (`src/adapters/youtube.ts`)

**Routes:**
- `youtube.com/shorts/{videoId}`

**Detection:**
- Path-based video ID
- Largest visible `<video>` element
- MutationObserver for SPA navigation

## Instagram Reels (`src/adapters/instagram.ts`)

**Routes:**
- `instagram.com/reels/`
- `instagram.com/reel/{id}`

**Detection:**
- Reel links in article containers
- Visible video in feed/modal

## TikTok (`src/adapters/tiktok.ts`)

**Routes:**
- `tiktok.com/foryou`
- `tiktok.com/@user/video/{id}`

**Detection:**
- Video path ID or recommend-list links
- Largest visible feed video

## Failure isolation

If one adapter's DOM selectors break after a platform update, other platforms continue tracking. Adapter health is reported separately.

## Testing

See `tests/unit/adapters.test.ts` and `tests/fixtures/` for DOM fixture patterns.
