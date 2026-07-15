import type {
  DailyAggregate,
  SupportedPlatform,
  TodaySummary,
  TrackingSettings,
  TrackingStatus,
  WeeklySummary,
} from '@src/types';
import type { ExtensionMessage } from '@src/types/messages';
import {
  buildWeeklySummary,
  mergeLiveCheckpoint,
} from '@src/tracking/daily-aggregation';
import { sessionEngine } from '@src/tracking/session-engine';
import { buildReceiptData } from '@src/receipts/equivalent-engine';
import { storageRepo } from '@src/storage/repositories';
import { ALARM_NAMES } from '@src/utils/constants';
import { getLocalDateString, getWeekRange } from '@src/utils/format';
import { importSessionFromMagicLink, signInWithOtp, signOut, verifyOtp } from '@src/lib/supabase';
import { getSyncState, sendTestReceipt, syncDailyUsage, updateProfile } from '@src/lib/sync';
import { applyAutoReceiptSchedule } from '@src/lib/receipt-schedule';
import { onMessage } from '@src/utils/message-listener';

async function buildTrackingStatus(): Promise<TrackingStatus> {
  const settings = await storageRepo.getSettings();
  const checkpoint = await storageRepo.getCheckpoint();
  const today = getLocalDateString();
  const aggregate = await storageRepo.getDailyAggregate(today);
  const adapterHealth = await storageRepo.getAdapterHealth();

  const live = mergeLiveCheckpoint(aggregate, checkpoint, today);

  return {
    trackingEnabled: settings.trackingEnabled,
    isPaused: !settings.trackingEnabled,
    currentPlatform: checkpoint?.platform ?? null,
    currentSessionActiveSeconds: checkpoint?.activeSeconds ?? 0,
    todayActiveSeconds: live.activeSeconds,
    todayVideosViewed: live.videosViewed,
    platformTotals: live.platformTotals,
    adapterHealth,
  };
}

async function getTodaySummary(): Promise<TodaySummary> {
  await sessionEngine.regenerateAggregates();
  const today = getLocalDateString();
  const stored = await storageRepo.getDailyAggregate(today);
  const checkpoint = await storageRepo.getCheckpoint();
  const aggregate = mergeLiveCheckpoint(stored, checkpoint, today);
  const status = await buildTrackingStatus();

  const summary: TodaySummary = {
    aggregate: aggregate.activeSeconds > 0 || checkpoint ? aggregate : stored,
    checkpoint,
    status,
  };
  void syncDailyUsage(summary.aggregate);
  return summary;
}

async function syncTodayAggregate(force = false): Promise<void> {
  const today = getLocalDateString();
  const stored = await storageRepo.getDailyAggregate(today);
  const checkpoint = await storageRepo.getCheckpoint();
  const aggregate = mergeLiveCheckpoint(stored, checkpoint, today);
  await syncDailyUsage(aggregate, force);
}

async function finalizeVerifiedEmailSetup(email: string | null): Promise<void> {
  await storageRepo.updateSettings({
    onboardingComplete: true,
    email: email ?? (await storageRepo.getSettings()).email,
    emailVerified: true,
    trackingEnabled: true,
    reportEnabled: true,
  });
  await applyAutoReceiptSchedule({ syncProfile: true });
  await syncTodayAggregate(true);
}

async function getWeeklySummaryData(): Promise<WeeklySummary> {
  const { start, end } = getWeekRange();
  const aggregates = (await storageRepo.getDailyAggregates()).filter(
    (a: DailyAggregate) => a.date >= start && a.date <= end,
  );
  const summary = buildWeeklySummary(aggregates);

  return {
    weekStart: start,
    weekEnd: end,
    totalActiveSeconds: summary.totalActiveSeconds,
    dailyAverages: summary.dailyAverage,
    mostUsedPlatform: summary.mostUsedPlatform,
    longestDaySeconds: summary.longestDaySeconds,
    aggregates,
  };
}

