// Dashboard DTO for the welcome module (shared by API and frontend; keep import-free apart from shared types).

import type { WelcomeCard } from '../../shared/welcomeCard.js';

export interface WelcomeMessageSettings {
  enabled: boolean;
  channelId: string | null;
  message: string;
  ping: boolean;
  imageUrl: string | null;
  embedTitle: string;
  embedFooter: string;
  embedColor: string;
  /** Image card attached to the embed (replaces imageUrl while enabled). */
  card: WelcomeCard;
  /** Card avatar uses the member's Nexo profile frame/accent (only for members who allow it). */
  memberStyle: boolean;
}

export interface WelcomeSettings {
  welcome: WelcomeMessageSettings;
  goodbye: WelcomeMessageSettings;
  autoRole: {
    roleId: string | null;
    /** Seconds to wait before assigning the role. */
    delaySeconds: number;
  };
  /** Read-only: verification/auto-verify is active, which blocks the auto role. */
  verificationActive: boolean;
}

export const WELCOME_PLACEHOLDERS = ['{user}', '{username}', '{user.tag}', '{server}', '{memberCount}'];
