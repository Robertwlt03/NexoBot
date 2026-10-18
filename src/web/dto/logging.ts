// Dashboard DTO for the logging module (shared by API and frontend; keep import-free).

export const LOG_DESTINATIONS = ['audit', 'applications', 'reports'] as const;
export type LogDestination = (typeof LOG_DESTINATIONS)[number];

export interface LoggingEventCategory {
  key: string;
  label: string;
  /** Channel the events of this category go to. */
  destination: LogDestination;
  events: { type: string; label: string }[];
}

export interface LoggingSettings {
  enabled: boolean;
  channels: Record<LogDestination, string | null>;
  /** Event type → enabled. */
  events: Record<string, boolean>;
  ignore: { users: string[]; channels: string[] };
  /** Read-only: display names for ignored user ids. */
  userNames: Record<string, string>;
  /** Read-only: event catalog grouped like the in-Discord dashboard. */
  categories: LoggingEventCategory[];
}
