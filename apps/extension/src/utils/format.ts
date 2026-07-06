export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} SEC`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes} MIN`;
  }

  if (minutes === 0) {
    return `${hours} HR`;
  }

  return `${hours} HR ${minutes} MIN`;
}

export function formatDurationCompact(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatReceiptDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${month}/${day}/${year}`;
}

export function getLocalDateString(date = new Date(), timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getReceiptId(date: string): string {
  const [, month, day] = date.split('-');
  return `DAILY-${month}${day}`;
}

export function getWeekRange(date = new Date()): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: getLocalDateString(monday),
    end: getLocalDateString(sunday),
  };
}

export function splitSecondsAtMidnight(
  startedAt: string,
  endedAt: string,
  activeSeconds: number,
): Array<{ date: string; seconds: number }> {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const startDate = getLocalDateString(start);
  const endDate = getLocalDateString(end);

  if (startDate === endDate) {
    return [{ date: startDate, seconds: activeSeconds }];
  }

  const midnight = new Date(start);
  midnight.setHours(24, 0, 0, 0);
  const totalMs = end.getTime() - start.getTime();
  const beforeMidnightMs = midnight.getTime() - start.getTime();
  const ratio = totalMs > 0 ? beforeMidnightMs / totalMs : 0.5;
  const firstPart = Math.round(activeSeconds * ratio);
  const secondPart = activeSeconds - firstPart;

  return [
    { date: startDate, seconds: firstPart },
    { date: endDate, seconds: secondPart },
  ];
}
