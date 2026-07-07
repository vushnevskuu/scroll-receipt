import { getLocalTimezone } from '@src/utils/format';

const FALLBACK_TIMEZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'America/Chicago',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
] as const;

export function listTimezones(): string[] {
  if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
    return Intl.supportedValuesOf('timeZone');
  }
  return [...FALLBACK_TIMEZONES];
}

/** Local timezone first, then the rest alphabetically. */
export function buildTimezoneOptions(selected?: string): string[] {
  const local = getLocalTimezone();
  const all = listTimezones();
  const head = new Set<string>();
  if (selected) head.add(selected);
  head.add(local);
  const rest = all.filter((tz) => !head.has(tz)).sort((a, b) => a.localeCompare(b));
  return [...head, ...rest];
}

export function formatTimezoneLabel(timezone: string): string {
  try {
    const offset = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value;
    return offset ? `${timezone} (${offset})` : timezone;
  } catch {
    return timezone;
  }
}
