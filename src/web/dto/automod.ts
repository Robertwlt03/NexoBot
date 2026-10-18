// Dashboard DTO for the automod module (shared by API and frontend; keep import-free).

export interface AutomodFeatures {
  spam: { enabled: boolean };
  links: { enabled: boolean; allow: string[]; timeoutMinutes: number };
  invites: { enabled: boolean; timeoutMinutes: number };
  badwords: { enabled: boolean; words: string[]; timeoutMinutes: number };
  mentions: { enabled: boolean; limit: number; timeoutMinutes: number };
}

export type AutomodFeatureId = keyof AutomodFeatures;

export interface AutomodRuleStatus {
  id: string;
  name: string;
  enabled: boolean;
  timeoutMinutes: number;
}

export interface AutomodSettingsDto {
  alertChannelId: string | null;
  exemptRoleIds: string[];
  exemptChannelIds: string[];
  features: AutomodFeatures;
  /** Read-only: Nexo's rules as Discord currently has them. */
  rules: AutomodRuleStatus[];
  /** Read-only: Nexo has "Server verwalten" (needed to read and change AutoMod rules). */
  canManage: boolean;
}

export const AUTOMOD_MAX_TIMEOUT = 40320;
export const AUTOMOD_MAX_EXEMPT_ROLES = 20;
export const AUTOMOD_MAX_EXEMPT_CHANNELS = 50;
export const AUTOMOD_MAX_ALLOW = 100;
export const AUTOMOD_MAX_WORDS = 1000;
export const AUTOMOD_MAX_ENTRY_LENGTH = 60;
