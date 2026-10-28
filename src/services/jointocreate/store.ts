// The only place that reads or writes Join-to-Create data: one config per guild (`guild:{guildId}:jointocreate`)
// holding the triggers, their options and the open temporary channels. One read or write per call.

import type { NexoClient } from '../../types/index.js';
import { getJoinToCreateConfigKey } from '../../utils/database/keys.js';
import { unwrapReplitData } from '../../utils/database/guildConfigStorage.js';
import { normalizeConfig } from './core.js';
import type { JoinToCreateConfig } from './core.js';

export async function readConfig(client: NexoClient, guildId: string): Promise<JoinToCreateConfig> {
  return normalizeConfig(unwrapReplitData(await client.db.get<Partial<JoinToCreateConfig>>(getJoinToCreateConfigKey(guildId), {})));
}

export async function writeConfig(client: NexoClient, guildId: string, config: JoinToCreateConfig): Promise<void> {
  await client.db.set(getJoinToCreateConfigKey(guildId), config);
}
