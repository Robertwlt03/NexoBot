import type { Command } from '../../../types/index.js';
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, type GuildMember } from 'discord.js';
import { errorEmbed, successEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';
import { NexoBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { getGuildGiveaways } from '../../../utils/giveaways.js';
import { rerollGiveaway } from '../../../services/giveawayActions.js';
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

        const giveaways = await getGuildGiveaways(
            interaction.client,
            interaction.guildId,
        );

        const giveaway = giveaways.find(g => g.messageId === messageId);

        if (!giveaway) {
            throw new NexoBotError(
                `Giveaway not found: ${messageId}`,
                ErrorTypes.VALIDATION,
                "In der Datenbank wurde kein Giveaway mit dieser Nachrichten-ID gefunden.",
                { messageId, guildId: interaction.guildId }
            );
        }

        const { winners: newWinners, channel, messageFound } = await rerollGiveaway(
            interaction.client,
            interaction.guildId,
            giveaway,
            interaction.user.id
        );

        if (!channel) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        "Neu gezogen",
                        "Die neuen Gewinner wurden gezogen und gespeichert. Der Kanal für die Ankündigung wurde nicht gefunden.",
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        if (!messageFound) {
            return InteractionHelper.safeReply(interaction, {
                embeds: [
                    successEmbed(
                        "Neu gezogen",
                        `Die neuen Gewinner wurden in ${channel} bekannt gegeben. (Ursprüngliche Nachricht nicht gefunden.)`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });
        }

        return InteractionHelper.safeReply(interaction, {
            embeds: [
                successEmbed(
                    "Erfolgreich neu gezogen ✅",
                    `Für das Giveaway **${giveaway.prize}** in ${channel} wurden ${newWinners.length} neue Gewinner gezogen.`,
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
} satisfies Command;
