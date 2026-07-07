import type {
  ActiveSessionCheckpoint,
  CompletedSession,
  DailyAggregate,
  SupportedPlatform,
  TrackingSettings,
} from '@src/types';
import {
  DEFAULT_EQUIVALENT_RATES,
  RETENTION_DAYS_DEFAULT,
} from '@src/utils/constants';
import { generateDailySalt, generateId } from '@src/utils/hash';
import { DEFAULT_DAILY_RECEIPT_TIME, getLocalTimezone } from '@scroll-receipt/shared';
import { getStorageItem, removeStorageItem, setStorageItem } from '@src/utils/storage';

const KEYS = {
  settings: 'settings',
  checkpoint: 'checkpoint',
  sessions: 'sessions',
  dailyAggregates: 'dailyAggregates',
  contentHashSalt: 'contentHashSalt',
  processedEventIds: 'processedEventIds',
  adapterHealth: 'adapterHealth',
  contentProgress: 'contentProgress',
} as const;

function emptyPlatformTotals() {
  return { youtube: 0, instagram: 0, tiktok: 0 };
}

export function createDefaultSettings(): TrackingSettings {
  const now = new Date().toISOString();
  return {
    trackingEnabled: true,
    enabledPlatforms: ['youtube', 'instagram', 'tiktok'],
    idleDetectionEnabled: true,
    dailyReceiptTime: DEFAULT_DAILY_RECEIPT_TIME,
    retentionDays: RETENTION_DAYS_DEFAULT,
    equivalentRates: { ...DEFAULT_EQUIVALENT_RATES },
    onboardingComplete: false,
    locale: 'en',
    timezone: getLocalTimezone(),
    reportEnabled: true,
    email: null,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  };
}

export interface ContentProgressEntry {
  hash: string;
  qualifiedSeconds: number;
  viewed: boolean;
  engaged: boolean;
  completed: boolean;
  quickSkip: boolean;
}

type AdapterHealth = Record<SupportedPlatform, 'ok' | 'degraded' | 'unavailable'>;

const defaultAdapterHealth = (): AdapterHealth => ({
  youtube: 'ok',
  instagram: 'ok',
  tiktok: 'ok',
});

export class StorageRepository {
  async getSettings(): Promise<TrackingSettings> {
    return (await getStorageItem<TrackingSettings>(KEYS.settings)) ?? createDefaultSettings();
  }

  async saveSettings(settings: TrackingSettings): Promise<void> {
    await setStorageItem(KEYS.settings, settings);
  }

