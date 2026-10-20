/** The zone a store's business day runs in until its Super Admin picks another. */
export const DEFAULT_TIME_ZONE = 'Africa/Cairo';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether `tz` is an IANA zone this runtime knows, e.g. "Africa/Cairo". */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Falls back to the default zone for anything `Intl` doesn't recognise, rather than failing. */
export function safeTimeZone(tz?: string): string {
  return isValidTimeZone(tz) ? tz : DEFAULT_TIME_ZONE;
}

/** `YYYY-MM-DD` of an instant as seen in `tz` — the same key Mongo's `$dateToString` produces. */
export function dayKey(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** How far `tz` is ahead of UTC at an instant, in milliseconds. */
function offsetMs(instant: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant a calendar day begins in `tz`. Guessing UTC midnight and
 * correcting by the zone's offset twice lands right even when a DST change
 * sits between the guess and the answer.
 */
export function zonedMidnight(year: number, month: number, day: number, tz: string): Date {
  const utcMidnight = Date.UTC(year, month - 1, day);
  let instant = utcMidnight;
  for (let i = 0; i < 2; i++) instant = utcMidnight - offsetMs(instant, tz);
  return new Date(instant);
}

/** The instant local midnight began in `tz` on the day containing `date`. */
export function startOfDay(date: Date, tz: string): Date {
  const [y, m, d] = dayKey(date, tz).split('-').map(Number);
  return zonedMidnight(y, m, d, tz);
}

/** The instant the local day after the one containing `date` begins. */
export function startOfNextDay(date: Date, tz: string): Date {
  return startOfDay(new Date(startOfDay(date, tz).getTime() + DAY_MS + DAY_MS / 2), tz);
}

/**
 * `[start, end)` instants for calendar days `from`..`to` (inclusive,
 * `YYYY-MM-DD`) in the store's zone — what "1 to 31 October" means to the
 * store owner, whatever the server's own clock zone. Either end may be open.
 */
export function zonedDayRange(from: string | undefined, to: string | undefined, tz: string): { start?: Date; end?: Date } {
  const day = (text: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (!match) throw new Error(`Not a date: "${text}"`);
    return zonedMidnight(Number(match[1]), Number(match[2]), Number(match[3]), tz);
  };
  return {
    start: from ? day(from) : undefined,
    end: to ? startOfNextDay(new Date(day(to).getTime() + DAY_MS / 2), tz) : undefined,
  };
}
