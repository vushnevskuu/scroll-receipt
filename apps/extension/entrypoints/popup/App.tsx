import { useMemo, useState } from 'react';
import { DailyReceipt, EmptyReceipt } from '@src/components/receipt/DailyReceipt';
import { buildReceiptData } from '@src/receipts/equivalent-engine';
import {
  pauseTracking,
  resumeTracking,
  useSettings,
  useTodaySummary,
  useTrackingStatus,
} from '@src/hooks/useExtensionData';
import { formatDuration, formatDurationCompact } from '@src/utils/format';
import { PLATFORM_LABELS } from '@src/utils/constants';
import '@src/styles/receipt.css';
import './style.css';

function PopupApp() {
  const { status } = useTrackingStatus(1500);
  const { summary, loading, refresh } = useTodaySummary();
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);

  const receipt = useMemo(() => {
    if (!summary?.aggregate || !settings) return null;
    if (summary.aggregate.activeSeconds === 0) return null;
    return buildReceiptData(summary.aggregate, settings.equivalentRates);
  }, [summary, settings]);

  const toggleTracking = async () => {
    setBusy(true);
    if (status?.trackingEnabled) {
      await pauseTracking();
    } else {
      await resumeTracking();
    }
    await refresh();
    setBusy(false);
  };

  const openDashboard = () => {
    const url = chrome.runtime.getURL('/dashboard.html');
    void chrome.tabs.create({ url });
  };

  if (loading && !summary) {
    return <div className="popup-shell p-4 text-xs uppercase text-ink-faded">Loading...</div>;
  }

  const isPaused = !status?.trackingEnabled;
  const aggregate = summary?.aggregate;
  const checkpoint = summary?.checkpoint;

  return (
    <div className="popup-shell">
      <header className="border-b border-divider/30 px-4 py-3 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.25em]">Scroll Receipt</p>
        <p className="mt-1 text-[10px] uppercase tracking-widest text-ink-faded">
          Attention Accounting System
        </p>
      </header>

      <div className="px-4 py-3">
        <div
          className={`inline-flex items-center gap-2 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isPaused
              ? 'border-stamp-red/40 text-stamp-red'
              : 'border-success-green/40 text-success-green'
          }`}
          role="status"
          aria-live="polite"
        >
          <span
            className={`h-2 w-2 rounded-full ${isPaused ? 'bg-stamp-red' : 'bg-success-green'}`}
            aria-hidden="true"
          />
          {isPaused ? 'Tracking Paused' : 'Tracking Active'}
        </div>

        {checkpoint && status?.trackingEnabled && (
          <div className="mt-3 text-xs uppercase">
            <p className="text-ink-faded">Current Session</p>
            <p className="font-bold tabular-nums">
              {PLATFORM_LABELS[checkpoint.platform]} · {formatDurationCompact(checkpoint.activeSeconds)}
            </p>
          </div>
        )}

        <div className="mt-4 space-y-1 text-xs uppercase tabular-nums">
          <div className="flex justify-between">
            <span className="text-ink-faded">Today Total</span>
            <span className="font-bold">{formatDuration(aggregate?.activeSeconds ?? 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-faded">Videos Viewed</span>
            <span>{aggregate?.videosViewed ?? 0}</span>
          </div>
        </div>

        {aggregate && (
          <div className="mt-3 space-y-1 border-t border-divider/30 pt-3 text-[10px] uppercase tabular-nums">
            {(Object.entries(aggregate.platformTotals) as Array<
              ['youtube' | 'instagram' | 'tiktok', number]
            >)
              .filter(([, s]) => s > 0)
              .map(([platform, seconds]) => (
                <div key={platform} className="flex justify-between text-ink-faded">
                  <span>{PLATFORM_LABELS[platform]}</span>
                  <span>{formatDurationCompact(seconds)}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-divider/30 px-4 py-3">
        <button
          type="button"
          onClick={openDashboard}
          className="w-full border border-ink bg-paper py-2 text-xs font-bold uppercase tracking-widest hover:bg-paper-secondary"
        >
          Open Full Receipt
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void toggleTracking()}
          className="w-full border border-divider py-2 text-xs uppercase tracking-widest text-ink-faded hover:text-ink"
        >
          {isPaused ? 'Resume Tracking' : 'Pause Tracking'}
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto px-1 pb-3">
        {receipt ? (
          <DailyReceipt receipt={receipt} animate={false} showReclaim={false} />
        ) : (
          <EmptyReceipt
            title={isPaused ? 'Tracking Is Paused' : 'No Short-Form Activity Yet'}
            description={
              isPaused
                ? 'Resume tracking to continue measuring active short-form viewing.'
                : 'Watch Reels, TikTok, or YouTube Shorts in this browser and your receipt will appear automatically.'
            }
          />
        )}
      </div>
    </div>
  );
}

export default PopupApp;
