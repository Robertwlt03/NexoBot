// Birthdays: announcement channel, birthday role and the stored member birthdays (same storage as /birthday).

import express from 'express';
import { PermissionFlagsBits } from 'discord.js';
import type { Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import type { BirthdaySettings } from '../dto/birthdays.js';
import { locals } from '../dashboard.js';
import { HttpError, body, channel, role } from '../http.js';
import { requireBotPermissions, resolveNames } from '../moduleSupport.js';
import { getGuildConfig, updateGuildConfig } from '../../services/config/guildConfig.js';
import { deleteBirthday, getAllBirthdays, getUpcomingBirthdays } from '../../services/birthdayService.js';
import type { NexoClient } from '../../types/index.js';

async function readSettings(client: NexoClient, guild: Guild): Promise<BirthdaySettings> {
  const [config, all, upcoming] = await Promise.all([
    getGuildConfig(client, guild.id),
    getAllBirthdays(client, guild.id),
    getUpcomingBirthdays(client, guild.id, 5),
  ]);
  const names = await resolveNames(client, guild, all.map((entry) => entry.userId));
  return {
    channelId: config.birthdayChannelId ?? null,
    roleId: config.birthdayRoleId ?? null,
    entries: all.map(({ userId, month, day }) => ({ userId, name: names[userId] ?? userId, month, day })),
    upcoming: upcoming.map(({ userId, month, day, daysUntil }) => ({ userId, name: names[userId] ?? userId, month, day, daysUntil })),
  };
}

export const birthdaysModule: DashboardModule = {
  id: 'birthdays',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild));
    });

    router.put('/', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const channelId = channel(guild, input.channelId, 'Geburtstagskanal');
      const roleId = role(guild, input.roleId, 'Geburtstagsrolle', { assignable: true });
      if (channelId) {
        requireBotPermissions(guild, [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks], guild.channels.cache.get(channelId));
      }
      await updateGuildConfig(client, guild.id, { birthdayChannelId: channelId, birthdayRoleId: roleId });
      res.json(await readSettings(client, guild));
    });

    router.post('/entries/:userId/delete', async (req, res) => {
      const { guild } = locals(res);
      const result = await deleteBirthday(client, guild.id, req.params.userId);
      if (result.status === 'not_found') throw new HttpError(404, 'Für dieses Mitglied ist kein Geburtstag eingetragen.');
      res.json(await readSettings(client, guild));
    });

    return router;
  },
};
