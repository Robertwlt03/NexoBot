// Giveaway actions shared by the /giveaway commands and the web dashboard (create, end, reroll, delete).

import type { Channel, Guild, GuildBasedChannel, SendableChannels, TextBasedChannel } from 'discord.js';
import type { NexoClient } from '../types/index.js';
import type { Giveaway } from '../utils/giveaways.js';
import { saveGiveaway, deleteGiveaway, getGuildGiveaways } from '../utils/giveaways.js';
import {
    parseDuration,
    validatePrize,
    validateWinnerCount,
    selectWinners,
    createGiveawayEmbed,
    createGiveawayButtons,
    endGiveaway as endGiveawayService,
} from './giveawayService.js';
import { logEvent, EVENT_TYPES } from './loggingService.js';
import { logger } from '../utils/logger.js';
import { NexoBotError, ErrorTypes } from '../utils/errorHandler.js';

export interface StartGiveawayOptions {
    duration: string | null;
    winnerCount: number;
    prize: string | null;
    hostId: string;
}

/** Validates, posts the giveaway message, stores it and logs the event (same as /giveaway create). */
export async function startGiveaway(
    client: NexoClient,
    guildId: string,
    targetChannel: GuildBasedChannel,
    { duration, winnerCount, prize, hostId }: StartGiveawayOptions,
): Promise<{ giveaway: Giveaway; prize: string }> {
    const durationMs = parseDuration(duration);
    validateWinnerCount(winnerCount);
    const prizeName = validatePrize(prize);

    if (!targetChannel.isTextBased()) {
        throw new NexoBotError(
            'Target channel is not text-based',
            ErrorTypes.VALIDATION,
            'Der Kanal muss ein Textkanal sein.',
            { channelId: targetChannel.id, channelType: targetChannel.type }
        );
    }

    const endTime = Date.now() + durationMs;

    const giveaway: Giveaway = {
        messageId: "placeholder",
        channelId: targetChannel.id,
        guildId,
        prize: prizeName,
        hostId,
        endTime: endTime,
        endsAt: endTime,
        winnerCount: winnerCount,
        participants: [],
        isEnded: false,
        ended: false,
        createdAt: new Date().toISOString()
    };

    const embed = createGiveawayEmbed(giveaway, "active");
    const row = createGiveawayButtons(false);

    const giveawayMessage = await targetChannel.send({
        content: "🎉 **NEUES GIVEAWAY** 🎉",
        embeds: [embed],
        components: [row],
    });

    giveaway.messageId = giveawayMessage.id;
    const saved = await saveGiveaway(client, guildId, giveaway);

    if (!saved) {
        logger.warn(`Failed to save giveaway to database: ${giveawayMessage.id}`);
    }

    try {
        await logEvent({
            client,
            guildId,
            eventType: EVENT_TYPES.GIVEAWAY_CREATE,
            data: {
                description: `Giveaway erstellt: ${prizeName}`,
                channelId: targetChannel.id,
                userId: hostId,
                fields: [
                    { name: 'Preis', value: prizeName, inline: true },
                    { name: 'Gewinner', value: winnerCount.toString(), inline: true },
                    { name: 'Dauer', value: duration!, inline: true },
                    { name: 'Kanal', value: targetChannel.toString(), inline: true }
                ]
            }
        });
    } catch (logError) {
        logger.debug('Error logging giveaway creation event:', logError);
    }

    logger.info(`Giveaway created successfully: ${giveawayMessage.id} in ${targetChannel.name}`);
    return { giveaway, prize: prizeName };
}

