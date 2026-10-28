import type { Command } from '../../../types/index.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, type GuildMember } from 'discord.js';
import { successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { NexoBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { getGuildGiveaways } from '../../../utils/giveaways.js';
import { finishGiveaway } from '../../../services/giveawayActions.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("gend")
        .setDescription(
            "Beendet ein aktives Giveaway sofort und zieht die Gewinner.",
        )
        .addStringOption((option) =>
            option
                .setName("messageid")
                .setDescription("Die Nachrichten-ID des Giveaways, das beendet werden soll.")
                .setRequired(true),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            throw new NexoBotError(
                'Giveaway command used outside guild',
                ErrorTypes.VALIDATION,
                'Dieser Command kann nur auf einem Server genutzt werden.',
                { userId: interaction.user.id }
            );
        }

        if (!(interaction.member as GuildMember).permissions.has(PermissionFlagsBits.ManageGuild)) {
            throw new NexoBotError(
                'User lacks ManageGuild permission',
                ErrorTypes.PERMISSION,
                "Du brauchst die Berechtigung „Server verwalten“, um ein Giveaway zu beenden.",
                { userId: interaction.user.id, guildId: interaction.guildId }
            );
        }

        logger.info(`Giveaway end initiated by ${interaction.user.tag} in guild ${interaction.guildId}`);

        const messageId = interaction.options.getString("messageid");

        if (!messageId || !/^\d+$/.test(messageId)) {
            throw new NexoBotError(
                'Invalid message ID format',
                ErrorTypes.VALIDATION,
                'Bitte gib eine gültige Nachrichten-ID an.',
                { providedId: messageId }
            );
        }

        const giveaways = await getGuildGiveaways(interaction.client, interaction.guildId);
        const giveaway = giveaways.find(g => g.messageId === messageId);

        if (!giveaway) {
            throw new NexoBotError(
                `Giveaway not found: ${messageId}`,
                ErrorTypes.VALIDATION,
                "In der Datenbank wurde kein Giveaway mit dieser Nachrichten-ID gefunden.",
                { messageId, guildId: interaction.guildId }
            );
        }

        const { giveaway: updatedGiveaway, winners, participantCount, channel } = await finishGiveaway(
            interaction.client,
            interaction.guildId,
            giveaway,
            interaction.user.id
        );

        logger.info(`Giveaway successfully ended by ${interaction.user.tag}: ${messageId}`);

        return InteractionHelper.safeReply(interaction, {
            embeds: [
                successEmbed(
                    "Giveaway beendet ✅",
                    `Das Giveaway für **${updatedGiveaway.prize}** in ${channel} wurde beendet. ${winners.length} Gewinner aus ${participantCount} Teilnahmen gezogen.`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
} satisfies Command;
