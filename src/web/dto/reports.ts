// Dashboard DTO for the reports module (shared by API and frontend; keep import-free).

export interface ReportSettings {
  channelId: string | null;
  /** Read-only: the logging master switch is on (reports are only sent when it is). */
  loggingEnabled: boolean;
  /** Read-only: the "Meldung eingereicht" log event is on. */
  eventEnabled: boolean;
}
