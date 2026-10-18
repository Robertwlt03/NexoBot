// Ticket panel: the "Support-Tickets" message with the create_ticket button. Shared by /ticket setup,
// the in-Discord ticket dashboard and the web dashboard.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { Guild, GuildTextBasedChannel, Message } from 'discord.js';
import type { GuildConfig, NexoClient } from '../types/index.js';
import { getColor } from '../config/bot.js';
import { setGuildConfig } from './config/guildConfig.js';
import { getTicketPanelStatus, messageHasButtonCustomId } from '../utils/panelStatus.js';
import { NexoBotError, ErrorTypes, type ErrorLike } from '../utils/errorHandler.js';
import { logger } from '../utils/logger.js';

export const DEFAULT_TICKET_PANEL_MESSAGE = 'Klick auf den Button unten, um ein Support-Ticket zu erstellen.';
export const DEFAULT_TICKET_BUTTON_LABEL = 'Ticket erstellen';

type PanelText = Pick<GuildConfig, 'ticketPanelMessage' | 'ticketButtonLabel'>;

export function buildTicketPanelEmbed(config: PanelText) {
    return new EmbedBuilder()
        .setTitle('Support-Tickets')
        .setDescription(config.ticketPanelMessage || DEFAULT_TICKET_PANEL_MESSAGE)
        .setColor(getColor('info'));
}

export function buildTicketPanelButtonRow(config: PanelText) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel(config.ticketButtonLabel || DEFAULT_TICKET_BUTTON_LABEL)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📩'),
    );
}

/** Sends a new panel message into the channel (does not touch the stored config). */
export async function sendTicketPanel(channel: GuildTextBasedChannel, config: PanelText): Promise<Message> {
    return channel.send({
        embeds: [buildTicketPanelEmbed(config)],
        components: [buildTicketPanelButtonRow(config)],
    });
}

export async function persistTicketPanelMessageId(client: NexoClient, guildId: string, guildConfig: GuildConfig, messageId: string | null | undefined) {
    if (!messageId || guildConfig.ticketPanelMessageId === messageId) return;
    guildConfig.ticketPanelMessageId = messageId;
    if (client.db) {
        await setGuildConfig(client, guildId, guildConfig);
    }
}

/** Posts a new panel into the configured panel channel and stores its message id. */
export async function repostTicketPanel(client: NexoClient, guild: Guild, guildConfig: GuildConfig) {
    const channel = await guild.channels.fetch(guildConfig.ticketPanelChannelId!).catch(() => null) as GuildTextBasedChannel | null;
    if (!channel) {
        throw new NexoBotError(
            'Panel channel missing',
            ErrorTypes.CONFIGURATION,
            'Der eingestellte Ticket-Panel-Kanal existiert nicht mehr. Leg im Dashboard einen neuen Panel-Kanal fest.',
        );
    }

    const sentPanel = await sendTicketPanel(channel, guildConfig);
    await persistTicketPanelMessageId(client, guild.id, guildConfig, sentPanel.id);
    return sentPanel;
}

/** Edits the live panel to the current text and button label. Returns false when no panel was found. */
export async function updateLiveTicketPanel(client: NexoClient, guild: Guild, config: GuildConfig) {
    if (!config.ticketPanelChannelId) return false;
    try {
        const panelStatus = await getTicketPanelStatus(client, guild, config);
        if (panelStatus.recoveredId) {
            await persistTicketPanelMessageId(client, guild.id, config, panelStatus.recoveredId);
        }
        if (!panelStatus.exists || !panelStatus.message) return false;

        await panelStatus.message.edit({
            embeds: [buildTicketPanelEmbed(config)],
            components: [buildTicketPanelButtonRow(config)],
        });
        return true;
    } catch (error) {
        logger.warn('Failed to update live ticket panel:', (error as ErrorLike).message);
        return false;
    }
}

/** Ticket config keys removed by "System löschen" (log and transcript channels are kept). */
const TICKET_SYSTEM_KEYS: (keyof GuildConfig)[] = [
    'ticketPanelChannelId',
    'ticketPanelMessageId',
    'ticketStaffRoleId',
    'ticketCategoryId',
    'ticketClosedCategoryId',
    'ticketPanelMessage',
    'ticketButtonLabel',
    'maxTicketsPerUser',
    'dmOnClose',
];

/** Deletes the panel message, all stored ticket records and the ticket configuration. */
export async function deleteTicketSystem(client: NexoClient, guildId: string, guildConfig: GuildConfig) {
    if (guildConfig.ticketPanelChannelId) {
        try {
            const panelChannel = await client.guilds.cache.get(guildId)?.channels.fetch(guildConfig.ticketPanelChannelId).catch(() => null) as GuildTextBasedChannel | null | undefined;
            if (panelChannel) {
                if (guildConfig.ticketPanelMessageId) {
                    const panelMessage = await panelChannel.messages.fetch(guildConfig.ticketPanelMessageId).catch(() => null);
                    if (panelMessage) await panelMessage.delete().catch(() => {});
                } else {
                    const messages = await panelChannel.messages.fetch({ limit: 50 }).catch(() => null);
                    if (messages) {
                        const found = messages.find(
                            m => m.author.id === client.user.id && messageHasButtonCustomId(m, 'create_ticket'),
                        );
                        if (found) await found.delete().catch(() => {});
                    }
                }
            }
        } catch (panelDeleteError) {
            logger.warn('Could not delete ticket panel message:', (panelDeleteError as ErrorLike).message);
        }
    }

    try {
        const { pgConfig } = await import('../config/database/postgres.js');
        if (client.db?.db?.pool && typeof client.db.db.isAvailable === 'function' && client.db.db.isAvailable()) {
            await client.db.db.pool.query(
                `DELETE FROM ${pgConfig.tables.tickets} WHERE guild_id = $1`,
                [guildId],
            );
        }
    } catch (ticketDeleteError) {
        logger.warn('Could not clear ticket records from database:', (ticketDeleteError as ErrorLike).message);
    }

    for (const key of TICKET_SYSTEM_KEYS) {
        delete guildConfig[key];
    }
    await setGuildConfig(client, guildId, guildConfig);
}
