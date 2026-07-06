import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  deleteAllData,
  exportData,
  useSettings,
} from '@src/hooks/useExtensionData';
import { PLATFORM_LABELS } from '@src/utils/constants';
import '@src/styles/receipt.css';
import './style.css';

function OptionsApp() {
  const { settings, updateSettings } = useSettings();

  if (!settings) {
    return <div className="options-shell p-6 text-xs uppercase">Loading...</div>;
  }

  return (
    <div className="options-shell mx-auto max-w-xl p-6">
      <h1 className="text-sm font-bold uppercase tracking-[0.25em]">Scroll Receipt Options</h1>
      <p className="mt-2 text-xs text-ink-faded">
        Manage platforms, equivalent rates, and privacy controls. All data stays on this device.
      </p>

      {!settings.onboardingComplete && (
        <section className="mt-6 rounded border border-divider/40 p-4">
          <h2 className="text-xs font-bold uppercase">Privacy Notice</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-faded">
            Scroll Receipt measures active short-form viewing on supported websites in your browser
            only. It does not read messages, comments, captions, searches, passwords, or unrelated
            browsing activity. No data is sent to any server unless you configure optional email sync.
          </p>
          <button
            type="button"
            className="mt-4 w-full border border-ink py-2 text-xs font-bold uppercase"
            onClick={() => void updateSettings({ onboardingComplete: true })}
          >
            I Understand — Continue
          </button>
        </section>
      )}

      <section className="mt-6 space-y-3">
        <h2 className="text-xs font-bold uppercase">Platforms</h2>
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
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-xs font-bold uppercase">Equivalent Rates</h2>
        <label className="block text-xs uppercase text-ink-faded">
          Reading pages per minute
          <input
            type="number"
            step="0.01"
            className="mt-1 w-full border border-divider bg-paper px-2 py-1 text-sm text-ink"
            value={settings.equivalentRates.readingPagesPerMinute}
            onChange={(e) =>
              void updateSettings({
                equivalentRates: {
                  ...settings.equivalentRates,
                  readingPagesPerMinute: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <label className="block text-xs uppercase text-ink-faded">
          Walking steps per minute
          <input
            type="number"
            className="mt-1 w-full border border-divider bg-paper px-2 py-1 text-sm text-ink"
            value={settings.equivalentRates.walkingStepsPerMinute}
            onChange={(e) =>
              void updateSettings({
                equivalentRates: {
                  ...settings.equivalentRates,
                  walkingStepsPerMinute: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <label className="block text-xs uppercase text-ink-faded">
          Language cards per minute
          <input
            type="number"
            step="0.01"
            className="mt-1 w-full border border-divider bg-paper px-2 py-1 text-sm text-ink"
            value={settings.equivalentRates.languageCardsPerMinute}
            onChange={(e) =>
              void updateSettings({
                equivalentRates: {
                  ...settings.equivalentRates,
                  languageCardsPerMinute: Number(e.target.value),
                },
              })
            }
          />
        </label>
      </section>

      <section className="mt-6 space-y-2">
        <button
          type="button"
          className="w-full border border-ink py-2 text-xs uppercase"
          onClick={async () => {
            const json = await exportData();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scroll-receipt-export-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export Data As JSON
        </button>
        <button
          type="button"
          className="w-full border border-stamp-red py-2 text-xs uppercase text-stamp-red"
          onClick={() => {
            if (confirm('Delete all Scroll Receipt data on this device?')) void deleteAllData();
          }}
        >
          Delete All Data
        </button>
      </section>

      <p className="mt-6 text-[10px] uppercase text-ink-faded">Browser Activity Only · v2.0.0</p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);
