// Dashboard DTO for the join-to-create module (shared by API and frontend; keep import-free).

export interface JoinToCreateTriggerSettings {
  nameTemplate: string;
  /** 0 = unlimited. */
  userLimit: number;
  bitrateKbps: number;
}

export interface JoinToCreateTrigger extends JoinToCreateTriggerSettings {
  channelId: string;
  /** Read-only: the trigger channel still exists. */
  exists: boolean;
  /** Read-only: category of the trigger channel; temporary channels are created there. */
  categoryId: string | null;
}

export interface JoinToCreateState {
  triggers: JoinToCreateTrigger[];
  /** Temporary channels currently open. */
  activeChannels: number;
}

export interface JoinToCreateCreate extends JoinToCreateTriggerSettings {
  categoryId: string | null;
}

export const JTC_PLACEHOLDERS = ['{username}', '{displayName}', '{user_tag}', '{guildName}'];
export const JTC_DEFAULTS: JoinToCreateTriggerSettings = { nameTemplate: 'Raum von {username}', userLimit: 0, bitrateKbps: 64 };