  async updateSettings(partial: Partial<TrackingSettings>): Promise<TrackingSettings> {
    const current = await this.getSettings();
    const updated = {
      ...current,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    await this.saveSettings(updated);
    return updated;
  }

  async getCheckpoint(): Promise<ActiveSessionCheckpoint | null> {
    return getStorageItem<ActiveSessionCheckpoint>(KEYS.checkpoint);
  }

  async saveCheckpoint(checkpoint: ActiveSessionCheckpoint | null): Promise<void> {
    if (checkpoint) {
      await setStorageItem(KEYS.checkpoint, checkpoint);
    } else {
      await removeStorageItem(KEYS.checkpoint);
    }
  }

  async getSessions(): Promise<CompletedSession[]> {
    return (await getStorageItem<CompletedSession[]>(KEYS.sessions)) ?? [];
  }

  async saveSessions(sessions: CompletedSession[]): Promise<void> {
    await setStorageItem(KEYS.sessions, sessions);
  }

  async addSession(session: CompletedSession): Promise<void> {
    const sessions = await this.getSessions();
    sessions.push(session);
    await this.saveSessions(sessions);
  }

  async getDailyAggregates(): Promise<DailyAggregate[]> {
    return (await getStorageItem<DailyAggregate[]>(KEYS.dailyAggregates)) ?? [];
  }

  async saveDailyAggregates(aggregates: DailyAggregate[]): Promise<void> {
    await setStorageItem(KEYS.dailyAggregates, aggregates);
  }

  async upsertDailyAggregate(aggregate: DailyAggregate): Promise<void> {
    const aggregates = await this.getDailyAggregates();
    const index = aggregates.findIndex((a) => a.date === aggregate.date);
    if (index >= 0) {
      aggregates[index] = aggregate;
    } else {
      aggregates.push(aggregate);
    }
    aggregates.sort((a, b) => a.date.localeCompare(b.date));
    await this.saveDailyAggregates(aggregates);
  }

  async getDailyAggregate(date: string): Promise<DailyAggregate | null> {
    const aggregates = await this.getDailyAggregates();
    return aggregates.find((a) => a.date === date) ?? null;
  }

  async getContentHashSalt(): Promise<string> {
    const existing = await getStorageItem<string>(KEYS.contentHashSalt);
    if (existing) return existing;
    const salt = generateDailySalt();
    await setStorageItem(KEYS.contentHashSalt, salt);
    return salt;
  }

  async rotateDailySalt(): Promise<string> {
    const salt = generateDailySalt();
    await setStorageItem(KEYS.contentHashSalt, salt);
    return salt;
  }

  async getProcessedEventIds(): Promise<string[]> {
    return (await getStorageItem<string[]>(KEYS.processedEventIds)) ?? [];
  }

  async addProcessedEventId(eventId: string): Promise<boolean> {
    const ids = await this.getProcessedEventIds();
    if (ids.includes(eventId)) {
      return false;
    }
    ids.push(eventId);
    if (ids.length > 5000) {
      ids.splice(0, ids.length - 5000);
    }
    await setStorageItem(KEYS.processedEventIds, ids);
    return true;
  }

  async getContentProgress(): Promise<Record<string, ContentProgressEntry>> {
    return (await getStorageItem<Record<string, ContentProgressEntry>>(KEYS.contentProgress)) ?? {};
  }

  async saveContentProgress(progress: Record<string, ContentProgressEntry>): Promise<void> {
    await setStorageItem(KEYS.contentProgress, progress);
  }

  async getAdapterHealth(): Promise<AdapterHealth> {
    return (await getStorageItem<AdapterHealth>(KEYS.adapterHealth)) ?? defaultAdapterHealth();
  }

  async setAdapterHealth(
    platform: SupportedPlatform,
    status: 'ok' | 'degraded' | 'unavailable',
  ): Promise<void> {
    const health = await this.getAdapterHealth();
    health[platform] = status;
    await setStorageItem(KEYS.adapterHealth, health);
  }

  async deleteToday(date: string): Promise<void> {
    const aggregates = await this.getDailyAggregates();
    await this.saveDailyAggregates(aggregates.filter((a) => a.date !== date));

    const sessions = await this.getSessions();
    await this.saveSessions(sessions.filter((s) => !s.startedAt.startsWith(date)));

    const checkpoint = await this.getCheckpoint();
    if (checkpoint && checkpoint.startedAt.startsWith(date)) {
      await this.saveCheckpoint(null);
    }

    await this.saveContentProgress({});
  }

  async deleteAll(): Promise<void> {
    await removeStorageItem(KEYS.checkpoint);
    await removeStorageItem(KEYS.sessions);
    await removeStorageItem(KEYS.dailyAggregates);
    await removeStorageItem(KEYS.processedEventIds);
    await removeStorageItem(KEYS.contentProgress);
    await setStorageItem(KEYS.settings, createDefaultSettings());
    await this.rotateDailySalt();
  }

  async exportData(): Promise<string> {
    const data = {
      settings: await this.getSettings(),
      sessions: await this.getSessions(),
      dailyAggregates: await this.getDailyAggregates(),
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  async pruneOldSessions(): Promise<void> {
    const settings = await this.getSettings();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - settings.retentionDays);
    const cutoffIso = cutoff.toISOString();
    const sessions = await this.getSessions();
    await this.saveSessions(sessions.filter((s) => s.endedAt >= cutoffIso));
  }

  createEmptyDailyAggregate(date: string): DailyAggregate {
    return {
      date,
      timezone: getLocalTimezone(),
      platformTotals: emptyPlatformTotals(),
      platformViews: emptyPlatformTotals(),
      activeSeconds: 0,
      videosViewed: 0,
      contentAdvances: 0,
      quickSkips: 0,
      engagedViews: 0,
      completedViews: 0,
      sessionCount: 0,
      longestSessionSeconds: 0,
    };
  }
}

export const storageRepo = new StorageRepository();

export function createSessionId(): string {
  return generateId();
}
