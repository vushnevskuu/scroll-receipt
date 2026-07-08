/* eslint-disable react-hooks/set-state-in-effect -- sync form when settings load */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { t } from '@scroll-receipt/shared';
import { isSetupComplete, SetupFields } from '@src/components/onboarding/SetupFields';
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
import { applyAutoReceiptSchedule, formatReceiptScheduleLabel } from '@src/lib/receipt-schedule';
import { isBackendConfigured } from '@src/lib/env';
import { looksLikeEmailSignInLink, openEmailSignInLink } from '@src/lib/supabase';
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

  useEffect(() => {
    setOtp('');
    setOtpSent(false);
  }, [email]);

  useEffect(() => {
    if (!otpSent || settings?.emailVerified) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 3000);
    return () => window.clearInterval(id);
  }, [otpSent, refresh, settings?.emailVerified]);

  if (!settings) {
    return <div className="options-shell p-6 text-xs uppercase">Loading...</div>;
  }

  const locale = settings.locale;
  const s = (key: Parameters<typeof t>[1]) => t(locale, key);
  const backendReady = isBackendConfigured();
  const setupReady = isSetupComplete(email);
  const scheduleLabel = formatReceiptScheduleLabel(
    { timezone: settings.timezone, dailyReceiptTime: settings.dailyReceiptTime },
    locale,
  );

  const persistSetup = async () => {
    await applyAutoReceiptSchedule({ syncProfile: false });
    await updateSettings({ email, reportEnabled: true });
  };

  const handleSendOtp = async () => {
    if (!setupReady) {
      setMessage(s('setupRequired'));
      return;
    }
    setBusy(true);
    setMessage(null);
    await persistSetup();
    const result = await signInWithOtp(email);
    setBusy(false);
    if (result.ok) {
      setOtpSent(true);
      setMessage(
        locale === 'ru'
          ? 'Письмо отправлено. Можно ввести код из письма или открыть ссылку для входа.'
          : 'Email sent. You can enter the code from the email or open the sign-in link.',
      );
    } else {
      setMessage(result.error ?? 'Error');
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    setMessage(null);
    await persistSetup();
    if (looksLikeEmailSignInLink(otp)) {
      const result = await openEmailSignInLink(otp, email);
      setBusy(false);
      if (result.ok) {
        setMessage(
          locale === 'ru'
            ? 'Ссылка открыта в новой вкладке. После подтверждения вернитесь в расширение.'
            : 'The sign-in link opened in a new tab. Return to the extension after confirmation.',
        );
      } else {
        setMessage(result.error ?? 'Error');
      }
      return;
    }
    const result = await verifyOtp(email, otp);
    setBusy(false);
    if (result.ok) {
      await refresh();
      setMessage(locale === 'ru' ? 'Настройка завершена' : 'Setup complete');
    } else {
      setMessage(result.error ?? 'Error');
    }
  };

  const handleCompleteLocal = async () => {
    if (!setupReady) {
      setMessage(s('setupRequired'));
      return;
    }
    setBusy(true);
    await applyAutoReceiptSchedule({ syncProfile: false });
    await updateSettings({
      email,
      reportEnabled: true,
      onboardingComplete: true,
      trackingEnabled: true,
    });
    setBusy(false);
    setMessage(
      locale === 'ru'
        ? 'Email сохранён. Подтверждение станет доступно после подключения сервера.'
        : 'Email saved. Verification will be available once the server is connected.',
    );
  };

  const handleTestReceipt = async () => {
    setBusy(true);
    const result = await sendTestReceipt(locale);
    setBusy(false);
    setMessage(
      result.ok
        ? locale === 'ru'
          ? 'Тестовый чек отправлен'
          : 'Test receipt sent'
        : (result.error ?? 'Error'),
    );
  };

  const handleReportEnabledChange = async (nextValue: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      await updateSettings({ reportEnabled: nextValue });
      await updateProfile({
        reportEnabled: nextValue,
        reportTimeLocal: settings.dailyReceiptTime,
        timezone: settings.timezone,
        locale: settings.locale,
      });
      setMessage(
        nextValue
          ? locale === 'ru'
            ? 'Ежедневные email-чеки включены'
            : 'Daily email receipts enabled'
          : locale === 'ru'
            ? 'Ежедневные email-чеки выключены'
            : 'Daily email receipts disabled',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signOut();
      await refresh();
      setMessage(locale === 'ru' ? 'Email-рассылка отключена' : 'Email receipts disconnected');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="options-shell mx-auto max-w-xl p-6">
      <h1 className="text-sm font-bold uppercase tracking-[0.25em]">Scroll Receipt Options</h1>
      <p className="mt-2 text-xs text-ink-faded">{s('browserOnly')}</p>

      {!settings.onboardingComplete && (
        <section className="mt-6 rounded border border-divider/40 p-4">
          <h2 className="text-xs font-bold uppercase">{s('onboardingTitle')}</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-faded">{s('onboardingDesc')}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-faded">{s('setupRequired')}</p>

          <label className="mt-4 flex items-start gap-2 text-xs">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span className="normal-case leading-relaxed">
              {locale === 'ru'
                ? 'Согласен на учёт времени просмотра в браузере и отправку агрегированных данных на сервер для email-чеков.'
                : 'I agree to track browser watch time and sync aggregated totals for email receipts.'}
            </span>
          </label>

          {consent && (
            <div className="mt-4 space-y-3">
              <SetupFields locale={locale} email={email} disabled={busy} onEmailChange={setEmail} />

              {backendReady ? (
                !otpSent ? (
                  <button
                    type="button"
                    disabled={busy || !setupReady}
                    onClick={() => void handleSendOtp()}
                    className="w-full border border-ink py-2 text-xs font-bold uppercase"
                  >
                    {s('sendOtp')}
                  </button>
                ) : (
                  <>
                    <label className="block text-xs uppercase">
                      {locale === 'ru' ? 'Код или ссылка из письма' : 'Code or sign-in link'}
                      <input
                        type="text"
                        inputMode="text"
                        autoComplete="one-time-code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder={
                          locale === 'ru'
                            ? 'Вставьте код или полную ссылку из письма'
                            : 'Paste the code or the full link from the email'
                        }
                        className="mt-1 w-full border border-divider bg-paper px-2 py-1 text-sm text-ink"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy || otp.trim().length < 4 || !setupReady}
                      onClick={() => void handleVerify()}
                      className="w-full border border-ink py-2 text-xs font-bold uppercase"
                    >
                      {s('verify')}
                    </button>
                  </>
                )
              ) : (
                <button
                  type="button"
                  disabled={busy || !setupReady}
                  onClick={() => void handleCompleteLocal()}
                  className="w-full border border-ink py-2 text-xs font-bold uppercase"
                >
                  {s('completeSetup')}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {settings.emailVerified && (
        <section className="mt-6 space-y-3 border-t border-divider/30 pt-6">
          <h2 className="text-xs font-bold uppercase">{s('email')}</h2>
          <p className="text-xs">
            {settings.email} <span className="text-success-green">✓</span>
          </p>
          <div className="rounded border border-divider/40 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faded">{s('reportSchedule')}</p>
            <p className="mt-1 text-xs normal-case text-ink">{scheduleLabel}</p>
            <p className="mt-1 text-[10px] normal-case text-ink-faded">{s('onboardingAutoSchedule')}</p>
          </div>
          <label className="flex items-center gap-2 text-xs uppercase">
            <input
              type="checkbox"
              checked={settings.reportEnabled}
              disabled={busy}
              onChange={(e) => void handleReportEnabledChange(e.target.checked)}
            />
            {s('reportEnabled')}
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleTestReceipt()}
            className="w-full border border-ink py-2 text-xs uppercase"
          >
            {s('testReceipt')}
          </button>
          <button
            type="button"
            disabled={busy}
            className="text-[10px] uppercase text-ink-faded underline"
            onClick={() => void handleSignOut()}
          >
            Sign out
          </button>
        </section>
      )}

      {settings.onboardingComplete && !settings.emailVerified && settings.email && (
        <section className="mt-6 space-y-3 border-t border-divider/30 pt-6">
          <h2 className="text-xs font-bold uppercase">{s('email')}</h2>
          <p className="text-xs normal-case text-ink-faded">{settings.email}</p>
          <p className="text-[10px] normal-case text-ink-faded">{scheduleLabel}</p>
          <p className="text-[10px] normal-case text-ink-faded">
            {backendReady
              ? locale === 'ru'
                ? 'Трекинг уже работает локально. Подтвердите email, чтобы получать ежедневные чеки.'
                : 'Local tracking already works. Verify your email to start daily receipts.'
              : locale === 'ru'
                ? 'Локальный трекинг работает. Email-чеки станут доступны после подключения сервера.'
                : 'Local tracking works. Email receipts will be available once the server is connected.'}
          </p>
          {backendReady && (
            <div className="space-y-3">
              {!otpSent ? (
                <button
                  type="button"
                  disabled={busy || !setupReady}
                  onClick={() => void handleSendOtp()}
                  className="w-full border border-ink py-2 text-xs font-bold uppercase"
                >
                  {s('sendOtp')}
                </button>
              ) : (
                <>
                  <label className="block text-xs uppercase">
                    {locale === 'ru' ? 'Код или ссылка из письма' : 'Code or sign-in link'}
                    <input
                      type="text"
                      inputMode="text"
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder={
                        locale === 'ru'
                          ? 'Вставьте код или полную ссылку из письма'
                          : 'Paste the code or the full link from the email'
                      }
                      className="mt-1 w-full border border-divider bg-paper px-2 py-1 text-sm text-ink"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || otp.trim().length < 4 || !setupReady}
                    onClick={() => void handleVerify()}
                    className="w-full border border-ink py-2 text-xs font-bold uppercase"
                  >
                    {s('verify')}
                  </button>
                </>
              )}
            </div>
          )}
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

      {message && <p className="mt-4 text-xs normal-case text-ink-faded">{message}</p>}
      <p className="mt-6 text-[10px] uppercase text-ink-faded">Browser Activity Only · v2.0.0</p>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);
