// Europe/Berlin calendar helpers for the Kristall economy: days (daily cap, daily bonus), weeks (black market,
// Monday 00:00) and months (rankings) all follow German local time, DST included.

const TZ = 'Europe/Berlin';
const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

interface BerlinParts { year: number; month: number; day: number; hour: number; minute: number; second: number }

export function berlinParts(date: Date): BerlinParts {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
  };
}

/** Offset of Berlin local time from UTC at `date`, in ms. */
function offsetAt(date: Date): number {
  const p = berlinParts(date);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant when Berlin local time reads year-month-day hour:minute (month 1–12; overflowing days roll over). */
export function berlinTime(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetAt(new Date(guess));
  return new Date(guess - offsetAt(new Date(first)));
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

/** Berlin calendar day as YYYY-MM-DD. */
export function berlinDay(date: Date = new Date()): string {
  const p = berlinParts(date);
  return ymd(p.year, p.month, p.day);
}

/** Calendar arithmetic on YYYY-MM-DD strings. */
export function shiftDay(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Start of the next Berlin day after `date`. */
export function nextBerlinMidnight(date: Date = new Date()): Date {
  const [y, m, d] = shiftDay(berlinDay(date), 1).split('-').map(Number);
  return berlinTime(y, m, d);
}

/** Monday (YYYY-MM-DD) of the Berlin week containing `date`. */
export function weekStartOf(date: Date = new Date()): string {
  const day = berlinDay(date);
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return shiftDay(day, -((weekday + 6) % 7));
}

/** Instant a week (given by its Monday) ends: the next Monday 00:00 Berlin. */
export function weekEnd(weekStart: string): Date {
  const [y, m, d] = shiftDay(weekStart, 7).split('-').map(Number);
  return berlinTime(y, m, d);
}

/** First day (YYYY-MM-01) of the Berlin month containing `date`, shifted by `offset` months. */
export function monthStartOf(date: Date = new Date(), offset = 0): string {
  const p = berlinParts(date);
  const shifted = new Date(Date.UTC(p.year, p.month - 1 + offset, 1));
  return ymd(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 1);
}

/** Instant a month (YYYY-MM-01) ends: the 1st of the next month 00:00 Berlin. */
export function monthEnd(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  return berlinTime(y, m + 1, 1);
}
