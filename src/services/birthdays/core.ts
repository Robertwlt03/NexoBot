// Pure birthday rules: validation, month names and the order of upcoming birthdays. No database, no clock.

export interface BirthdayEntry {
  month: number;
  day: number;
}

export interface UpcomingBirthday extends BirthdayEntry {
  userId: string;
  monthName: string;
  date: Date;
  daysUntil: number;
}

export type BirthdayValidation = { isValid: true } | { isValid: false; error: string };

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const DAY_MS = 24 * 60 * 60 * 1000;

export function getMonthName(month: number): string {
  return MONTHS[month - 1] ?? 'Ungültiger Monat';
}

export function validateBirthday(month: unknown, day: unknown): BirthdayValidation {
  if (typeof month !== 'number' || typeof day !== 'number') {
    return { isValid: false, error: 'Monat und Tag müssen Zahlen sein.' };
  }
  if (month < 1 || month > 12) {
    return { isValid: false, error: 'Der Monat muss zwischen 1 und 12 liegen.' };
  }
  if (day < 1 || day > 31) {
    return { isValid: false, error: 'Der Tag muss zwischen 1 und 31 liegen.' };
  }
  // Checked against a leap year, so the 29th of February is always a valid birthday.
  const date = new Date(2000, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) {
    return { isValid: false, error: 'Ungültiges Datum. Bitte prüfe die Kombination aus Monat und Tag.' };
  }
  return { isValid: true };
}

/** All birthdays in calendar order (month, then day). */
export function sortByDate(birthdays: Record<string, BirthdayEntry>): (BirthdayEntry & { userId: string; monthName: string })[] {
  return Object.entries(birthdays)
    .map(([userId, { month, day }]) => ({ userId, month, day, monthName: getMonthName(month) }))
    .sort((a, b) => a.month - b.month || a.day - b.day);
}

/** Every birthday with its next date seen from `today` (local calendar day), soonest first; today counts as 0. */
export function upcomingBirthdays(birthdays: Record<string, BirthdayEntry>, today: Date): UpcomingBirthday[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Object.entries(birthdays)
    .map(([userId, { month, day }]) => {
      let date = new Date(start.getFullYear(), month - 1, day);
      if (date < start) date = new Date(start.getFullYear() + 1, month - 1, day);
      // Rounded, because a daylight saving switch makes a day 23 or 25 hours long.
      const daysUntil = Math.round((date.getTime() - start.getTime()) / DAY_MS);
      return { userId, month, day, monthName: getMonthName(month), date, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/** User ids whose birthday is on `date` (UTC); outside leap years the 29th of February is celebrated on the 1st of March. */
export function birthdaysOn(birthdays: Record<string, BirthdayEntry>, date: Date): string[] {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const year = date.getUTCFullYear();
  const leapYear = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
  const matches = ({ month: m, day: d }: BirthdayEntry) =>
    (m === month && d === day) || (!leapYear && m === 2 && d === 29 && month === 3 && day === 1);
  return Object.entries(birthdays).filter(([, entry]) => matches(entry)).map(([userId]) => userId);
}
