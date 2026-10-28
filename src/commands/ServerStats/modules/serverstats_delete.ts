import { PermissionFlagsBits } from 'discord.js';
import { findCounter } from '../../../services/serverstats/serverstats.js';
import { deleteConfirmation } from '../../../services/serverstats/views.js';
import { logger } from '../../../utils/logger.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { NexoClient } from '../../../types/index.js';

export async function handleDelete(interaction: ChatInputCommandInteraction, client: NexoClient) {
    const guild = interaction.guild!;
    const counterId = interaction.options.getString("counter-id");

    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    if (!(interaction.member as GuildMember).permissions.has(PermissionFlagsBits.ManageChannels)) {
        await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Du brauchst die Berechtigung **Kanäle verwalten**, um Zähler zu löschen.' }).catch(logger.error);
        return;
    }

    try {
        const { hasCounters, counter, channel } = await findCounter(client, guild, counterId);

        if (!hasCounters) {
            await replyUserError(interaction, { type: ErrorTypes.USER_INPUT, message: 'Keine Zähler zum Löschen gefunden.' }).catch(logger.error);
            return;
        }
        if (!counter) {
            await replyUserError(interaction, { type: ErrorTypes.USER_INPUT, message: `Zähler mit der ID \`${counterId}\` nicht gefunden. Nutze \`/serverstats list\`, um alle Zähler anzusehen.` }).catch(logger.error);
            return;
        }

        await InteractionHelper.safeEditReply(interaction, deleteConfirmation(counter, channel, interaction.user.id)).catch(logger.error);

    } catch (error) {
        logger.error("Error in handleDelete:", error);
        await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Beim Abrufen der Zähler ist ein Fehler aufgetreten. Bitte versuche es erneut.' }).catch(logger.error);
    }
}
