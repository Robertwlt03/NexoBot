// Pure giveaway rules: input validation, the stored record format, ending and drawing winners. No Discord, no clock.

import { NexoBotError, ErrorTypes } from '../../utils/errorHandler.js';

/** Stored giveaway record (`guild:{guildId}:giveaways`, one row per message in the giveaways table). */
export interface Giveaway {
  messageId: string;
  channelId?: string;
  guildId?: string | null;
  prize?: string;
  hostId?: string;
  endTime?: number;
  endsAt?: number;
  winnerCount?: number;
  participants?: string[];
  winnerIds?: string[];
  isEnded?: boolean;
  ended?: boolean;
  createdAt?: string;
  [key: string]: unknown;
}

export interface GiveawayLimits {
  minimumDuration: number;
  maximumDuration: number;
  minimumWinners: number;
  maximumWinners: number;
}

const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

const validation = (message: string, userMessage: string, context: Record<string, unknown>) =>
  new NexoBotError(message, ErrorTypes.VALIDATION, userMessage, context);

const shortDuration = (ms: number) =>
  ms % UNIT_MS.d === 0 ? `${ms / UNIT_MS.d}d` : ms % UNIT_MS.h === 0 ? `${ms / UNIT_MS.h}h` : ms % UNIT_MS.m === 0 ? `${ms / UNIT_MS.m}m` : `${Math.ceil(ms / 1000)}s`;

/** "30m", "1h", "5d", "10s" in milliseconds, within the configured range. */
export function parseDuration(input: unknown, limits: GiveawayLimits): number {
  if (!input || typeof input !== 'string') {
    throw validation('Invalid duration format provided', 'Bitte gib eine gültige Dauer an (z. B. 1h, 30m, 5d).', { input });
  }
  const match = input.trim().match(/^(\d+)([hmds])$/i);
  if (!match) {
    throw validation(`Invalid duration format: ${input}`,
      `Ungültiges Format für die Dauer. Nutze: 1h, 30m, 5d (min.: ${shortDuration(limits.minimumDuration)}, max.: ${shortDuration(limits.maximumDuration)})`, { input });
  }
  const amount = Number.parseInt(match[1], 10);
  if (amount <= 0 || amount > 999) {
    throw validation(`Duration amount out of range: ${amount}`, 'Der Wert für die Dauer muss zwischen 1 und 999 liegen.', { amount });
  }
  const ms = amount * UNIT_MS[match[2].toLowerCase()];
  if (ms > limits.maximumDuration) {
    throw validation(`Duration exceeds maximum: ${ms}ms`, `Die maximale Dauer beträgt ${Math.floor(limits.maximumDuration / UNIT_MS.d)} Tage.`, { ms });
  }
  if (ms < limits.minimumDuration) {
    throw validation(`Duration below minimum: ${ms}ms`, `Die minimale Dauer beträgt ${shortDuration(limits.minimumDuration)}.`, { ms });
  }
  return ms;
}

export function validatePrize(prize: unknown): string {
  const trimmed = typeof prize === 'string' ? prize.trim() : '';
  if (!trimmed) throw validation('Prize must be a non-empty string', 'Bitte gib eine gültige Preisbeschreibung an.', { prize });
  if (trimmed.length > 256) throw validation(`Prize too long: ${trimmed.length}`, 'Der Preis muss zwischen 1 und 256 Zeichen lang sein.', { length: trimmed.length });
  return trimmed;
}

export function validateWinnerCount(winnerCount: number, limits: GiveawayLimits): void {
  if (!Number.isInteger(winnerCount) || winnerCount < limits.minimumWinners || winnerCount > limits.maximumWinners) {
    throw validation(`Invalid winner count: ${winnerCount}`,
      `Die Anzahl der Gewinner muss zwischen ${limits.minimumWinners} und ${limits.maximumWinners} liegen.`, { winnerCount });
  }
}

export const endTimeOf = (giveaway: Giveaway): number | null => giveaway.endsAt ?? giveaway.endTime ?? null;
export const isEnded = (giveaway: Giveaway): boolean => giveaway.ended === true || giveaway.isEnded === true;
/** Ended by flag or past its end time. */
export const isClosed = (giveaway: Giveaway, now: number): boolean => isEnded(giveaway) || now > (endTimeOf(giveaway) ?? 0);

/** Giveaways from what was stored: a map keyed by message id, an array or a Replit envelope. */
export function toGiveawayList(data: unknown): Giveaway[] {
  let value = data as { ok?: unknown; value?: unknown } | null;
  while (value && typeof value === 'object' && !Array.isArray(value) && value.ok !== undefined && value.value !== undefined) {
    value = value.value as typeof value;
  }
  const list = Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [];
  return list.filter((giveaway): giveaway is Giveaway => Boolean(giveaway && typeof giveaway === 'object' && (giveaway as Giveaway).messageId));
}

/** Up to `winnerCount` distinct participants in random order; `random` returns [0, 1). */
export function selectWinners(participants: string[], winnerCount: number, random: () => number = Math.random): string[] {
  const pool = [...new Set(participants)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(1, winnerCount));
}

/** The giveaway after ending it now: winners drawn, flags set. */
export function concludeGiveaway(giveaway: Giveaway, endedBy: string, now: Date, random?: () => number): Giveaway {
  const participants = giveaway.participants ?? [];
  return {
    ...giveaway,
    ended: true,
    isEnded: true,
    winnerIds: selectWinners(participants, giveaway.winnerCount ?? 1, random),
    endedAt: now.toISOString(),
    endedBy,
    participantCount: participants.length,
  };
}

/** The giveaway with newly drawn winners. */
export function redrawGiveaway(giveaway: Giveaway, rerolledBy: string, now: Date, random?: () => number): Giveaway {
  return {
    ...giveaway,
    winnerIds: selectWinners(giveaway.participants ?? [], giveaway.winnerCount ?? 1, random),
    rerolledAt: now.toISOString(),
    rerolledBy,
  };
}
