// XP awarding: message XP, level-ups, role rewards and the level-up announcement.

import type { Guild, GuildMember, Message } from 'discord.js';
import type { NexoClient } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { getLevelingConfig, getUserLevelData, saveUserLevelData } from './leveling.js';
import { applyXp, getXpForLevel, isOnCooldown, rollMessageXp } from './core.js';
import type { GuildLevelingConfig, LevelData } from './core.js';
import { logEvent, EVENT_TYPES } from '../loggingService.js';
import { formatLogLine } from '../../utils/logging/logEmbeds.js';
import { Mutex } from '../../utils/mutex.js';
import { wrapServiceBoundary } from '../../utils/errorHandler.js';
import { onXpGained } from '../cosmetics/hooks.js';
import { levelUpCardAttachment } from '../profileCardRenderer.js';

export interface AddXpResult {
  level: number;
  xp: number;
  totalXp: number;
  xpNeeded: number;
  leveledUp: boolean;
}

/**
 * Award XP to a member. Returns null when XP is skipped (disabled/invalid amount).
 * Throws on storage or unexpected failures.
 */
export const addXp = wrapServiceBoundary(async function addXp(client: NexoClient, guild: Guild, member: GuildMember, xpToAdd: number): Promise<AddXpResult | null> {
  const lockKey = `leveling:${guild.id}:${member.user.id}`;
  return await Mutex.runExclusive(lockKey, async (): Promise<AddXpResult | null> => {
    if (!xpToAdd || xpToAdd <= 0) {
      return null;
    }

    const config = await getLevelingConfig(client, guild.id);

    if (!config.enabled) {
      return null;
    }

    const before = await getUserLevelData(client, guild.id, member.user.id);
    const { data: levelData, reached } = applyXp(before, xpToAdd, Date.now());
    const didLevelUp = reached.length > 0;
    const initialLevel = before.level;

    for (const level of reached) {
      logger.info(`🎉 ${member.user.tag} leveled up to level ${level} in ${guild.name}`);

      if (config.roleRewards && config.roleRewards[level]) {
        await awardRoleReward(guild, member, config.roleRewards[level], level);
      }
    }

    // Bernis: awaited on level-up so the card shows what was really credited (daily cap); otherwise fire-and-forget.
    let reward = 0;
    if (!member.user.bot) {
      if (didLevelUp) reward = await onXpGained(guild, member.user.id, xpToAdd, initialLevel, levelData.level);
      else void onXpGained(guild, member.user.id, xpToAdd, initialLevel, levelData.level);
    }

    if (didLevelUp) {
      if (config.announceLevelUp) {
        await sendLevelUpAnnouncement(client, guild, member, levelData, config, reward);
      }

      try {
        await logEvent({
          client,
          guildId: guild.id,
          eventType: EVENT_TYPES.LEVELING_LEVELUP,
          data: {
            title: 'Level-Up',
            lines: [
              formatLogLine('Mitglied', `${member.user.tag} (\`${member.user.id}\`)`),
              formatLogLine('Neues Level', levelData.level.toString()),
              formatLogLine('Gewonnene Level', (levelData.level - initialLevel).toString()),
              formatLogLine('Gesamt-XP', levelData.totalXp.toString()),
            ],
            userId: member.user.id,
          },
        });
      } catch (logError) {
        logger.debug('Failed to log leveling event:', logError instanceof Error ? logError.message : String(logError));
      }
    }

    await saveUserLevelData(client, guild.id, member.user.id, levelData);
    // Global Bernis economy: monthly activity score and level-up income (best effort, never blocks XP).

    return {
      level: levelData.level,
      xp: levelData.xp,
      totalXp: levelData.totalXp,
      xpNeeded: getXpForLevel(levelData.level + 1),
      leveledUp: didLevelUp,
    };
  });
}, {
  service: 'xpSystem',
  operation: 'addXp',
  userMessage: 'XP konnten nicht vergeben werden. Bitte versuch es erneut.',
});

/** XP for a guild message when leveling is on and none of the ignore rules or the cooldown apply. */
export async function awardMessageXp(client: NexoClient, message: Message<true>): Promise<AddXpResult | null> {
  const config = await getLevelingConfig(client, message.guild.id);
  if (!config?.enabled) return null;
  if (config.ignoredChannels?.includes(message.channel.id)) return null;

  if (config.ignoredRoles?.length > 0) {
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member && member.roles.cache.some(role => config.ignoredRoles.includes(role.id))) return null;
  }

  if (config.blacklistedUsers?.includes(message.author.id)) return null;
  if (!message.content || message.content.trim().length === 0) return null;

  const { lastMessage } = await getUserLevelData(client, message.guild.id, message.author.id);
  if (isOnCooldown(config, lastMessage, Date.now())) return null;

  return addXp(client, message.guild, message.member!, rollMessageXp(config));
}

async function awardRoleReward(guild: Guild, member: GuildMember, roleId: string, level: number): Promise<void> {
  try {
    const role = guild.roles.cache.get(roleId);

    if (!role) {
      logger.warn(`Role ${roleId} not found for level ${level} reward in guild ${guild.id}`);
      return;
    }

    if (member.roles.cache.has(roleId)) {
      return;
    }

    await member.roles.add(role, `Belohnung für Level ${level}`);
    logger.info(`✅ Awarded role ${role.name} to ${member.user.tag} for reaching level ${level}`);
  } catch (error) {
    logger.error(`Failed to award role reward to ${member.user.id}:`, error);
  }
}

async function sendLevelUpAnnouncement(client: NexoClient, guild: Guild, member: GuildMember, levelData: LevelData, config: GuildLevelingConfig, reward: number): Promise<void> {
  try {
    const levelUpChannel = config.levelUpChannel
      ? guild.channels.cache.get(config.levelUpChannel)
      : guild.systemChannel;

    if (!levelUpChannel || !levelUpChannel.isTextBased()) {
      return;
    }

    const permissions = levelUpChannel.permissionsFor(guild.members.me!);
    if (!permissions || !permissions.has(['SendMessages', 'EmbedLinks'])) {
      logger.warn(`Missing permissions to send levelup message in ${levelUpChannel.id}`);
      return;
    }

    const message = config.levelUpMessage
      .replace(/{user}/g, member.toString())
      .replace(/{level}/g, String(levelData.level))
      .replace(/{xp}/g, String(levelData.xp))
      .replace(/{xpNeeded}/g, String(getXpForLevel(levelData.level + 1)));

    // Level-up card in the member's style; without AttachFiles or on render errors only the text is sent.
    const card = permissions.has('AttachFiles') ? await levelUpCardAttachment(client, member, levelData.level, reward) : null;
    await levelUpChannel.send({ content: message, files: card ? [card] : [] }).catch(error => {
      logger.error(`Failed to send level up message in channel ${levelUpChannel.id}:`, error);
    });
  } catch (error) {
    logger.error('Error sending level up announcement:', error);
  }
}
