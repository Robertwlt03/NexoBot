// Pure server stats rules: counter types, channel names, counts and the stored counter format. No Discord, no clock.

export interface CounterTypeConfig {
  label: string;
  baseName: string;
  emoji: string;
}

/** Stored server counter (`guild:{guildId}:counters`). */
export interface ServerCounter {
  id: string;
  type: string;
  channelId: string;
  guildId: string;
  createdAt: string;
  enabled: boolean;
  updatedAt?: string;
}

export interface CounterStats {
  totalCount: number;
  botCount: number;
  humanCount: number;
}

export const COUNTER_TYPE_CONFIG: Record<string, CounterTypeConfig> = {
  members: { label: 'Mitglieder + Bots', baseName: 'Mitglieder & Bots', emoji: '👥' },
  members_only: { label: 'Nur Mitglieder', baseName: 'Mitglieder', emoji: '👤' },
  bots: { label: 'Nur Bots', baseName: 'Bots', emoji: '🤖' },
};

const UNKNOWN_TYPE: CounterTypeConfig = { label: 'Unbekannt', baseName: 'Zähler', emoji: '❓' };
const counterConfig = (type: string) => COUNTER_TYPE_CONFIG[type] ?? UNKNOWN_TYPE;

export const getCounterTypeLabel = (type: string) => counterConfig(type).label;
export const getCounterBaseName = (type: string) => counterConfig(type).baseName;
export const getCounterEmoji = (type: string) => counterConfig(type).emoji;
export const getCounterTypeDisplay = (type: string) => `${getCounterEmoji(type)} ${getCounterTypeLabel(type)}`;

/** Channel name for a count; `template` is `counters.defaults.channelName` from the bot config. */
export function formatCounterChannelName(type: string, count: number | string, template = '{name}-{count}'): string {
  return template.replaceAll('{name}', getCounterBaseName(type)).replaceAll('{count}', String(count));
}

/** Members, bots and humans; the total comes from Discord's member count when it is known. */
export function counterStats(memberCount: number | undefined, fetchedMembers: number, bots: number): CounterStats {
  const totalCount = typeof memberCount === 'number' ? memberCount : fetchedMembers;
  return { totalCount, botCount: bots, humanCount: Math.max(totalCount - bots, 0) };
}

/** The count a counter of `type` shows, or null for an unknown type. */
export function countFor(stats: CounterStats, type: string): number | null {
  switch (type) {
    case 'members': return stats.totalCount;
    case 'bots': return stats.botCount;
    case 'members_only': return stats.humanCount;
    default: return null;
  }
}

function isCounterShape(value: unknown): value is Partial<ServerCounter> & Pick<ServerCounter, 'id' | 'type' | 'channelId'> {
  const counter = value as Record<string, unknown> | null;
  return Boolean(counter && typeof counter === 'object'
    && typeof counter.id === 'string' && counter.id.length > 0
    && typeof counter.type === 'string'
    && typeof counter.channelId === 'string' && counter.channelId.length > 0);
}

/**
 * Counters from whatever was stored (array, JSON string, Replit envelope or a single counter), with defaults filled
 * in. `now` is the creation time for counters that have none.
 */
export function parseCounters(data: unknown, guildId: string, now: string): ServerCounter[] {
  let list: unknown[] = [];
  const envelope = data as { ok?: unknown; value?: unknown } | null;
  if (Array.isArray(data)) list = data;
  else if (envelope && typeof envelope === 'object' && envelope.ok && Array.isArray(envelope.value)) list = envelope.value;
  else if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }
  } else if (isCounterShape(data)) list = [data];

  return list.filter(isCounterShape).map((counter) => ({
    id: String(counter.id),
    type: String(counter.type),
    channelId: String(counter.channelId),
    guildId: String(counter.guildId || guildId),
    createdAt: counter.createdAt || now,
    enabled: typeof counter.enabled === 'boolean' ? counter.enabled : true,
    ...(counter.updatedAt ? { updatedAt: counter.updatedAt } : {}),
  }));
}
