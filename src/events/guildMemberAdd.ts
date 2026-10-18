import { Events } from 'discord.js';
import type { Guild, GuildMember, Role } from 'discord.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import { getWelcomeConfig } from '../utils/database.js';
import { sendGreeting } from '../utils/welcome.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { getServerCounters, updateCounter } from '../services/serverstatsService.js';
import { setBirthday as dbSetBirthday } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { recordJoin } from '../services/statsTracker.js';
import type { BirthdayEntry } from '../utils/database.js';
import type { VerificationConfig } from '../services/verificationService.js';
import type { BotEvent, NexoClient } from '../types/index.js';
import type { ErrorLike } from '../utils/errorHandler.js';

export default {
  name: Events.GuildMemberAdd,
  once: false,
  
  async execute(member) {
    recordJoin(member.guild);
    try {
        const { guild, user } = member;
        
        const config = await getGuildConfig(member.client, guild.id);
        
        const welcomeConfig = await getWelcomeConfig(member.client, guild.id);
        
        if (welcomeConfig?.enabled && welcomeConfig.channelId) {
            // Missing permissions or a failed send skip only the welcome message; the rest of the
            // join pipeline (auto-role, verification, logging, counters) must still run.
            try {
                await sendGreeting('welcome', member, welcomeConfig);
            } catch (error) {
                logger.warn(`Welcome message failed in guild ${guild.id}:`, error);
            }
        }
        
        if (welcomeConfig?.roleIds && welcomeConfig.roleIds.length > 0) {
            const delay = welcomeConfig.autoRoleDelay || 0;
            const singleRoleId = welcomeConfig.roleIds[0];
            
            if (delay > 0) {
                const timeout = setTimeout(async () => {
                    const role = guild.roles.cache.get(singleRoleId);
                    if (role) {
                        await assignRoleSafely(member, role);
                    }
                }, delay * 1000);
                if (typeof timeout.unref === 'function') {
                    timeout.unref();
                }
            } else {
                const role = guild.roles.cache.get(singleRoleId);
                if (role) {
                    await assignRoleSafely(member, role);
                }
            }
        }
        
        if (config?.verification?.enabled || config?.verification?.autoVerify?.enabled) {
            await handleVerification(member, guild, config.verification, member.client);
        }

        try {
            await logEvent({
                client: member.client,
                guildId: guild.id,
                eventType: EVENT_TYPES.MEMBER_JOIN,
                data: {
                    title: 'Nutzer beigetreten',
                    lines: [
                        `**Nutzer:** ${user.toString()} (${user.displayName !== user.username ? `@${user.displayName}` : user.tag})`,
                        `**ID:** \`${user.id}\``,
                        `**Erstellt:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
                        `**Mitglieder:** ${guild.memberCount}`,
                    ],
                    quoted: false,
                    thumbnail: user.displayAvatarURL(),
                    userId: user.id,
                }
            });
        } catch (error) {
            logger.debug('Error logging member join:', error);
        }

        try {
            const counters = await getServerCounters(member.client, guild.id);
            for (const counter of counters) {
                if (counter && counter.type && counter.channelId && counter.enabled !== false) {
                    await updateCounter(member.client, guild, counter);
                }
            }
        } catch (error) {
            logger.debug('Error updating counters on member join:', error);
        }

        try {
            const backupKey = `guild:${guild.id}:birthdays:left`;
            const backup = (await member.client.db.get<Record<string, BirthdayEntry>>(backupKey)) || {};
            if (backup[user.id]) {
                const { month, day } = backup[user.id];
                await dbSetBirthday(member.client, guild.id, user.id, month, day);
                delete backup[user.id];
                await member.client.db.set(backupKey, backup);
                logger.debug(`Birthday restored for user ${user.id} in guild ${guild.id}`);
            }
        } catch (error) {
            logger.debug('Error restoring birthday on member join:', error);
        }
        
    } catch (error) {
        logger.error('Error in guildMemberAdd event:', error);
    }
  }
} satisfies BotEvent<Events.GuildMemberAdd>;

async function handleVerification(member: GuildMember, guild: Guild, verificationConfig: VerificationConfig, client: NexoClient) {
    const { autoVerifyOnJoin } = await import('../services/verificationService.js');
    
    try {
        const result = await autoVerifyOnJoin(client, guild, member, verificationConfig);
        
        if (result.autoVerified) {
            logger.info('User auto-verified on join', {
                guildId: guild.id,
                userId: member.id,
                userTag: member.user.tag,
                roleName: result.roleName,
                criteria: result.criteria
            });
        } else {
            logger.debug('User not auto-verified on join', {
                guildId: guild.id,
                userId: member.id,
                reason: result.reason
            });
        }

    } catch (error) {
        logger.error('Error in auto-verification for member', {
            guildId: guild.id,
            userId: member.id,
            userTag: member.user.tag,
            error: (error as ErrorLike).message
        });
    }
}

async function assignRoleSafely(member: GuildMember, role: Role) {
    try {
        await member.roles.add(role);
    } catch (error) {
        logger.warn(`Failed to assign role ${role.id} to member ${member.id}:`, error);
    }
}