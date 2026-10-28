import { getTicketData, saveTicketData } from '../utils/database.js';
import { handleChannelDeleted } from '../services/jointocreate/jointocreate.js';
import { removeCounterForChannel } from '../services/serverstats/serverstats.js';
import { logger } from '../utils/logger.js';
import type { BotEvent } from '../types/index.js';

export default {
    name: 'channelDelete',
    async execute(channel, client) {
        
        if (channel.type === 0 && channel.guild) {
            try {
                const ticketData = await getTicketData(channel.guild.id, channel.id);
                if (ticketData && ticketData.status === 'open') {
                    ticketData.status = 'deleted';
                    ticketData.closedAt = new Date().toISOString();
                    await saveTicketData(channel.guild.id, channel.id, ticketData);
                    logger.info(`Ticket channel ${channel.id} was manually deleted in guild ${channel.guild.id}, marked as deleted`);
                }
            } catch (err) {
                logger.warn(`Could not clean up ticket record for deleted channel ${channel.id}:`, err);
            }
        }

        // Counter channels can be text or voice channels.
        if (!channel.isDMBased()) {
            await removeCounterForChannel(client, channel.guild.id, channel.id)
                .catch((error) => logger.warn(`Could not remove the counter of deleted channel ${channel.id}:`, error));
        }

if (channel.type !== 2 && channel.type !== 4) {
            return;
        }

        const guildId = channel.guild.id;

        try {
            await handleChannelDeleted(client, guildId, channel.id);
        } catch (error) {
            logger.error(`Error in channelDelete event for guild ${guildId}:`, error);
        }
    }
} satisfies BotEvent<'channelDelete'>;