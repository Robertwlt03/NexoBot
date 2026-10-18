// Types shared by the dashboard API (src/web) and the dashboard frontend (dashboard/).
// Keep this file free of imports so both TypeScript projects can include it.

export interface ApiUser {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
}

export interface ApiGuildSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  /** Nexo is a member of the guild. */
  botPresent: boolean;
  /** Invite URL for guilds without Nexo. */
  inviteUrl: string | null;
}

export interface ApiChannel {
  id: string;
  name: string;
  /** discord.js ChannelType value. */
  type: number;
  parentId: string | null;
  position: number;
}

export interface ApiRole {
  id: string;
  name: string;
  color: string;
  position: number;
  managed: boolean;
  /** Nexo can assign this role (below its highest role, not managed, not @everyone). */
  assignable: boolean;
}

export interface ApiGuildDetail {
  id: string;
  name: string;
  iconUrl: string | null;
  memberCount: number;
  channels: ApiChannel[];
  roles: ApiRole[];
}

export interface ApiError {
  error: string;
}

/** Channel type values used by the frontend pickers (mirrors discord.js ChannelType). */
export const CHANNEL_TYPES = {
  text: 0,
  voice: 2,
  category: 4,
  announcement: 5,
  stage: 13,
  forum: 15,
} as const;
