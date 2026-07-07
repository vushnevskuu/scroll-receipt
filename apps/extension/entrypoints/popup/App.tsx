import { useMemo, useState } from 'react';
import { t } from '@scroll-receipt/shared';
import {
  pauseTracking,
  resumeTracking,
  useSettings,
  useTodaySummary,
  useTrackingStatus,
} from '@src/hooks/useExtensionData';
import { formatDuration, formatDurationCompact } from '@src/utils/format';
import { PLATFORM_LABELS } from '@src/utils/constants';
import './style.css';

const PLATFORMS = ['youtube', 'instagram', 'tiktok'] as const;

function PopupApp() {
  const { status } = useTrackingStatus(1500);
  const { summary, loading, refresh } = useTodaySummary();
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);

  const aggregate = summary?.aggregate;
  const checkpoint = summary?.checkpoint;
  const isPaused = !status?.trackingEnabled;
  const locale = settings?.locale ?? 'en';

  const platformRows = useMemo(() => {
    if (!aggregate) return [];
    return PLATFORMS.map((platform) => ({
      platform,
      seconds: aggregate.platformTotals[platform] ?? 0,
    })).filter((row) => row.seconds > 0);
  }, [aggregate]);

  const toggleTracking = async () => {
    setBusy(true);
    if (status?.trackingEnabled) await pauseTracking();
    else await resumeTracking();
    await refresh();
    setBusy(false);
  };

  const openOptions = () => {
    void chrome.runtime.openOptionsPage();
  };

  if (loading && !summary) {
    return (
      <div className="popup-shell">
        <p className="popup-muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="popup-shell">
      <header className="popup-header">
        <div>
          <p className="popup-title">Scroll Receipt</p>
          <p className="popup-subtitle">Short-form watch time</p>
        </div>
        <button
          type="button"
          className="popup-icon-btn"
          onClick={openOptions}
          aria-label={t(locale, 'completeSetup')}
          title="Settings"
        >
          ⚙
        </button>
      </header>

      {settings && !settings.onboardingComplete && (
        <button type="button" className="popup-banner" onClick={openOptions}>
          {t(locale, 'completeSetup')}
        </button>
      )}

      <div className="popup-status" role="status" aria-live="polite">
        <span className={`popup-dot ${isPaused ? 'is-paused' : 'is-active'}`} aria-hidden="true" />
        <span>{isPaused ? 'Paused' : 'Tracking'}</span>
        {checkpoint && !isPaused && (
          <span className="popup-status-session">
            {PLATFORM_LABELS[checkpoint.platform]} · {formatDurationCompact(checkpoint.activeSeconds)}
          </span>
        )}
      </div>

      <section className="popup-hero" aria-label="Today total">
        <p className="popup-hero-value">{formatDuration(aggregate?.activeSeconds ?? 0)}</p>
        <p className="popup-hero-label">today</p>
      </section>

      <section className="popup-platforms" aria-label="By platform">
        {platformRows.length > 0 ? (
          platformRows.map(({ platform, seconds }) => (
            <div key={platform} className="popup-platform-row">
              <span>{PLATFORM_LABELS[platform]}</span>
              <span className="popup-platform-time">{formatDurationCompact(seconds)}</span>
            </div>
          ))
        ) : (
          <p className="popup-empty">
            {isPaused
              ? 'Resume tracking to count Reels, Shorts, and TikTok.'
              : 'Open Reels, Shorts, or TikTok in this browser to start counting.'}
          </p>
        )}
      </section>

      <footer className="popup-footer">
        <p className="popup-meta">{aggregate?.videosViewed ?? 0} videos counted</p>
        <button
          type="button"
          className="popup-action"
          disabled={busy}
          onClick={() => void toggleTracking()}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>
      </footer>
    </div>
  );
}

export default PopupApp;
