// General: prefix, moderator/admin role and audit log channel (same path as /configwizard: ConfigService.updateSetting).

import express from 'express';
import type { DashboardModule } from './index.js';
import type { GeneralSettings } from '../dto/general.js';
import { locals } from '../dashboard.js';
import { badRequest, body, role, str } from '../http.js';
import { logChannel } from './logging.js';
import ConfigService from '../../services/config/configService.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import { getCommandPrefix } from '../../config/bot.js';
import { ErrorTypes, NexoBotError } from '../../utils/errorHandler.js';
import type { NexoClient } from '../../types/index.js';

async function readSettings(client: NexoClient, guildId: string): Promise<GeneralSettings> {
  const config = await getGuildConfig(client, guildId);
  return {
    prefix: config.prefix || getCommandPrefix(),
    defaultPrefix: getCommandPrefix(),
    modRoleId: config.modRole ?? null,
    adminRoleId: config.adminRole ?? null,
    auditLogChannelId: config.logging?.channels?.audit ?? null,
  };
}

export const generalModule: DashboardModule = {
  id: 'general',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild.id));
    });

    router.put('/', async (req, res) => {
      const { guild, member } = locals(res);
      const input = body(req.body);
      const current = await readSettings(client, guild.id);

      const prefix = str(input.prefix, 'Prefix', { min: 1, max: 10 });
      if (/\s/.test(prefix)) throw badRequest('Der Prefix darf keine Leerzeichen enthalten.');
      const modRole = role(guild, input.modRoleId, 'Moderator-Rolle');
      const adminRole = role(guild, input.adminRoleId, 'Admin-Rolle');
      const audit = input.auditLogChannelId === current.auditLogChannelId
        ? current.auditLogChannelId
        : logChannel(guild, input.auditLogChannelId, 'Log-Kanal');

      const changes: [key: string, value: string | null][] = [];
      if (prefix !== current.prefix) changes.push(['prefix', prefix]);
      if (modRole !== current.modRoleId) changes.push(['modRole', modRole]);
      if (adminRole !== current.adminRoleId) changes.push(['adminRole', adminRole]);
      if (audit !== current.auditLogChannelId) changes.push(['logChannelId', audit]);

      for (const [key, value] of changes) {
        try {
          await ConfigService.updateSetting(client, guild.id, key, value, member.id);
        } catch (error) {
          if (error instanceof NexoBotError && error.type === ErrorTypes.VALIDATION && error.userMessage) {
            throw badRequest(error.userMessage.replace(/\*\*/g, ''));
          }
          throw error;
        }
      }
      res.json(await readSettings(client, guild.id));
    });

    return router;
  },
};
