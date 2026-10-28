// Birthday service: saving, listing and the daily announcement with the birthday role.

import type { Collection, Guild, GuildMember, GuildTextBasedChannel } from 'discord.js';
import type { NexoClient } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { NexoBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { birthdaysOn, getMonthName, sortByDate, upcomingBirthdays, validateBirthday } from './core.js';
import type { BirthdayEntry } from './core.js';
import * as store from './store.js';
import { birthdayAnnouncement } from './views.js';

export { getMonthName } from './core.js';
export type { BirthdayEntry, UpcomingBirthday } from './core.js';
export { readBirthdaySettings as getBirthdaySettings, writeBirthdaySettings as saveBirthdaySettings } from './store.js';

export async function setBirthday(client: NexoClient, guildId: string, userId: string, month: number, day: number) {
  const validation = validateBirthday(month, day);
  if (!validation.isValid) {
    throw new NexoBotError(validation.error, ErrorTypes.VALIDATION, validation.error, { month, day, userId, guildId });
  }
  try {
    await store.writeBirthday(client, guildId, userId, { month, day });
  } catch (error) {
    logger.error(`Error setting birthday for user ${userId} in guild ${guildId}:`, error);
    throw new NexoBotError(
      'Failed to save birthday to database',
      ErrorTypes.DATABASE,
      'Dein Geburtstag konnte nicht gespeichert werden. Bitte versuch es später erneut.',
      { userId, guildId, month, day },
    );
  }
  return { month, day, monthName: getMonthName(month) };
}

export async function getUserBirthday(client: NexoClient, guildId: string, userId: string) {
  const entry = (await store.readBirthdays(client, guildId))[userId];
  return entry ? { month: entry.month, day: entry.day, monthName: getMonthName(entry.month) } : null;
}

export async function getAllBirthdays(client: NexoClient, guildId: string) {
  return sortByDate(await store.readBirthdays(client, guildId));
}

export async function getUpcomingBirthdays(client: NexoClient, guildId: string, limit = 5) {
  return upcomingBirthdays(await store.readBirthdays(client, guildId), new Date()).slice(0, limit);
}

/** Removes the member's birthday; false when none was stored. */
export async function deleteBirthday(client: NexoClient, guildId: string, userId: string): Promise<boolean> {
  if (!(await getUserBirthday(client, guildId, userId))) return false;
  try {
    await store.deleteBirthdays(client, guildId, [userId]);
  } catch (error) {
    logger.error(`Error deleting birthday for user ${userId} in guild ${guildId}:`, error);
    throw new NexoBotError(
      'Failed to delete birthday from database',
      ErrorTypes.DATABASE,
      'Dein Geburtstag konnte nicht entfernt werden. Bitte versuch es erneut.',
      { userId, guildId },
    );
  }
  return true;
}

/** The current members among `userIds` in requests of 100 (the gateway limit); null when Discord does not answer. */
async function fetchMembers(guild: Guild, userIds: string[]): Promise<Map<string, GuildMember> | null> {
  const members = new Map<string, GuildMember>();
  try {
    for (let i = 0; i < userIds.length; i += 100) {
      const chunk: Collection<string, GuildMember> = await guild.members.fetch({ user: userIds.slice(i, i + 100) });
      for (const [id, member] of chunk) members.set(id, member);
    }
  } catch {
    return null;
  }
  return members;
}

/**
 * The guild's birthdays of current members, with their display names. Birthdays of members who left are removed in
 * one query; when Discord does not answer, every stored birthday is returned and nothing is removed.
 */
export async function getMemberBirthdays(client: NexoClient, guild: Guild) {
  const birthdays = await store.readBirthdays(client, guild.id);
  const members = await fetchMembers(guild, Object.keys(birthdays));
  const stale = members ? Object.keys(birthdays).filter((userId) => !members.has(userId)) : [];
  for (const userId of stale) delete birthdays[userId];
  store.deleteBirthdays(client, guild.id, stale).catch((error) => logger.error(`Error removing stale birthdays in guild ${guild.id}:`, error));
  const names = new Map([...(members ?? [])].map(([id, member]) => [id, member.displayName]));
  return { all: sortByDate(birthdays), upcoming: upcomingBirthdays(birthdays, new Date()), names, removed: stale.length };
}

/** Member left: the birthday moves to the "left" backup so it comes back when they rejoin. */
export async function backUpBirthdayOnLeave(client: NexoClient, guildId: string, userId: string): Promise<void> {
  const entry = (await store.readBirthdays(client, guildId))[userId];
  if (!entry) return;
  const left = await store.readLeftBirthdays(client, guildId);
  left[userId] = entry;
  await store.writeLeftBirthdays(client, guildId, left);
  await store.deleteBirthdays(client, guildId, [userId]);
}

/** Member rejoined: restores a birthday from the "left" backup. */
export async function restoreBirthdayOnJoin(client: NexoClient, guildId: string, userId: string): Promise<void> {
  const left = await store.readLeftBirthdays(client, guildId);
  const entry: BirthdayEntry | undefined = left[userId];
  if (!entry) return;
  await store.writeBirthday(client, guildId, userId, entry);
  delete left[userId];
  await store.writeLeftBirthdays(client, guildId, left);
}

/** Daily job: takes yesterday's birthday role back, then congratulates today's birthdays (UTC) and gives them the role. */
export async function checkBirthdays(client: NexoClient): Promise<void> {
  const today = new Date();
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(`🎂 Running daily birthday check for UTC: ${today.getUTCMonth() + 1}/${today.getUTCDate()}.`);
  }

  for (const [guildId, guild] of client.guilds.cache) {
    try {
      // A channel is required for announcements; the birthday role is optional.
      const { channelId, roleId } = await store.readBirthdaySettings(client, guildId);
      if (!channelId) continue;

      // Not narrowed: a non-text channel throws on send and is logged below.
      const channel = await guild.channels.fetch(channelId).catch(() => null) as GuildTextBasedChannel | null;
      if (!channel) continue;

      const tracking = await store.readRoleTracking(client, guildId);
      const todayIds = birthdaysOn(await store.readBirthdays(client, guildId), today);
      const members = await fetchMembers(guild, [...new Set([...Object.keys(tracking), ...todayIds])]) ?? new Map<string, GuildMember>();

      const nextTracking: Record<string, boolean> = {};
      for (const userId of Object.keys(tracking)) {
        const member = members.get(userId);
        if (roleId && member?.roles.cache.has(roleId)) {
          await member.roles.remove(roleId, 'Geburtstagsrolle abgelaufen').catch((error) => {
            logger.error(`Error removing birthday role from ${userId}:`, error);
            nextTracking[userId] = true;
          });
        }
      }

      const birthdayMembers = todayIds.map((userId) => members.get(userId)).filter((member): member is GuildMember => !!member);
      if (roleId) {
        for (const member of birthdayMembers) {
          await member.roles.add(roleId, 'Alles Gute zum Geburtstag! 🎉')
            .then(() => { nextTracking[member.id] = true; })
            .catch((error) => logger.error(`Error adding birthday role to ${member.user.tag}:`, error));
        }
      }

      if (Object.keys(tracking).length || Object.keys(nextTracking).length) {
        await store.writeRoleTracking(client, guildId, nextTracking);
      }
      if (birthdayMembers.length > 0) {
        await channel.send(birthdayAnnouncement(birthdayMembers.map((member) => member.toString())));
      }
    } catch (error) {
      logger.error(`Error processing birthdays for guild ${guildId}:`, error);
    }
  }
}
