# Privacy

Last updated: July 10, 2026

## Principle

**Scroll Receipt is local-first.**

The browser extension measures active short-form viewing on supported websites. The Android app
uses Android Usage Access to read only the foreground duration of the official Instagram, YouTube,
and TikTok apps. It does not use an Accessibility Service and does not inspect screen content.

## Data processed on your device

- Browser: active viewing duration, session timestamps, platform totals, and engagement counters
- Android: total foreground duration for Instagram, YouTube, and TikTok
- Settings such as platform choices, hourly value, timezone, and receipt preferences
- A random per-install device ID used only to prevent duplicate daily sync records

Android reports whole-app time for Instagram and YouTube. Android does not expose whether Reels or
Shorts is open without more invasive accessibility access, which Scroll Receipt does not request.

## Optional email receipts

Local tracking does not require an account. If you explicitly enable email receipts, Scroll Receipt
collects and processes:

- Your verified email address
- Daily aggregate seconds per platform and browser view counts where available
- Local date, timezone, and a random per-install device ID
- Authentication and email delivery status needed to secure and operate the service

This data is used only for account authentication, cross-device aggregation, and delivery of your
requested daily receipt. It is not sold, used for advertising, or shared for third-party marketing.
Supabase provides authentication, database, and server functions; Resend delivers requested emails.
Data is encrypted in transit using HTTPS.

## What we never collect

- Messages, comments, captions, searches, passwords, or typed text
- Screenshots, screen recordings, microphone, camera, or precise location
- Video contents, titles, downloads, or Android screen contents
- An inventory of installed apps; Android code reads totals only for the three named platforms
- Advertising identifiers or contacts

The browser extension does not sync raw page URLs. Content identifiers used locally are hashed.

## Storage and retention

Browser data is stored in `chrome.storage.local`. Android settings are stored in app-private local
storage, and the optional auth session is encrypted with Android Keystore. Synced account data is
retained while email receipts are enabled or until the account is deleted.

Standard network and security logs may be processed temporarily by hosting and email providers to
operate and protect the service.

## Your controls

- Use local tracking without creating an account
- Revoke Android Usage Access at any time in system settings
- Pause browser tracking or disable individual browser platforms
- Export or delete local browser data
- Disconnect email receipts without deleting local functionality
- Permanently delete the account and all associated server data in the Android app or at
  [scroll.outthere.day/delete-account.html](https://scroll.outthere.day/delete-account.html)

Deleting the server account normally completes immediately. Local data remains under your control
on each device and can be deleted in the extension, by clearing Android app data, or by uninstalling.

## Contact

For privacy questions, open a request in the
[Scroll Receipt repository](https://github.com/vushnevskuu/scroll-receipt/issues).
