export function getSupabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL ?? '';
}

export function getSupabaseAnonKey(): string {
  return import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
}

export function isBackendConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
