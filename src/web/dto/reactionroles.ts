// Dashboard DTO for the reaction roles module (shared by API and frontend; keep import-free).

export interface ReactionRolePanel {
  messageId: string;
  channelId: string;
  /** Jump link to the posted message, null when it is gone. */
  url: string | null;
  /** Title/description live only in the posted Discord message (empty when it is gone). */
  title: string;
  description: string;
  roleIds: string[];
  status: 'ok' | 'deleted' | 'channel_missing';
  /** Old emoji-reaction panel: shown read-only, can only be deleted. */
  legacy: boolean;
}

export interface ReactionRolesData {
  panels: ReactionRolePanel[];
}

export interface CreateReactionRolePanel {
  channelId: string;
  title: string;
  description: string;
  roleIds: string[];
}

export const MAX_PANELS = 5;
export const MAX_ROLES = 25;
export const TITLE_MAX = 256;
export const DESCRIPTION_MAX = 2048;
