// Reports: channel for /report file (same storage as /report setchannel → logging channel "reports").

import express from 'express';
import type { DashboardModule } from './index.js';
import type { ReportSettings } from '../dto/reports.js';
import { locals } from '../dashboard.js';
import { body } from '../http.js';
import { eventEnabled, logChannel, saved } from './logging.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import { EVENT_TYPES, resolveLogChannel, setLogChannel } from '../../services/loggingService.js';
import type { NexoClient } from '../../types/index.js';

async function readSettings(client: NexoClient, guildId: string): Promise<ReportSettings> {
  const config = await getGuildConfig(client, guildId);
  return {
    channelId: resolveLogChannel(config, 'reports'),
    loggingEnabled: Boolean(config.logging?.enabled),
    eventEnabled: eventEnabled(config, EVENT_TYPES.REPORT_FILE),
  };
}

export const reportsModule: DashboardModule = {
  id: 'reports',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild.id));
    });

    router.put('/', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const current = await readSettings(client, guild.id);
      if ((input.channelId || null) !== current.channelId) {
        saved(await setLogChannel(client, guild.id, 'reports', logChannel(guild, input.channelId, 'Meldekanal')));
      }
      res.json(await readSettings(client, guild.id));
    });

    return router;
  },
};
