// Commands: per-command and per-category access (same service as /commands and its dashboard). Changes apply at once.

import express from 'express';
import type { DashboardModule } from './index.js';
import type { CommandsOverview } from '../dto/commands.js';
import { locals } from '../dashboard.js';
import { badRequest, body, bool, str } from '../http.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import {
  disableCategory, disableCommand, enableCategory, enableCommand, getCategoryRegistry, getCommandAccessSnapshot,
  isProtectedCommand, resetCategoryCommands, resolveCommandTarget,
} from '../../services/commandAccessService.js';
import type { NexoClient } from '../../types/index.js';

async function readOverview(client: NexoClient, guildId: string): Promise<CommandsOverview> {
  const snapshot = getCommandAccessSnapshot(client, await getGuildConfig(client, guildId));
  return {
    enabledTotal: snapshot.enabledTotal,
    totalCommands: snapshot.totalCommands,
    categories: snapshot.categories.map((category) => ({
      key: category.key,
      name: category.displayName,
      icon: category.icon,
      disabled: category.categoryDisabled,
      enabledCount: category.enabledCount,
      totalCount: category.totalCount,
      commands: category.commands.map((command) => ({
        name: command.name,
        description: command.description,
        depth: command.name.split(' ').length - 1,
        locked: isProtectedCommand(command.name.split(' ')[0]),
        enabled: category.enabledCommands.includes(command.name),
        disabledDirectly: Boolean(snapshot.disabledCommands[command.name.toLowerCase()]),
      })),
    })),
  };
}

function categoryKey(client: NexoClient, value: unknown): string {
  const key = str(value, 'Kategorie', { min: 1, max: 100 });
  const category = getCategoryRegistry(client, key);
  if (!category) throw badRequest('Diese Kategorie gibt es nicht.');
  return category.key;
}

export const commandsModule: DashboardModule = {
  id: 'commands',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readOverview(client, locals(res).guild.id));
    });

    // Body: { name: 'msg notes add', enabled: boolean }
    router.post('/actions/command', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const name = str(input.name, 'Command', { min: 1, max: 100 }).toLowerCase();
      const enabled = bool(input.enabled, 'Aktiv');
      if (!resolveCommandTarget(client, name)) throw badRequest(`Den Command /${name} gibt es nicht.`);
      if (isProtectedCommand(name.split(' ')[0])) throw badRequest(`/${name} ist geschützt und bleibt immer aktiv.`);
      await (enabled ? enableCommand : disableCommand)(client, guild.id, name);
      res.json(await readOverview(client, guild.id));
    });

    // Body: { key: 'moderation', enabled: boolean }
    router.post('/actions/category', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const key = categoryKey(client, input.key);
      const enabled = bool(input.enabled, 'Aktiv');
      await (enabled ? enableCategory : disableCategory)(client, guild.id, key);
      res.json(await readOverview(client, guild.id));
    });

    // Body: { key } — same as "Zurücksetzen" in /commands dashboard: category on, all single toggles cleared.
    router.post('/actions/reset', async (req, res) => {
      const { guild } = locals(res);
      const key = categoryKey(client, body(req.body).key);
      await enableCategory(client, guild.id, key);
      await resetCategoryCommands(client, guild.id, key);
      res.json(await readOverview(client, guild.id));
    });

    return router;
  },
};
