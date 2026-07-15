import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { t } from '@scroll-receipt/shared/i18n';
import { DailyReceipt, EmptyReceipt } from '@src/components/receipt/DailyReceipt';
import { ReceiptDivider } from '@src/components/receipt/ReceiptDivider';
import { ReceiptPaper } from '@src/components/receipt/ReceiptPaper';
import {
  deleteAllData,
  deleteTodayData,
  exportData,
  useSettings,
  useTodaySummary,
} from '@src/hooks/useExtensionData';
import { buildReceiptData } from '@src/receipts/equivalent-engine';
import { PLATFORM_LABELS } from '@src/utils/constants';
import '@src/styles/receipt.css';
import './style.css';

function DashboardApp() {
  const [stamped, setStamped] = useState(false);
  const { summary, refresh } = useTodaySummary();
  const { settings, updateSettings } = useSettings();
  const [message, setMessage] = useState('');

  const receipt = useMemo(() => {
    if (!summary?.aggregate || !settings) return null;
    if (summary.aggregate.activeSeconds === 0) return null;
    return buildReceiptData(summary.aggregate, settings.equivalentRates);
  }, [summary, settings]);

  const handleExport = async () => {
    const json = await exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scroll-receipt-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Data exported.');
  };

  return (
    <div className="dashboard-shell min-h-screen pb-10">
      <header className="dashboard-header">
        <h1 className="text-center text-sm font-bold uppercase tracking-[0.3em]">Scroll Receipt</h1>
        <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-ink-faded">
          Today&apos;s receipt
        </p>
      </header>

      <main className="mx-auto max-w-lg px-3 py-6">
        {!settings?.onboardingComplete && (
          <ReceiptPaper className="mb-6">
            <p className="text-center text-xs font-bold uppercase tracking-widest">
              {settings ? t(settings.locale, 'onboardingTitle') : 'Scroll Receipt'}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ink-faded">
              {settings ? t(settings.locale, 'setupRequired') : 'Complete setup to receive daily email receipts.'}
            </p>
            <button
              type="button"
              className="mt-4 w-full border border-ink py-2 text-xs font-bold uppercase"
              onClick={() => void chrome.runtime.openOptionsPage()}
            >
              {settings ? t(settings.locale, 'completeSetup') : 'Complete setup'}
            </button>
          </ReceiptPaper>
        )}

        {receipt ? (
          <DailyReceipt receipt={receipt} stamped={stamped} onReclaim={() => setStamped(true)} />
        ) : (
          <EmptyReceipt
            title="No Short-Form Activity Yet"
            description="Watch Reels, TikTok, or YouTube Shorts in this browser and your receipt will appear automatically."
          />
        )}

        {settings && (
          <ReceiptPaper className="mt-6">
            <p className="text-center text-xs font-bold uppercase tracking-widest">Settings</p>
            <ReceiptDivider />

            <fieldset className="space-y-2 border-0 p-0">
              <legend className="text-xs uppercase text-ink-faded">Enabled Platforms</legend>
              {(['youtube', 'instagram', 'tiktok'] as const).map((platform) => (
                <label key={platform} className="flex items-center gap-2 text-xs uppercase">
                  <input
                    type="checkbox"
                    checked={settings.enabledPlatforms.includes(platform)}
                    onChange={(e) => {
                      const enabled = new Set(settings.enabledPlatforms);
                      if (e.target.checked) enabled.add(platform);
                      else enabled.delete(platform);
                      void updateSettings({ enabledPlatforms: Array.from(enabled) });
                    }}
                  />
                  {PLATFORM_LABELS[platform]}
                </label>
              ))}
            </fieldset>

            <div className="mt-4">
              <p className="text-xs uppercase text-ink-faded">{t(settings.locale, 'reportSchedule')}</p>
              <p className="mt-1 text-sm normal-case text-ink">
                {settings.dailyReceiptTime} · {settings.timezone}
              </p>
            </div>

            <ReceiptDivider />
            <div className="space-y-2">
              <button
                type="button"
                className="w-full border border-ink py-2 text-xs uppercase"
                onClick={() => void handleExport()}
              >
                Export Data As JSON
              </button>
              <button
                type="button"
                className="w-full border border-divider py-2 text-xs uppercase text-ink-faded"
                onClick={() => {
                  void deleteTodayData().then(() => {
                    setMessage("Today's data deleted.");
                    void refresh();
                  });
                }}
              >
                Delete Today&apos;s Data
              </button>
              <button
                type="button"
                className="w-full border border-stamp-red py-2 text-xs uppercase text-stamp-red"
                onClick={() => {
                  if (window.confirm('Delete all Scroll Receipt data on this device?')) {
                    void deleteAllData().then(() => {
                      setMessage('All data deleted.');
                      void refresh();
                    });
                  }
                }}
              >
                Delete All Data
              </button>
            </div>
            {message && (
              <p className="mt-3 text-center text-xs uppercase text-success-green" role="status">
                {message}
              </p>
            )}
          </ReceiptPaper>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DashboardApp />
  </StrictMode>,
);
