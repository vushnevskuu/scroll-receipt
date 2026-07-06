/* eslint-disable react-hooks/set-state-in-effect -- extension popup/dashboard fetch on mount */
import { useCallback, useEffect, useState } from 'react';
import type { TodaySummary, TrackingSettings, TrackingStatus, WeeklySummary } from '@src/types';
import type { DailyAggregate } from '@src/types';
import { sendMessage } from '@src/utils/messaging';

export function useTrackingStatus(pollMs = 2000) {
  const [status, setStatus] = useState<TrackingStatus | null>(null);

  const refresh = useCallback(async () => {
    const data = await sendMessage<TrackingStatus>({ type: 'GET_TRACKING_STATUS' });
    setStatus(data);
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { status, refresh };
}

export function useTodaySummary() {
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await sendMessage<TodaySummary>({ type: 'GET_TODAY_SUMMARY' });
    setSummary(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, loading, refresh };
}

export function useWeeklySummary() {
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);

  const refresh = useCallback(async () => {
    const data = await sendMessage<WeeklySummary>({ type: 'GET_WEEKLY_SUMMARY' });
    setWeekly(data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { weekly, refresh };
}

export function useHistory() {
  const [history, setHistory] = useState<DailyAggregate[]>([]);

  const refresh = useCallback(async () => {
    const data = await sendMessage<DailyAggregate[]>({ type: 'GET_HISTORY' });
    setHistory(data.reverse());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { history, refresh };
}

export function useSettings() {
  const [settings, setSettings] = useState<TrackingSettings | null>(null);

  const refresh = useCallback(async () => {
    const data = await sendMessage<TrackingSettings>({ type: 'GET_SETTINGS' });
    setSettings(data);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateSettings = useCallback(
    async (partial: Partial<TrackingSettings>) => {
      const updated = await sendMessage<TrackingSettings>({
        type: 'UPDATE_SETTINGS',
        payload: partial,
      });
      setSettings(updated);
      return updated;
    },
    [],
  );

  return { settings, refresh, updateSettings };
}

export async function pauseTracking(): Promise<void> {
  await sendMessage({ type: 'PAUSE_TRACKING' });
}

export async function resumeTracking(): Promise<void> {
  await sendMessage({ type: 'RESUME_TRACKING' });
}

export async function exportData(): Promise<string> {
  return sendMessage<string>({ type: 'EXPORT_DATA' });
}

export async function deleteAllData(): Promise<void> {
  await sendMessage({ type: 'DELETE_ALL' });
}

export async function deleteTodayData(): Promise<void> {
  await sendMessage({ type: 'DELETE_TODAY' });
}

export interface SyncState {
  lastSyncAt: string | null;
  lastError: string | null;
  status: 'ok' | 'pending' | 'error' | 'offline';
}

export function useSyncState(pollMs = 5000) {
  const [syncState, setSyncState] = useState<SyncState | null>(null);

  const refresh = useCallback(async () => {
    const data = await sendMessage<SyncState>({ type: 'GET_SYNC_STATE' });
    setSyncState(data);
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [refresh, pollMs]);

  return { syncState, refresh };
}

export async function signInWithOtp(email: string) {
  return sendMessage<{ ok: boolean; error?: string }>({ type: 'SIGN_IN_OTP', payload: { email } });
}

export async function verifyOtp(email: string, token: string) {
  return sendMessage<{ ok: boolean; error?: string }>({
    type: 'VERIFY_OTP',
    payload: { email, token },
  });
}

export async function sendTestReceipt(locale: 'ru' | 'en' = 'ru') {
  return sendMessage<{ ok: boolean; error?: string }>({
    type: 'SEND_TEST_RECEIPT',
    payload: { locale },
  });
}

export async function updateProfile(partial: {
  timezone?: string;
  reportEnabled?: boolean;
  reportTimeLocal?: string;
}) {
  return sendMessage({ type: 'UPDATE_PROFILE', payload: partial });
}

export async function signOut() {
  return sendMessage({ type: 'SIGN_OUT' });
}
