import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { ButtonInteraction, GuildMember } from 'discord.js';
import type { NexoClient } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { NexoBotError, ErrorTypes, handleInteractionError, replyUserError } from '../utils/errorHandler.js';
import { endGiveaway, getGiveaway, isEnded, joinGiveaway, rerollGiveaway } from '../services/giveaways/giveaways.js';
import { endedByButtonEmbed, giveawayCard, joinedEmbed, rerolledByButtonEmbed, winnersEmbed } from '../services/giveaways/views.js';

function requireGuild(interaction: ButtonInteraction): asserts interaction is ButtonInteraction<'cached' | 'raw'> {
    if (!interaction.inGuild()) {
        throw new NexoBotError('Button used outside guild', ErrorTypes.VALIDATION, 'Diesen Button kannst du nur auf einem Server nutzen.', { userId: interaction.user.id });
    }
}

const canManage = (interaction: ButtonInteraction) => (interaction.member as GuildMember).permissions.has(PermissionFlagsBits.ManageGuild);

async function handle(interaction: ButtonInteraction, customId: string, run: () => Promise<unknown>) {
    try {
        await run();
    } catch (error) {
        logger.error(`Error in ${customId} handler:`, error);
        await handleInteractionError(interaction, error, { type: 'button', customId, handler: 'giveaway' });
    }
}

export const giveawayJoinHandler = {
    customId: 'giveaway_join',
    execute: (interaction: ButtonInteraction, client: NexoClient) => handle(interaction, 'giveaway_join', async () => {
        requireGuild(interaction);
        const result = await joinGiveaway(client, interaction.guildId, interaction.message.id, interaction.user.id);
        switch (result.status) {
            case 'rate_limited':
                return replyUserError(interaction, { type: ErrorTypes.RATE_LIMIT, message: 'Warte bitte einen Moment, bevor du erneut mit diesem Giveaway interagierst.' });
            case 'closed':
                return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Dieses Giveaway ist bereits beendet.' });
            case 'already_joined':
                return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Du nimmst bereits an diesem Giveaway teil! 🎉' });
        }
        await interaction.message.edit(giveawayCard(result.giveaway));
        await interaction.reply({ embeds: [joinedEmbed(result.giveaway.participants?.length ?? 0)], flags: MessageFlags.Ephemeral });
    }),
};

export const giveawayEndHandler = {
    customId: 'giveaway_end',
    execute: (interaction: ButtonInteraction, client: NexoClient) => handle(interaction, 'giveaway_end', async () => {
        requireGuild(interaction);
        if (!canManage(interaction)) {
            return replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Du brauchst die Berechtigung „Server verwalten“, um ein Giveaway zu beenden.' });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const { giveaway } = await endGiveaway(client, interaction.guildId, interaction.message.id, interaction.user.id);
        await interaction.editReply({ embeds: [endedByButtonEmbed(giveaway.winnerIds?.length ?? 0)] });
    }),
};

export const giveawayRerollHandler = {
    customId: 'giveaway_reroll',
    execute: (interaction: ButtonInteraction, client: NexoClient) => handle(interaction, 'giveaway_reroll', async () => {
        requireGuild(interaction);
        if (!canManage(interaction)) {
            return replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'Du brauchst die Berechtigung „Server verwalten“, um ein Giveaway neu auszulosen.' });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        await rerollGiveaway(client, interaction.guildId, interaction.message.id, interaction.user.id);
        await interaction.editReply({ embeds: [rerolledByButtonEmbed()] });
    }),
};

export const giveawayViewHandler = {
    customId: 'giveaway_view',
    execute: (interaction: ButtonInteraction, client: NexoClient) => handle(interaction, 'giveaway_view', async () => {
        requireGuild(interaction);
        const giveaway = await getGiveaway(client, interaction.guildId, interaction.message.id);
        if (!giveaway) {
            throw new NexoBotError('Giveaway not found in database', ErrorTypes.VALIDATION, 'Dieses Giveaway wurde nicht gefunden.', { messageId: interaction.message.id });
        }
        if (!isEnded(giveaway)) {
            return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Dieses Giveaway läuft noch, daher gibt es noch keine Gewinner.' });
        }
        await interaction.reply({ embeds: [winnersEmbed(giveaway)], flags: MessageFlags.Ephemeral });
    }),
};
