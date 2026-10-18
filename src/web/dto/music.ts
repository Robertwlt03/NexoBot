// Dashboard DTO for the music module (shared by API and frontend; keep import-free). Music state lives in memory only.

export interface MusicTrack {
  title: string;
  author: string;
  uri: string | null;
  lengthMs: number;
}

export interface MusicState {
  /** Lavalink is configured on this bot. */
  available: boolean;
  /** A player exists for this server. */
  active: boolean;
  nowPlaying: MusicTrack | null;
  positionMs: number;
  paused: boolean;
  queueLength: number;
  volume: number;
  loop: string;
  voiceChannelId: string | null;
  twentyFourSeven: boolean;
  /** You are in the same voice channel as Nexo (needed for skip/stop, like the commands). */
  canControl: boolean;
}