/** Ends an active giveaway now: draws winners, edits the message, announces and logs (same as /giveaway end). */
export async function finishGiveaway(
    client: NexoClient,
    guildId: string,
    giveaway: Giveaway,
    endedBy: string,
): Promise<{ giveaway: Giveaway; winners: string[]; participantCount: number; channel: TextBasedChannel }> {
    const messageId = giveaway.messageId;
    const endResult = await endGiveawayService(client, giveaway, guildId, endedBy);

    const updatedGiveaway = endResult.giveaway;
    const winners = endResult.winners;

    const channel = await client.channels.fetch(
        updatedGiveaway.channelId!,
    ).catch(err => {
        logger.warn(`Could not fetch channel ${updatedGiveaway.channelId}:`, err.message);
        return null;
    });

    if (!channel || !channel.isTextBased()) {
        throw new NexoBotError(
            `Channel not found: ${updatedGiveaway.channelId}`,
            ErrorTypes.VALIDATION,
            "Der Kanal des Giveaways wurde nicht gefunden. Der Status des Giveaways wurde trotzdem aktualisiert.",
            { channelId: updatedGiveaway.channelId, messageId }
        );
    }

    const message = await channel.messages
        .fetch(messageId)
        .catch(err => {
            logger.warn(`Could not fetch message ${messageId}:`, err.message);
            return null;
        });

    if (!message) {
        throw new NexoBotError(
            `Message not found: ${messageId}`,
            ErrorTypes.VALIDATION,
            "Die Giveaway-Nachricht wurde nicht gefunden. Der Status des Giveaways wurde trotzdem aktualisiert.",
            { messageId, channelId: updatedGiveaway.channelId }
        );
    }

    await saveGiveaway(client, guildId, updatedGiveaway);

    const newEmbed = createGiveawayEmbed(updatedGiveaway, "ended", winners);
    const newRow = createGiveawayButtons(true);

    await message.edit({
        content: "🎉 **GIVEAWAY BEENDET** 🎉",
        embeds: [newEmbed],
        components: [newRow],
    });

    if (winners.length > 0) {
        const winnerMentions = winners
            .map((id) => `<@${id}>`)
            .join(",");
        const winnerPingMsg = await (channel as SendableChannels).send({
            content: `🎉 HERZLICHEN GLÜCKWUNSCH ${winnerMentions}! Du hast das Giveaway **${updatedGiveaway.prize}** gewonnen! Melde dich beim Host <@${updatedGiveaway.hostId}>, um deinen Preis abzuholen.`,
        });
        updatedGiveaway.winnerPingMessageId = winnerPingMsg.id;
        await saveGiveaway(client, guildId, updatedGiveaway);

        logger.info(`Giveaway ended with ${winners.length} winner(s): ${messageId}`);

        try {
            await logEvent({
                client,
                guildId,
                eventType: EVENT_TYPES.GIVEAWAY_WINNER,
                data: {
                    description: `Giveaway mit ${winners.length} Gewinner(n) beendet`,
                    channelId: channel.id,
                    userId: endedBy,
                    fields: [
                        { name: 'Preis', value: updatedGiveaway.prize || 'Überraschungspreis!', inline: true },
                        { name: 'Gewinner', value: winnerMentions, inline: false },
                        { name: 'Teilnahmen', value: endResult.participantCount.toString(), inline: true }
                    ]
                }
            });
        } catch (logError) {
            logger.debug('Error logging giveaway winner event:', logError);
        }
    } else {
        await (channel as SendableChannels).send({
            content: `Das Giveaway für **${updatedGiveaway.prize}** ist ohne gültige Teilnahmen zu Ende gegangen.`,
        });
        logger.info(`Giveaway ended with no winners: ${messageId}`);
    }

    return { giveaway: updatedGiveaway, winners, participantCount: endResult.participantCount, channel };
}

/**
 * Draws new winners for an ended giveaway, edits the message and announces them (same as /giveaway reroll).
 * `channel` is null when the giveaway channel is gone; `messageFound` is false when only the announcement was sent.
 */
