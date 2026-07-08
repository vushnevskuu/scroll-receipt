import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAuthCallbackUrl, getSupabaseAnonKey, getSupabaseUrl } from '@src/lib/env';

const AUTH_STORAGE_KEY = 'scroll-receipt-auth';

let client: SupabaseClient | null = null;

export interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

export function getSupabase(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return null;

  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export async function loadStoredSession() {
  const raw = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  return raw[AUTH_STORAGE_KEY] as StoredSession | null;
}

export async function saveStoredSession(session: StoredSession | null): Promise<void> {
  if (session) {
    await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session });
  } else {
    await chrome.storage.local.remove(AUTH_STORAGE_KEY);
  }
}

export async function getAuthenticatedSupabase(): Promise<SupabaseClient | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const stored = await loadStoredSession();
  if (!stored) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  });

  if (error || !data.session) {
    await saveStoredSession(null);
    return null;
  }

  await saveStoredSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });

  return supabase;
}

export async function signInWithOtp(email: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Backend not configured' };

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getAuthCallbackUrl(email),
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function normalizeEmailAuthLink(raw: string): string {
  return raw.trim().replace(/^\[|\]$/g, '').replace(/&amp;/g, '&');
}

export function looksLikeEmailSignInLink(value: string): boolean {
  try {
    const url = new URL(normalizeEmailAuthLink(value));
    return /supabase\.co$/i.test(url.hostname) && /\/auth\/v1\/verify$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function buildExtensionHandledEmailLink(rawLink: string, email: string): string {
  const url = new URL(normalizeEmailAuthLink(rawLink));
  url.searchParams.set('redirect_to', getAuthCallbackUrl(email));
  return url.toString();
}

export async function openEmailSignInLink(
  rawLink: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const rewritten = buildExtensionHandledEmailLink(rawLink, email);
    await chrome.tabs.create({ url: rewritten });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid sign-in link' };
  }
}

export async function verifyOtp(
  email: string,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Backend not configured' };

  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.session) return { ok: false, error: error?.message ?? 'Verification failed' };

  await saveStoredSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });

  return { ok: true };
}

export async function importSessionFromMagicLink(
  session: StoredSession,
): Promise<{ ok: boolean; error?: string; email?: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Backend not configured' };

  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error || !data.session) {
    return { ok: false, error: error?.message ?? 'Session import failed' };
  }

  await saveStoredSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
  });

  return { ok: true, email: data.user?.email ?? data.session.user.email ?? null };
}

export async function signOut(): Promise<void> {
  const supabase = await getAuthenticatedSupabase();
  if (supabase) await supabase.auth.signOut();
  await saveStoredSession(null);
}
