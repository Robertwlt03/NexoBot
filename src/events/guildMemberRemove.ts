import { Events } from 'discord.js';
import { getWelcomeConfig, getUserApplications, deleteApplication } from '../utils/database.js';
import { sendGreeting } from '../utils/welcome.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { getServerCounters, updateCounter } from '../services/serverstatsService.js';
import { backUpBirthdayOnLeave } from '../services/birthdays/birthdays.js';
import { deleteUserLevelData } from '../services/leveling/leveling.js';
import { logger } from '../utils/logger.js';
import { recordLeave } from '../services/statsTracker.js';
import type { BotEvent } from '../types/index.js';

export default {
  name: Events.GuildMemberRemove,
  once: false,
  
  async execute(member) {
    recordLeave(member.guild);
    try {
        const { guild, user } = member;
        
        const welcomeConfig = await getWelcomeConfig(member.client, guild.id);
        
        if (welcomeConfig?.goodbyeEnabled && welcomeConfig.goodbyeChannelId) {
            // A missing permission or failed send skips only the goodbye message, not the cleanup below.
            try {
                await sendGreeting('goodbye', member, welcomeConfig);
            } catch (error) {
                logger.warn(`Goodbye message failed in guild ${guild.id}:`, error);
            }
        }

        try {
            await logEvent({
                client: member.client,
                guildId: guild.id,
                eventType: EVENT_TYPES.MEMBER_LEAVE,
                data: {
                    title: 'Nutzer hat den Server verlassen',
                    lines: [
                        `**Nutzer:** ${user.toString()} (${user.tag})`,
                        `**ID:** \`${user.id}\``,
                        `**Beigetreten:** <t:${Math.floor((member.joinedTimestamp || Date.now()) / 1000)}:R>`,
                        `**Mitglieder:** ${guild.memberCount}`,
                    ],
                    quoted: false,
                    thumbnail: user.displayAvatarURL(),
                    userId: user.id,
                }
            });
        } catch (error) {
            logger.debug('Error logging member leave:', error);
        }

        try {
            const counters = await getServerCounters(member.client, guild.id);
            for (const counter of counters) {
                if (counter && counter.type && counter.channelId && counter.enabled !== false) {
                    await updateCounter(member.client, guild, counter);
                }
            }
        } catch (error) {
            logger.debug('Error updating counters on member leave:', error);
        }

        try {
            await backUpBirthdayOnLeave(member.client, guild.id, user.id);
        } catch (error) {
            logger.debug('Error handling birthday on member leave:', error);
        }

        try {
            const userApplications = await getUserApplications(member.client, guild.id, user.id);
            if (userApplications && userApplications.length > 0) {
                for (const app of userApplications) {
                    await deleteApplication(member.client, guild.id, app.id, user.id);
                }
                logger.debug(`Removed ${userApplications.length} applications for user ${user.id} in guild ${guild.id}`);
            }
        } catch (error) {
            logger.debug('Error handling applications on member leave:', error);
        }

        try {
            await deleteUserLevelData(member.client, guild.id, user.id);
            logger.debug(`Removed leveling data for user ${user.id} in guild ${guild.id}`);
        } catch (error) {
            logger.debug('Error handling leveling data on member leave:', error);
        }
        
    } catch (error) {
        logger.error('Error in guildMemberRemove event:', error);
    }
  }
} satisfies BotEvent<Events.GuildMemberRemove>;