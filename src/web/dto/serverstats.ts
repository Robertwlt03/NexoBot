// Dashboard DTO for the server stats module (shared by API and frontend; keep import-free).

export type CounterType = 'members' | 'members_only' | 'bots';

export interface CounterItem {
  id: string;
  type: string;
  channelId: string;
  /** Read-only: current channel name (shows the count), null when the channel is gone. */
  channelName: string | null;
  voice: boolean;
  createdAt: string;
}

export interface ServerStatsState {
  counters: CounterItem[];
}

export interface CounterCreate {
  type: CounterType;
  channelType: 'voice' | 'text';
  categoryId: string | null;
}

export const COUNTER_TYPES: { value: CounterType; label: string }[] = [
  { value: 'members', label: 'Mitglieder + Bots' },
  { value: 'members_only', label: 'Nur Mitglieder' },
  { value: 'bots', label: 'Nur Bots' },
];
