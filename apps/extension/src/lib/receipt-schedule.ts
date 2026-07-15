import { DEFAULT_DAILY_RECEIPT_TIME } from '@scroll-receipt/shared/constants';
import { getLocalTimezone } from '@scroll-receipt/shared/format';
import { updateProfile } from '@src/lib/sync';
import { storageRepo } from '@src/storage/repositories';
import type { TrackingSettings } from '@src/types';

export interface ReceiptSchedule {
  timezone: string;
  dailyReceiptTime: string;
}

export function resolveReceiptSchedule(): ReceiptSchedule {
  return {
    timezone: getLocalTimezone(),
    dailyReceiptTime: DEFAULT_DAILY_RECEIPT_TIME,
  };
}

export function formatReceiptScheduleLabel(
  schedule: ReceiptSchedule,
  locale: 'ru' | 'en',
): string {
  if (locale === 'ru') {
    return `Ежедневно в ${schedule.dailyReceiptTime}, часовой пояс: ${schedule.timezone}`;
  }
  return `Daily at ${schedule.dailyReceiptTime}, timezone: ${schedule.timezone}`;
}

/** Keep local settings and server profile aligned with browser timezone + 18:00 send time. */
export async function applyAutoReceiptSchedule(options?: {
  syncProfile?: boolean;
}): Promise<TrackingSettings> {
  const schedule = resolveReceiptSchedule();
  const current = await storageRepo.getSettings();
  const changed =
    current.timezone !== schedule.timezone ||
    current.dailyReceiptTime !== schedule.dailyReceiptTime;

  const updated = changed
    ? await storageRepo.updateSettings({
        timezone: schedule.timezone,
        dailyReceiptTime: schedule.dailyReceiptTime,
        reportEnabled: true,
      })
    : current;

  if (options?.syncProfile) {
    await updateProfile({
      timezone: schedule.timezone,
      reportEnabled: updated.reportEnabled,
      reportTimeLocal: schedule.dailyReceiptTime,
      locale: updated.locale,
    });
  }

  return updated;
}
