import { t, type Locale } from '@scroll-receipt/shared';
import { formatReceiptScheduleLabel, resolveReceiptSchedule } from '@src/lib/receipt-schedule';

interface SetupFieldsProps {
  locale: Locale;
  email: string;
  onEmailChange: (email: string) => void;
  disabled?: boolean;
}

export function SetupFields({ locale, email, onEmailChange, disabled }: SetupFieldsProps) {
  const s = (key: Parameters<typeof t>[1]) => t(locale, key);
  const schedule = resolveReceiptSchedule();

  return (
    <div className="space-y-3">
      <label className="block text-xs uppercase">
        {s('email')}
        <span className="ml-1 text-stamp-red">*</span>
        <input
          type="email"
          required
          autoComplete="email"
          disabled={disabled}
          value={email}
          onChange={(e) => onEmailChange(e.target.value.trim())}
          placeholder="you@example.com"
          className="mt-1 w-full border border-divider bg-paper px-2 py-1 text-sm normal-case text-ink"
        />
      </label>
      <p className="text-[10px] leading-relaxed normal-case text-ink-faded">{s('onboardingEmailHint')}</p>

      <div className="rounded border border-divider/40 bg-paper-secondary/40 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-faded">{s('reportSchedule')}</p>
        <p className="mt-1 text-xs normal-case text-ink">{formatReceiptScheduleLabel(schedule, locale)}</p>
        <p className="mt-1 text-[10px] leading-relaxed normal-case text-ink-faded">{s('onboardingAutoSchedule')}</p>
      </div>
    </div>
  );
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isSetupComplete(email: string): boolean {
  return isValidEmail(email);
}