function scheduleAlarms(settings: TrackingSettings): void {
  chrome.alarms.create(ALARM_NAMES.STALE_SESSION, { periodInMinutes: 1 });
  chrome.alarms.create(ALARM_NAMES.CHECKPOINT, { periodInMinutes: 1 });

  const [hours, minutes] = settings.dailyReceiptTime.split(':').map(Number);
  const now = new Date();
  const next = new Date();
  next.setHours(hours ?? 21, minutes ?? 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  chrome.alarms.create(ALARM_NAMES.DAILY_RECEIPT, { when: next.getTime(), periodInMinutes: 24 * 60 });
}

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'TRACKING_HEARTBEAT':
      await sessionEngine.processHeartbeat(message.payload);
      return { ok: true };

    case 'CONTENT_CHANGED':
    case 'PAGE_STATE_CHANGED':
    case 'PLAYBACK_STATE_CHANGED':
      return { ok: true };

    case 'GET_TRACKING_STATUS':
      return buildTrackingStatus();

    case 'GET_TODAY_SUMMARY':
      return getTodaySummary();

    case 'GET_WEEKLY_SUMMARY':
      return getWeeklySummaryData();

    case 'GET_HISTORY':
      return storageRepo.getDailyAggregates();

    case 'GET_SETTINGS':
      return storageRepo.getSettings();

    case 'UPDATE_SETTINGS':
      return storageRepo.updateSettings(message.payload);

    case 'PAUSE_TRACKING':
      return storageRepo.updateSettings({ trackingEnabled: false });

    case 'RESUME_TRACKING':
      return storageRepo.updateSettings({ trackingEnabled: true });

    case 'DELETE_TODAY': {
      const today = getLocalDateString();
      await storageRepo.deleteToday(today);
      await sessionEngine.regenerateAggregates();
      return { ok: true };
    }

    case 'DELETE_ALL':
      await storageRepo.deleteAll();
      await sessionEngine.initialize();
      return { ok: true };

    case 'EXPORT_DATA':
      return storageRepo.exportData();

    case 'FINALIZE_STALE_SESSIONS':
      await sessionEngine.finalizeStaleSessions();
      return { ok: true };

    case 'REGENERATE_AGGREGATES':
      return sessionEngine.regenerateAggregates();

    case 'GET_SYNC_STATE':
      return getSyncState();

    case 'SYNC_NOW': {
      const today = getLocalDateString();
      const agg = await storageRepo.getDailyAggregate(today);
      return syncDailyUsage(agg, true);
    }

    case 'SEND_TEST_RECEIPT':
      return sendTestReceipt(message.payload.locale ?? 'ru');

    case 'SIGN_IN_OTP':
      return signInWithOtp(message.payload.email, message.payload.locale);

    case 'VERIFY_OTP': {
      const result = await verifyOtp(message.payload.email, message.payload.token);
      if (result.ok) {
        await finalizeVerifiedEmailSetup(message.payload.email);
      }
      return result;
    }

    case 'SIGN_OUT':
      await signOut();
      await storageRepo.updateSettings({
        emailVerified: false,
        onboardingComplete: false,
        reportEnabled: false,
      });
      return { ok: true };

    case 'UPDATE_PROFILE': {
      await updateProfile(message.payload);
      const partial: Partial<TrackingSettings> = {};
      if (message.payload.timezone) partial.timezone = message.payload.timezone;
      if (message.payload.reportEnabled !== undefined) {
        partial.reportEnabled = message.payload.reportEnabled;
      }
      if (message.payload.reportTimeLocal) {
        partial.dailyReceiptTime = message.payload.reportTimeLocal;
      }
      if (message.payload.locale) {
        partial.locale = message.payload.locale;
      }
      if (Object.keys(partial).length > 0) {
        await storageRepo.updateSettings(partial);
      }
      return { ok: true };
    }

    default:
      return { ok: false };
  }
}

export function registerBackgroundHandlers(): void {
  onMessage(handleMessage);

  chrome.runtime.onMessageExternal.addListener((rawMessage, _sender, sendResponse) => {
    const message = rawMessage as
      | {
          type?: string;
          payload?: {
            access_token?: string;
            refresh_token?: string;
            expires_at?: number;
            email?: string | null;
          };
        }
      | undefined;

    if (message?.type !== 'AUTH_SESSION_FROM_PAGE') {
      sendResponse({ ok: false, error: 'Unsupported external message' });
      return undefined;
    }

    void (async () => {
      const payload = message.payload;
      if (!payload?.access_token || !payload?.refresh_token) {
        sendResponse({ ok: false, error: 'Missing session tokens' });
        return;
      }

      const result = await importSessionFromMagicLink({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
        expires_at: payload.expires_at,
      });

      if (!result.ok) {
        sendResponse(result);
        return;
      }

      await finalizeVerifiedEmailSetup(result.email ?? payload.email ?? null);
      sendResponse({ ok: true, email: result.email ?? payload.email ?? null });
    })();

    return true;
  });

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      void chrome.runtime.openOptionsPage();
    }
  });

  chrome.alarms.onAlarm.addListener(async (alarm: chrome.alarms.Alarm) => {
    if (alarm.name === ALARM_NAMES.STALE_SESSION || alarm.name === ALARM_NAMES.CHECKPOINT) {
      await sessionEngine.finalizeStaleSessions();
      await syncTodayAggregate();
    }

    if (alarm.name === ALARM_NAMES.DAILY_RECEIPT) {
      await sessionEngine.finalizeStaleSessions();
      await sessionEngine.regenerateAggregates();
      await syncTodayAggregate(true);
      const hasNotifications = await chrome.permissions.contains({ permissions: ['notifications'] });
      if (hasNotifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icon/48.png'),
          title: 'YOUR DAILY RECEIPT IS READY',
          message: 'See where your attention went today.',
        });
      }
    }
  });

  void (async () => {
    await sessionEngine.initialize();
    const settings = await applyAutoReceiptSchedule({ syncProfile: true });
    scheduleAlarms(settings);
    await syncTodayAggregate();
  })();
}

export async function getReceiptForDate(date: string) {
  const aggregate = await storageRepo.getDailyAggregate(date);
  if (!aggregate) return null;
  const settings = await storageRepo.getSettings();
  return buildReceiptData(aggregate, settings.equivalentRates);
}

export async function markAdapterHealth(
  platform: SupportedPlatform,
  status: 'ok' | 'degraded' | 'unavailable',
): Promise<void> {
  await storageRepo.setAdapterHealth(platform, status);
}

export type { DailyAggregate };
