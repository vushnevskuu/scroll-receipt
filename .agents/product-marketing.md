# Product Marketing Context

*Last updated: 2026-07-06*

## Product Overview

**One-liner:** Scroll Receipt turns your short-form video time into a daily receipt you can actually read.

**What it does:** A Chromium browser extension that measures confirmed playback time on Instagram Reels, YouTube Shorts, and TikTok — not tab time, not background noise. Optional daily email receipts summarize yesterday's totals by platform.

**Product category:** Digital wellbeing / screen time / attention tracking (browser extension)

**Product type:** Free browser extension (Chrome, Edge, Brave)

**Business model:** Free MVP; optional email sync via Supabase

## Target Audience

**Target users:** Knowledge workers, creators, and anyone curious how much short-form video they actually watch in the browser

**Decision-makers:** Self-serve (individual users)

**Primary use case:** Understand daily short-form video consumption without guilt-driven blocking

**Jobs to be done:**
- Know how much time Reels/Shorts/TikTok really take in the browser
- Get a neutral daily summary (receipt) instead of vague screen time stats
- Pause tracking or delete data anytime

**Use cases:**
- Evening reflection on where attention went
- Comparing platforms (Instagram vs YouTube vs TikTok)
- Email receipt at 00:05 local for yesterday's totals

## Problems & Pain Points

**Core problem:** Short-form feeds feel endless; built-in screen time doesn't distinguish active watching from an open tab.

**Why alternatives fall short:**
- Phone Screen Time includes native apps, not browser-only focus
- Generic blockers feel punitive, not informative
- Tab timers count idle time as "watching"

**What it costs them:** Lost hours, unclear habits, no neutral feedback loop

**Emotional tension:** Curiosity mixed with dread of "how bad is it?" — product stays neutral, not shame-based

## Competitive Landscape

**Direct:** Screen Time / Digital Wellbeing — no per-platform short-form receipt in browser
**Secondary:** RescueTime, StayFocusd — time tracking or blocking, not receipt-style summaries for Reels/Shorts
**Indirect:** Quitting social media entirely — too extreme for many users

## Differentiation

**Key differentiators:**
- Counts only confirmed playback (focus + visible + playing)
- Receipt metaphor: neutral, informative, not preachy
- Browser-only scope (honest about limits)
- Local-first; optional email with aggregates only (no URLs/titles sent)

**How we do it differently:** Platform adapters + playback verification, not tab timers

**Why customers choose us:** Clarity without blocking; feels like accounting, not judgment

## Objections

| Objection | Response |
|-----------|----------|
| "Is this spyware?" | Local storage by default; no video URLs or titles leave your device unless you opt into email sync |
| "Does it track my phone?" | No — browser only, stated clearly everywhere |
| "Will Instagram/YouTube break it?" | DOM-based; may need updates when sites change UI |
| "Another app nagging me?" | No streaks, no red warnings — receipt tone only |

**Anti-persona:** Users who want phone app tracking or hard blocking

## Switching Dynamics

**Push:** Feeds feel infinite; no idea where time goes
**Pull:** Daily receipt makes it tangible and neutral
**Habit:** Ignoring the problem or checking vague screen time once a week
**Anxiety:** Privacy, accuracy, affiliation with social platforms

## Customer Language

**How they describe the problem:**
- "I lose hours to Reels without noticing"
- "Screen time says YouTube but I was on Shorts"
- "I want to know, not be blocked"

**How they describe us:**
- "Like a receipt for my attention"
- "Short-form screen time but honest"

**Words to use:** receipt, watch time, Reels, Shorts, browser, daily summary, neutral

**Words to avoid:** addiction, detox, guilt, productivity hack, spy

**Glossary:**
| Term | Meaning |
|------|---------|
| Qualified playback | Video playing, visible, tab focused |
| Receipt | Daily summary formatted like a cashier tape |

## Brand Voice

**Tone:** Calm, neutral, slightly wry (receipt metaphor)
**Style:** Direct, minimal, monospace-adjacent
**Personality:** Honest, precise, non-judgmental, privacy-conscious

## Proof Points

**Metrics:** Tracks 3 platforms; view counted at 3s confirmed playback
**Value themes:**
| Theme | Proof |
|-------|-------|
| Accuracy | Playback verification, not tab time |
| Privacy | Local-first; hashed IDs only |
| Honesty | Browser-only label |

## Goals

**Business goal:** Downloads + email-verified users for daily receipts
**Conversion action:** Download extension zip + install unpacked
**Site:** https://vushnevskuu.github.io/scroll-receipt/
