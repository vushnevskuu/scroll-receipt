import {
  getLocalTimezone,
  SYNC_MIN_INTERVAL_MS,
} from '@scroll-receipt/shared';
import { usageSyncBatchSchema } from '@scroll-receipt/shared';
import { getAuthenticatedSupabase } from '@src/lib/supabase';
import { getOrCreateDeviceId } from '@src/lib/device-id';
import { syncRecordsFromAggregate } from '@src/lib/sync-helpers';
import { getSupabaseUrl } from '@src/lib/env';
import type { DailyAggregate } from '@src/types';
import { getStorageItem, setStorageItem } from '@src/utils/storage';

const SYNC_STATE_KEY = 'syncState';

interface SyncState {
  lastSyncAt: string | null;
  lastError: string | null;
  status: 'ok' | 'pending' | 'error' | 'offline';
}

export async function getSyncState(): Promise<SyncState> {
  return (
    (await getStorageItem<SyncState>(SYNC_STATE_KEY)) ?? {
      lastSyncAt: null,
      lastError: null,
      status: 'pending',
    }
  );
}

async function setSyncState(state: Partial<SyncState>): Promise<void> {
  const current = await getSyncState();
  await setStorageItem(SYNC_STATE_KEY, { ...current, ...state });
}

export async function syncDailyUsage(
  aggregate: DailyAggregate | null,
  force = false,
): Promise<SyncState> {
  if (!aggregate) {
    return getSyncState();
  }

  if (!navigator.onLine) {
    await setSyncState({ status: 'offline' });
    return getSyncState();
  }

  const supabase = await getAuthenticatedSupabase();
  if (!supabase) {
    await setSyncState({ status: 'pending', lastError: null });
    return getSyncState();
  }

  const syncState = await getSyncState();
  if (
    !force &&
    syncState.lastSyncAt &&
    Date.now() - new Date(syncState.lastSyncAt).getTime() < SYNC_MIN_INTERVAL_MS
  ) {
    return syncState;
  }

  try {
    const deviceId = await getOrCreateDeviceId();
    const timezone = getLocalTimezone();
    const clientUpdatedAt = new Date().toISOString();

    const records = syncRecordsFromAggregate(aggregate).map((row) => ({
      deviceId,
      localDate: aggregate.date,
      timezone,
      platform: row.platform,
      seconds: row.seconds,
      views: row.views,
      clientUpdatedAt,
    }));

    if (records.length === 0) {
      return syncState;
    }

    const payload = usageSyncBatchSchema.parse({ records });
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) throw new Error('No session');

    const res = await fetch(`${getSupabaseUrl()}/functions/v1/sync-usage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    await setSyncState({
      status: 'ok',
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    });
  } catch (error) {
    await setSyncState({
      status: 'error',
      lastError: error instanceof Error ? error.message : 'Sync failed',
    });
  }

  return getSyncState();
}

export async function sendTestReceipt(locale: 'ru' | 'en' = 'ru'): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getAuthenticatedSupabase();
  if (!supabase) return { ok: false, error: 'Not signed in' };

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return { ok: false, error: 'No session' };

  const res = await fetch(`${getSupabaseUrl()}/functions/v1/send-test-receipt?locale=${locale}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }
  return { ok: true };
}

export async function updateProfile(partial: {
  timezone?: string;
  reportEnabled?: boolean;
  reportTimeLocal?: string;
  locale?: 'ru' | 'en';
}): Promise<void> {
  const supabase = await getAuthenticatedSupabase();
  if (!supabase) return;

  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  const payload: Record<string, string | boolean> = {
    user_id: user.user.id,
    email: user.user.email ?? '',
  };

  if (partial.timezone !== undefined) payload.timezone = partial.timezone;
  if (partial.reportEnabled !== undefined) payload.report_enabled = partial.reportEnabled;
  if (partial.reportTimeLocal !== undefined) payload.report_time_local = partial.reportTimeLocal;
  if (partial.locale !== undefined) payload.locale = partial.locale;

  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });
  if (error) throw error;
}
