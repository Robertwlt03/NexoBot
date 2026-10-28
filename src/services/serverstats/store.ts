// The only place that reads or writes server stats data: the counter list of a guild (`guild:{guildId}:counters`,
// the `counters` column of the guild row, see keyParser). One read or write per call.

import type { NexoClient } from '../../types/index.js';
import { getServerCountersKey } from '../../utils/database/keys.js';
import { parseCounters } from './core.js';
import type { ServerCounter } from './core.js';

export async function readCounters(client: NexoClient, guildId: string): Promise<ServerCounter[]> {
  return parseCounters(await client.db.get(getServerCountersKey(guildId)), guildId, new Date().toISOString());
}

export async function writeCounters(client: NexoClient, guildId: string, counters: ServerCounter[]): Promise<void> {
  await client.db.set(getServerCountersKey(guildId), parseCounters(counters, guildId, new Date().toISOString()));
}
