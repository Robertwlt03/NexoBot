import { PermissionFlagsBits, ChannelType } from 'discord.js';
import { createEmbed, successEmbed } from '../../../utils/embeds.js';
import { createServerCounter, getCounterTypeLabel } from '../../../services/serverstatsService.js';
import { logger } from '../../../utils/logger.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes, NexoBotError } from '../../../utils/errorHandler.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { NexoClient } from '../../../types/index.js';
export async function handleCreate(interaction: ChatInputCommandInteraction, client: NexoClient) {
    const guild = interaction.guild!;
    const type = interaction.options.getString("type")!;
    const channelType = interaction.options.getString("channel_type");
    const category = interaction.options.getChannel("category");

    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    if (!(interaction.member as GuildMember).permissions.has(PermissionFlagsBits.ManageChannels)) {
        await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Du brauchst die Berechtigung **Kanäle verwalten**, um Zähler zu erstellen.' }).catch(logger.error);
        return;
    }

    try {
        if (!category || category.type !== ChannelType.GuildCategory) {
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Bitte wähle eine gültige Kategorie für den Zählerkanal.' }).catch(logger.error);
            return;
        }

        const { counter: newCounter, channel: targetChannel, nameUpdated } = await createServerCounter(client, guild, {
            type,
            channelType,
            categoryId: category.id,
            createdBy: interaction.user.tag,
        });

        if (!nameUpdated) {
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Zähler erstellt, aber der Kanalname konnte nicht aktualisiert werden. Er wird beim nächsten geplanten Durchlauf aktualisiert.' }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(`**Zähler erfolgreich erstellt!**\n\n**Typ:** ${getCounterTypeLabel(type)}\n**Kanaltyp:** ${targetChannel.type === ChannelType.GuildVoice ? 'Sprachkanal' : 'Textkanal'}\n**Kategorie:** ${category}\n**Kanal:** ${targetChannel}\n**Kanalname:** ${targetChannel.name}\n**Zähler-ID:** \`${newCounter.id}\`\n\nDer Zähler wird automatisch alle 15 Minuten aktualisiert.\n\nNutze \`/serverstats list\`, um alle Zähler anzusehen.`)]
        }).catch(logger.error);

    } catch (error) {
        if (error instanceof NexoBotError && error.userMessage) {
            await replyUserError(interaction, { type: error.type, message: error.userMessage }).catch(logger.error);
            return;
        }
        logger.error("Error creating counter:", error);
        await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Beim Erstellen des Zählers ist ein Fehler aufgetreten. Bitte versuche es erneut.' }).catch(logger.error);
    }
}