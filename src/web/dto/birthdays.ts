// Dashboard DTO for the birthdays module (shared by API and frontend; keep import-free).

export interface BirthdayEntry {
  userId: string;
  name: string;
  month: number;
  day: number;
  /** Only set in `upcoming`. */
  daysUntil?: number;
}

export interface BirthdaySettings {
  channelId: string | null;
  roleId: string | null;
  /** Read-only: all stored birthdays, sorted by date. */
  entries: BirthdayEntry[];
  /** Read-only: next birthdays. */
  upcoming: BirthdayEntry[];
}
