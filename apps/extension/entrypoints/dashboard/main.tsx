import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DailyReceipt, EmptyReceipt } from '@src/components/receipt/DailyReceipt';
import { ReceiptDivider } from '@src/components/receipt/ReceiptDivider';
import { ReceiptDottedLine } from '@src/components/receipt/ReceiptLine';
import { ReceiptPaper } from '@src/components/receipt/ReceiptPaper';
import {
  deleteAllData,
  deleteTodayData,
  exportData,
  useHistory,
  useSettings,
  useTodaySummary,
  useWeeklySummary,
} from '@src/hooks/useExtensionData';
import { buildReceiptData } from '@src/receipts/equivalent-engine';
import { PLATFORM_LABELS } from '@src/utils/constants';
import { formatDuration, formatReceiptDate } from '@src/utils/format';
import '@src/styles/receipt.css';
import './style.css';

type Tab = 'today' | 'history' | 'insights' | 'settings';

function DashboardApp() {
  const [tab, setTab] = useState<Tab>('today');
  const [stamped, setStamped] = useState(false);
  const { summary, refresh } = useTodaySummary();
  const { weekly } = useWeeklySummary();
  const { history } = useHistory();
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

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'today', label: "Today's Receipt" },
    { id: 'history', label: 'History' },
    { id: 'insights', label: 'Insights' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="dashboard-shell min-h-screen pb-10">
      <header className="sticky top-0 z-10 border-b border-divider/20 bg-page-bg/95 px-4 py-4 backdrop-blur">
        <h1 className="text-center text-sm font-bold uppercase tracking-[0.3em]">Scroll Receipt</h1>
        <nav className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Dashboard sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`border px-3 py-1 text-[10px] uppercase tracking-wider ${
                tab === t.id
                  ? 'border-paper bg-paper text-ink'
                  : 'border-divider/40 text-ink-faded hover:text-paper'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-lg px-3 py-6">
        {tab === 'today' && (
          <>
            {!settings?.onboardingComplete && (
              <ReceiptPaper className="mb-6">
                <p className="text-center text-xs font-bold uppercase tracking-widest">
                  Your Activity Stays On This Device
                </p>
                <p className="mt-3 text-xs leading-relaxed text-ink-faded">
                  Scroll Receipt measures active short-form viewing on supported websites. It does
                  not read messages, comments, captions, searches, passwords, or unrelated browsing
                  activity.
                </p>
                <button
                  type="button"
                  className="mt-4 w-full border border-ink py-2 text-xs font-bold uppercase"
                  onClick={() => void updateSettings({ onboardingComplete: true })}
                >
                  Continue
                </button>
              </ReceiptPaper>
            )}
            {receipt ? (
              <DailyReceipt
                receipt={receipt}
                stamped={stamped}
                onReclaim={() => setStamped(true)}
              />
            ) : (
              <EmptyReceipt
                title="No Short-Form Activity Yet"
                description="Watch Reels, TikTok, or YouTube Shorts in this browser and your receipt will appear automatically."
              />
            )}
          </>
        )}

        {tab === 'history' && (
          <div className="space-y-6">
            {history.length === 0 ? (
              <EmptyReceipt
                title="No Receipt History"
                description="Daily receipts appear here after you watch supported short-form content."
              />
            ) : (
              history.map((day) => {
                if (!settings) return null;
                const dayReceipt = buildReceiptData(day, settings.equivalentRates);
                return (
                  <DailyReceipt
                    key={day.date}
                    receipt={dayReceipt}
                    animate={false}
                    showReclaim={false}
                  />
                );
              })
            )}
          </div>
        )}

        {tab === 'insights' && weekly && settings && (
          <ReceiptPaper>
            <p className="text-center text-xs font-bold uppercase tracking-widest">Weekly Insights</p>
            <ReceiptDivider />
            <ReceiptDottedLine
              label="Total Attention"
              value={formatDuration(weekly.totalActiveSeconds)}
            />
            <ReceiptDottedLine label="Daily Average" value={formatDuration(weekly.dailyAverages)} />
            <ReceiptDottedLine
              label="Most Used Source"
              value={
                weekly.mostUsedPlatform ? PLATFORM_LABELS[weekly.mostUsedPlatform] : 'NONE YET'
              }
            />
            <ReceiptDottedLine
              label="Longest Day"
              value={formatDuration(weekly.longestDaySeconds)}
            />
            <ReceiptDivider />
            <p className="text-xs uppercase text-ink-faded">
              Week: {formatReceiptDate(weekly.weekStart)} – {formatReceiptDate(weekly.weekEnd)}
            </p>
          </ReceiptPaper>
        )}

        {tab === 'settings' && settings && (
          <ReceiptPaper>
            <p className="text-center text-xs font-bold uppercase tracking-widest">
              Privacy & Settings
            </p>
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
              <label className="text-xs uppercase text-ink-faded" htmlFor="receipt-time">
                Daily Receipt Time
              </label>
              <input
                id="receipt-time"
                type="time"
                className="mt-1 w-full border border-divider bg-paper px-2 py-1 text-sm"
                value={settings.dailyReceiptTime}
                onChange={(e) => void updateSettings({ dailyReceiptTime: e.target.value })}
              />
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
            <ReceiptDivider />
            <p className="text-xs uppercase text-ink-faded">Browser Activity Only</p>
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
