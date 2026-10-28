import type { Command } from '../../../types/index.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, type GuildMember } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { NexoBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { getGiveaway, rerollGiveaway } from '../../../services/giveaways/giveaways.js';
import { rerolledEmbed } from '../../../services/giveaways/views.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName("greroll")
        .setDescription("Zieht neue Gewinner für ein beendetes Giveaway.")
        .addStringOption((option) =>
            option
                .setName("messageid")
                .setDescription("Die Nachrichten-ID des beendeten Giveaways.")
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
                "Du brauchst die Berechtigung „Server verwalten“, um neue Gewinner zu ziehen.",
                { userId: interaction.user.id, guildId: interaction.guildId }
            );
        }

        logger.info(`Giveaway reroll initiated by ${interaction.user.tag} in guild ${interaction.guildId}`);

        const messageId = interaction.options.getString("messageid");

        if (!messageId || !/^\d+$/.test(messageId)) {
            throw new NexoBotError(
                'Invalid message ID format',
                ErrorTypes.VALIDATION,
                'Bitte gib eine gültige Nachrichten-ID an.',
                { providedId: messageId }
            );
        }

        const giveaway = await getGiveaway(interaction.client, interaction.guildId, messageId);

        if (!giveaway) {
            throw new NexoBotError(
                `Giveaway not found: ${messageId}`,
                ErrorTypes.VALIDATION,
                "In der Datenbank wurde kein Giveaway mit dieser Nachrichten-ID gefunden.",
                { messageId, guildId: interaction.guildId }
            );
        }

        const { giveaway: rerolled, channel, messageFound } = await rerollGiveaway(interaction.client, interaction.guildId, messageId, interaction.user.id);

        return InteractionHelper.safeReply(interaction, {
            embeds: [rerolledEmbed(rerolled, channel ? `<#${channel.id}>` : null, messageFound)],
            flags: MessageFlags.Ephemeral,
        });
    },
} satisfies Command;
