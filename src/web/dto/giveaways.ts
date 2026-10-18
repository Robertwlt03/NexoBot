// Dashboard DTO for the giveaways module (shared by API and frontend; keep import-free).

export interface GiveawayUser {
  id: string;
  name: string;
}

export interface GiveawayItem {
  messageId: string;
  channelId: string | null;
  prize: string;
  host: GiveawayUser | null;
  /** Unix ms. */
  endsAt: number | null;
  winnerCount: number;
  entries: number;
  ended: boolean;
  winners: GiveawayUser[];
  /** Jump link to the giveaway message. */
  messageUrl: string | null;
}

export type GiveawayStatus = 'active' | 'ended';

export interface GiveawayList {
  items: GiveawayItem[];
  total: number;
  page: number;
  pageSize: number;
  activeCount: number;
  endedCount: number;
  minWinners: number;
  maxWinners: number;
}

export interface GiveawayCreate {
  channelId: string | null;
  prize: string;
  /** Like the command: 10s, 30m, 1h, 5d. */
  duration: string;
  winnerCount: number;
}

export const GIVEAWAY_PAGE_SIZE = 10;
