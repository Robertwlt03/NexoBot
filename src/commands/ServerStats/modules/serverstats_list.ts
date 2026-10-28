import { PermissionFlagsBits } from 'discord.js';
import { getCounterOverview } from '../../../services/serverstats/serverstats.js';
import { emptyListEmbed, listEmbed } from '../../../services/serverstats/views.js';
import { logger } from '../../../utils/logger.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../../utils/errorHandler.js';
import type { ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { NexoClient } from '../../../types/index.js';

export async function handleList(interaction: ChatInputCommandInteraction, client: NexoClient) {
    const guild = interaction.guild!;

    try {
        await InteractionHelper.safeDefer(interaction);
    } catch (error) {
        logger.error("Failed to defer reply:", error);
        return;
    }

    if (!(interaction.member as GuildMember).permissions.has(PermissionFlagsBits.ManageChannels)) {
        await replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Du brauchst die Berechtigung **Kanäle verwalten**, um Zähler anzusehen.' }).catch(logger.error);
        return;
    }

    try {
        const entries = await getCounterOverview(client, guild);
        const embed = entries.length === 0 ? emptyListEmbed() : listEmbed(entries, new Date());
        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] }).catch(logger.error);
    } catch (error) {
        logger.error("Error displaying counters:", error);
        await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Beim Abrufen der Zähler ist ein Fehler aufgetreten. Bitte versuche es erneut.' }).catch(logger.error);
    }
}