export async function rerollGiveaway(
    client: NexoClient,
    guildId: string,
    giveaway: Giveaway,
    rerolledBy: string,
): Promise<{ winners: string[]; channel: TextBasedChannel | null; messageFound: boolean }> {
    const messageId = giveaway.messageId;

    if (!giveaway.isEnded && !giveaway.ended) {
        throw new NexoBotError(
            `Giveaway still active: ${messageId}`,
            ErrorTypes.VALIDATION,
            "Dieses Giveaway läuft noch. Beende es zuerst mit `/giveaway end`.",
            { messageId, status: 'active' }
        );
    }

    const participants = giveaway.participants || [];

    if (participants.length < giveaway.winnerCount!) {
        throw new NexoBotError(
            `Insufficient participants for reroll: ${participants.length} < ${giveaway.winnerCount}`,
            ErrorTypes.VALIDATION,
            "Nicht genug Teilnahmen, um die nötige Anzahl an Gewinnern zu ziehen.",
            { participantsCount: participants.length, winnersNeeded: giveaway.winnerCount }
        );
    }

    const newWinners = selectWinners(participants, giveaway.winnerCount!);

    const updatedGiveaway: Giveaway = {
        ...giveaway,
        winnerIds: newWinners,
        rerolledAt: new Date().toISOString(),
        rerolledBy
    };

    const logReroll = async (winnerMentions: string, errorLabel: string) => {
        try {
            await logEvent({
                client,
                guildId,
                eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                data: {
                    description: `Giveaway neu gezogen: ${giveaway.prize}`,
                    channelId: giveaway.channelId,
                    userId: rerolledBy,
                    fields: [
                        { name: 'Preis', value: giveaway.prize || 'Überraschungspreis!', inline: true },
                        { name: 'Neue Gewinner', value: winnerMentions, inline: false },
                        { name: 'Teilnahmen gesamt', value: participants.length.toString(), inline: true }
                    ]
                }
            });
        } catch (logError) {
            logger.debug(errorLabel, logError);
        }
    };

    const channel = await client.channels.fetch(
        giveaway.channelId!,
    ).catch(err => {
        logger.warn(`Could not fetch channel ${giveaway.channelId}:`, err.message);
        return null;
    });

    if (!channel || !channel.isTextBased()) {
        await saveGiveaway(client, guildId, updatedGiveaway);
        logger.warn(`Could not find channel for giveaway ${messageId}, but saved new winners to database`);
        return { winners: newWinners, channel: null, messageFound: false };
    }

    const message = await channel.messages
        .fetch(messageId)
        .catch(err => {
            logger.warn(`Could not fetch message ${messageId}:`, err.message);
            return null;
        });

    const winnerMentions = newWinners
        .map((id) => `<@${id}>`)
        .join(",");

    if (!message) {
        await saveGiveaway(client, guildId, updatedGiveaway);

        const existingPingMsg = giveaway.winnerPingMessageId
            ? await channel.messages.fetch(giveaway.winnerPingMessageId as string).catch(() => null)
            : null;
        if (existingPingMsg) {
            await existingPingMsg.edit({
                content: `🔄 **GIVEAWAY NEU GEZOGEN** 🔄 Neue Gewinner für **${giveaway.prize}**: ${winnerMentions}!`,
            });
        } else {
            const newPingMsg = await (channel as SendableChannels).send({
                content: `🔄 **GIVEAWAY NEU GEZOGEN** 🔄 Neue Gewinner für **${giveaway.prize}**: ${winnerMentions}!`,
            });
            updatedGiveaway.winnerPingMessageId = newPingMsg.id;
        }

        logger.info(`Giveaway rerolled (message not found, but announced): ${messageId}`);
        await logReroll(winnerMentions, 'Error logging giveaway reroll:');
        return { winners: newWinners, channel, messageFound: false };
    }

    await saveGiveaway(client, guildId, updatedGiveaway);

    const newEmbed = createGiveawayEmbed(updatedGiveaway, "reroll", newWinners);
    const newRow = createGiveawayButtons(true);

    await message.edit({
        content: "🔄 **GIVEAWAY NEU GEZOGEN** 🔄",
        embeds: [newEmbed],
        components: [newRow],
    });

    const existingPingMsg = giveaway.winnerPingMessageId
        ? await channel.messages.fetch(giveaway.winnerPingMessageId as string).catch(() => null)
        : null;
    if (existingPingMsg) {
        await existingPingMsg.edit({
            content: `🔄 **NEUE GEWINNER** 🔄 HERZLICHEN GLÜCKWUNSCH ${winnerMentions}! Du hast das Giveaway **${giveaway.prize}** gewonnen! Melde dich beim Host <@${giveaway.hostId}>, um deinen Preis abzuholen.`,
        });
    } else {
        const newPingMsg = await (channel as SendableChannels).send({
            content: `🔄 **NEUE GEWINNER** 🔄 HERZLICHEN GLÜCKWUNSCH ${winnerMentions}! Du hast das Giveaway **${giveaway.prize}** gewonnen! Melde dich beim Host <@${giveaway.hostId}>, um deinen Preis abzuholen.`,
        });
        updatedGiveaway.winnerPingMessageId = newPingMsg.id;
    }

    logger.info(`Giveaway successfully rerolled: ${messageId} with ${newWinners.length} new winners`);
    await logReroll(winnerMentions, 'Error logging giveaway reroll event:');
    return { winners: newWinners, channel, messageFound: true };
}

