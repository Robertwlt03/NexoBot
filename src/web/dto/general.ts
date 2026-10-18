// Dashboard DTO for the general module (shared by API and frontend; keep import-free).

export interface GeneralSettings {
  /** Prefix for message commands on this server. */
  prefix: string;
  /** Read-only: the bot-wide default prefix. */
  defaultPrefix: string;
  modRoleId: string | null;
  adminRoleId: string | null;
  /** Audit log channel (same value as Logging → Audit). */
  auditLogChannelId: string | null;
}
