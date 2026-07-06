export async function hashContentId(contentId: string, dailySalt: string): Promise<string> {
  const input = `${dailySalt}:${contentId}`;
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateEventId(
  platform: string,
  timestamp: string,
  contentId: string | null,
  kind: string,
): string {
  return `${platform}:${kind}:${timestamp}:${contentId ?? 'none'}`;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateDailySalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
