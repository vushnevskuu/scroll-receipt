/* eslint-disable react-hooks/set-state-in-effect -- sync email field when settings load */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { t } from '@scroll-receipt/shared';
import {
  deleteAllData,
  exportData,
  sendTestReceipt,
  signInWithOtp,
  signOut,
  updateProfile,
  useSettings,
  verifyOtp,
} from '@src/hooks/useExtensionData';
import { isBackendConfigured } from '@src/lib/env';
import { PLATFORM_LABELS } from '@src/utils/constants';
import '@src/styles/receipt.css';
import './style.css';

function OptionsApp() {
  const { settings, updateSettings, refresh } = useSettings();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (settings?.email) setEmail(settings.email);
  }, [settings?.email]);

  if (!settings) {
    return <div className="options-shell p-6 text-xs uppercase">Loading...</div>;
  }

  const locale = settings.locale;
  const s = (key: Parameters<typeof t>[1]) => t(locale, key);
  const backendReady = isBackendConfigured();

  const handleSendOtp = async () => {
    setBusy(true);
    setMessage(null);
    const result = await signInWithOtp(email);
    setBusy(false);
    if (result.ok) {
      setOtpSent(true);
      setMessage(locale === 'ru' ? 'Код отправлен на email' : 'Code sent to your email');
    } else {
      setMessage(result.error ?? 'Error');
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    setMessage(null);
    const result = await verifyOtp(email, otp);
    setBusy(false);
    if (result.ok) {
      await refresh();
      setMessage(locale === 'ru' ? 'Email подтверждён' : 'Email verified');
    } else {
      setMessage(result.error ?? 'Error');
    }
  };

  const handleTestReceipt = async () => {
    setBusy(true);
    const result = await sendTestReceipt(locale);
    setBusy(false);
    setMessage(result.ok ? s('testReceipt') : (result.error ?? 'Error'));
  };

  const finishLocalOnboarding = () => {
    void updateSettings({ onboardingComplete: true, trackingEnabled: true });
  };

  return (
    <div className="options-shell mx-auto max-w-xl p-6">
      <h1 className="text-sm font-bold uppercase tracking-[0.25em]">Scroll Receipt Options</h1>
      <p className="mt-2 text-xs text-ink-faded">{s('browserOnly')}</p>

      {!settings.onboardingComplete && (
        <section className="mt-6 rounded border border-divider/40 p-4">
          <h2 className="text-xs font-bold uppercase">Privacy Notice</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-faded">{s('onboardingDesc')}</p>
          <label className="mt-4 flex items-start gap-2 text-xs">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              {locale === 'ru'
                ? 'Согласен на учёт времени просмотра в браузере и отправку агрегированных данных на сервер для email-чеков.'
                : 'I agree to track browser watch time and sync aggregated totals for email receipts.'}
            </span>
          </label>
          {consent && backendReady && (
            <div className="mt-4 space-y-3">
              <label className="block text-xs uppercase">
                {s('email')}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full border border-divider bg-paper px-2 py-1 text-sm text-ink"
                />
              </label>
              {!otpSent ? (
                <button
                  type="button"
                  disabled={busy || !email}
                  onClick={() => void handleSendOtp()}
                  className="w-full border border-ink py-2 text-xs font-bold uppercase"
                >
                  {s('sendOtp')}
                </button>
              ) : (
                <>
                  <label className="block text-xs uppercase">
                    {s('otp')}
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="mt-1 w-full border border-divider bg-paper px-2 py-1 text-sm text-ink"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || otp.length < 4}
                    onClick={() => void handleVerify()}
                    className="w-full border border-ink py-2 text-xs font-bold uppercase"
                  >
                    {s('verify')}
                  </button>
                </>
              )}
            </div>
          )}
          {consent && !backendReady && (
            <button type="button" className="mt-4 w-full border border-ink py-2 text-xs uppercase" onClick={finishLocalOnboarding}>
              {locale === 'ru' ? 'Продолжить без email' : 'Continue without email'}
            </button>
          )}
        </section>
      )}

      {settings.emailVerified && (
        <section className="mt-6 space-y-3 border-t border-divider/30 pt-6">
          <h2 className="text-xs font-bold uppercase">{s('email')}</h2>
          <p className="text-xs">
            {settings.email} <span className="text-success-green">✓</span>
          </p>
          <label className="block text-xs uppercase text-ink-faded">
            {s('timezone')}
            <input
              type="text"
              value={settings.timezone}
              onChange={(e) => void updateSettings({ timezone: e.target.value })}
              className="mt-1 w-full border border-divider bg-paper px-2 py-1 text-sm text-ink"
            />
          </label>
          <label className="flex items-center gap-2 text-xs uppercase">
            <input
              type="checkbox"
              checked={settings.reportEnabled}
              onChange={(e) => void updateSettings({ reportEnabled: e.target.checked })}
            />
            {s('reportEnabled')}
          </label>
          <label className="block text-xs uppercase text-ink-faded">
            {s('reportTime')}
            <input
              type="time"
              value={settings.dailyReceiptTime}
              onChange={(e) => void updateSettings({ dailyReceiptTime: e.target.value })}
              className="mt-1 w-full border border-divider bg-paper px-2 py-1 text-sm text-ink"
            />
          </label>
          <p className="text-[10px] text-ink-faded">
            {locale === 'ru'
              ? 'Чек отправляется за предыдущий день в указанное время (по умолчанию 00:05).'
              : 'Receipt covers the previous calendar day at this local time (default 00:05).'}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await updateProfile({
                timezone: settings.timezone,
                reportEnabled: settings.reportEnabled,
                reportTimeLocal: settings.dailyReceiptTime,
              });
              setBusy(false);
              setMessage(locale === 'ru' ? 'Настройки сохранены' : 'Settings saved');
            }}
            className="w-full border border-divider py-2 text-xs uppercase"
          >
            Save email settings
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleTestReceipt()}
            className="w-full border border-ink py-2 text-xs uppercase"
          >
            {s('testReceipt')}
          </button>
          <button type="button" className="text-[10px] uppercase text-ink-faded underline" onClick={() => void signOut()}>
            Sign out
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

      <section className="mt-6 space-y-2">
        <button
          type="button"
          className="w-full border border-divider py-2 text-xs uppercase"
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

      {message && <p className="mt-4 text-xs text-ink-faded">{message}</p>}
      <p className="mt-6 text-[10px] uppercase text-ink-faded">Browser Activity Only · v2.0.0</p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);
