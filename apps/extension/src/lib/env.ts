export function getSupabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL ?? '';
}

export function getSupabaseAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
}

export function isBackendConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function getPublicSiteUrl(): string {
  return 'https://vushnevskuu.github.io/scroll-receipt/';
}

export function getAuthCallbackUrl(email?: string): string {
  const url = new URL('auth.html', getPublicSiteUrl());
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    url.searchParams.set('extId', chrome.runtime.id);
  }
  if (email) {
    url.searchParams.set('email', email);
  }
  return url.toString();
}
