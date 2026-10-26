// Dashboard DTO for the tickets module (shared by API and frontend; keep import-free).

export interface TicketSettings {
  panelChannelId: string | null;
  panelMessage: string;
  buttonLabel: string;
  openCategoryId: string | null;
  closedCategoryId: string | null;
  staffRoleId: string | null;
  /** 1–10 open tickets per member. */
  maxTicketsPerUser: number;
  dmOnClose: boolean;
  logsChannelId: string | null;
  transcriptChannelId: string | null;
}

export type TicketPanelState = 'active' | 'no_channel' | 'channel_missing' | 'panel_deleted';

export interface OpenTicket {
  channelId: string;
  channelName: string | null;
  userId: string;
  userName: string;
  claimedByName: string | null;
  /** Level key from the bot config (low, medium, high, urgent) and its label; null when no priority is set. */
  priority: { level: string; label: string } | null;
  reason: string | null;
  createdAt: string;
}

export interface TicketOverview {
  panel: { state: TicketPanelState; url: string | null };
  stats: {
    openCount: number;
    closedCount: number;
    avgCloseTimeMs: number | null;
    feedbackCount: number;
    avgRating: number | null;
  };
  /** Newest first, capped at OPEN_TICKET_LIMIT. */
  openTickets: OpenTicket[];
}

export const OPEN_TICKET_LIMIT = 50;
export const DEFAULT_PANEL_MESSAGE = 'Klick auf den Button unten, um ein Support-Ticket zu erstellen.';
export const DEFAULT_BUTTON_LABEL = 'Ticket erstellen';
