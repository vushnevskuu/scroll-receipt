# Architecture

## Overview

Scroll Receipt is a Manifest V3 browser extension built with [WXT](https://wxt.dev), React, and TypeScript.

```
Content Scripts (per platform)
  → Active Viewing Detector
  → Qualified playback deltas (flushed every 5s)
Background Service Worker
  → Session Engine
  → Daily Aggregation
  → chrome.storage.local
Popup / Dashboard / Options (React)
  → Thermal Receipt UI
```

## Qualified active viewing

Time is counted only when **all** conditions are true:

- Supported route (Shorts / Reels / TikTok feed)
- Tab active, window focused, document visible
- Video detected, ≥60% visible, playing, time advancing
- User not idle (when idle permission granted)

## Session rules

- Start on first qualified second
- Merge gaps ≤30 seconds on same platform
- End after >30 seconds without qualified viewing
- Checkpoint persisted for service worker recovery
- Daily aggregates rebuilt when sessions finalize

## Privacy

- Raw content IDs exist in memory only
- Persisted content references use daily salted SHA-256 hashes
- No URLs, captions, usernames, or messages stored
- No network requests unless the user enables email receipts
- Optional sync sends only daily totals per platform (seconds + views)

## Entrypoints

| Entry | Role |
|-------|------|
| `entrypoints/background.ts` | Message router, alarms, session engine |
| `entrypoints/youtube.content.ts` | YouTube Shorts adapter |
| `entrypoints/instagram.content.ts` | Instagram Reels adapter |
| `entrypoints/tiktok.content.ts` | TikTok adapter |
| `entrypoints/popup/` | Toolbar popup (380px) |
| `entrypoints/dashboard/` | Full receipt dashboard |
| `entrypoints/options/` | Settings page |
