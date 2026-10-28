import { PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../../utils/embeds.js';
import { changeServerCounterType, getCounterTypeDisplay } from '../../../services/serverstatsService.js';
import { logger } from '../../../utils/logger.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes, NexoBotError } from '../../../utils/errorHandler.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { NexoClient } from '../../../types/index.js';
export async function handleUpdate(interaction: ChatInputCommandInteraction, client: NexoClient) {
    const guild = interaction.guild!;
    const counterId = interaction.options.getString("counter-id");
    const newType = interaction.options.getString("type");

    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    if (!(interaction.member as GuildMember).permissions.has(PermissionFlagsBits.ManageChannels)) {
        await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Du brauchst die Berechtigung **Kanäle verwalten**, um Zähler zu aktualisieren.' }).catch(logger.error);
        return;
    }

    if (!newType) {
        await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Du musst einen neuen Zählertyp angeben.' }).catch(logger.error);
        return;
    }

    try {
        const { counter: updatedCounter, oldType, nameUpdated } = await changeServerCounterType(client, guild, counterId, newType);
        if (!nameUpdated) {
            await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Zähler aktualisiert, aber der Kanalname konnte nicht aktualisiert werden. Er wird beim nächsten geplanten Durchlauf aktualisiert.' }).catch(logger.error);
            return;
        }

        const finalChannel = guild.channels.cache.get(updatedCounter.channelId);

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [successEmbed(`**Zähler erfolgreich aktualisiert!**\n\n**Zähler-ID:** \`${counterId}\`\n**Typ geändert:** ${getCounterTypeDisplay(oldType)} → ${getCounterTypeDisplay(newType)}\n\n**Aktuelle Einstellungen:**\n**Typ:** ${getCounterTypeDisplay(updatedCounter.type)}\n**Kanal:** ${finalChannel}\n**Kanalname:** ${finalChannel!.name}\n\nDer Zähler wird automatisch alle 15 Minuten aktualisiert.`)]
        }).catch(logger.error);

    } catch (error) {
        if (error instanceof NexoBotError && error.userMessage) {
            await replyUserError(interaction, { type: error.type, message: error.userMessage }).catch(logger.error);
            return;
        }
        logger.error("Error updating counter:", error);
        await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Beim Aktualisieren des Zählers ist ein Fehler aufgetreten. Bitte versuche es erneut.' }).catch(logger.error);
    }
}