/** Deletes the giveaway message (searching other channels as fallback) and the stored record (same as /giveaway delete). */
export async function removeGiveaway(
    client: NexoClient,
    guild: Guild | null,
    guildId: string,
    giveaway: Giveaway,
    deletedBy: string,
): Promise<{ deletedMessage: boolean; channelName: string }> {
    const messageId = giveaway.messageId;
    let deletedMessage = false;
    let channelName = "Unbekannter Kanal";

    const tryDeleteFromChannel = async (channel: Channel | null) => {
        if (!channel || !channel.isTextBased() || !channel.messages?.fetch) {
            return false;
        }

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message) {
            return false;
        }

        await message.delete();
        channelName = (channel as { name?: string | null }).name || 'unbekannter-kanal';
        deletedMessage = true;
        return true;
    };

    try {
        const channel = await client.channels.fetch(giveaway.channelId!).catch(() => null);
        if (await tryDeleteFromChannel(channel)) {
            logger.debug(`Deleted giveaway message ${messageId} from channel ${channelName}`);
        }

        if (!deletedMessage && guild) {
            const textChannels = guild.channels.cache.filter(
                ch => ch.id !== giveaway.channelId && ch.isTextBased() && ch.messages?.fetch
            );

            for (const [, guildChannel] of textChannels) {
                const foundAndDeleted = await tryDeleteFromChannel(guildChannel).catch(() => false);
                if (foundAndDeleted) {
                    logger.debug(`Deleted giveaway message ${messageId} via fallback lookup in #${channelName}`);
                    break;
                }
            }
        }
    } catch (error) {
        logger.warn(`Could not delete giveaway message: ${error instanceof Error ? error.message : String(error)}`);
    }

    const removedFromDatabase = await deleteGiveaway(client, guildId, messageId);

    if (!removedFromDatabase) {
        throw new NexoBotError(
            `Failed to delete giveaway from database: ${messageId}`,
            ErrorTypes.UNKNOWN,
            'Das Giveaway konnte nicht aus der Datenbank entfernt werden. Bitte versuch es erneut.',
            { messageId, guildId }
        );
    }

    const giveawaysAfterDelete = await getGuildGiveaways(client, guildId);
    if (giveawaysAfterDelete.some(g => g.messageId === messageId)) {
        throw new NexoBotError(
            `Giveaway still exists after deletion: ${messageId}`,
            ErrorTypes.UNKNOWN,
            'Das Löschen wurde nicht in der Datenbank gespeichert. Bitte versuch es erneut.',
            { messageId, guildId }
        );
    }

    logger.info(`Giveaway deleted: ${messageId} in ${channelName}`);

    try {
        await logEvent({
            client,
            guildId,
            eventType: EVENT_TYPES.GIVEAWAY_DELETE,
            data: {
                description: `Giveaway gelöscht: ${giveaway.prize}`,
                channelId: giveaway.channelId,
                userId: deletedBy,
                fields: [
                    { name: 'Preis', value: giveaway.prize || 'Unbekannt', inline: true },
                    { name: 'Teilnahmen', value: (giveaway.participants?.length || 0).toString(), inline: true }
                ]
            }
        });
    } catch (logError) {
        logger.debug('Error logging giveaway deletion:', logError);
    }

    return { deletedMessage, channelName };
}
