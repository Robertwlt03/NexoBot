import type { Command } from '../../../types/index.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, type GuildMember, type GuildBasedChannel } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { NexoBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { startGiveaway } from '../../../services/giveaways/giveaways.js';
import { startedEmbed } from '../../../services/giveaways/views.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';

import { botConfig } from '../../../config/bot.js';

const GIVEAWAY_MIN_WINNERS = botConfig.giveaways?.minimumWinners ?? 1;
const GIVEAWAY_MAX_WINNERS = botConfig.giveaways?.maximumWinners ?? 10;

export default {
    data: new SlashCommandBuilder()
        .setName("gcreate")
        .setDescription("Startet ein neues Giveaway in einem bestimmten Kanal.")
        .addStringOption((option) =>
            option
                .setName("duration")
                .setDescription(
                    "Wie lange das Giveaway laufen soll (z. B. 1h, 30m, 5d).",
                )
                .setRequired(true),
        )
        .addIntegerOption((option) =>
            option
                .setName("winners")
                .setDescription("Die Anzahl der Gewinner.")
                .setMinValue(GIVEAWAY_MIN_WINNERS)
                .setMaxValue(GIVEAWAY_MAX_WINNERS)
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("prize")
                .setDescription("Der Preis, der verlost wird.")
                .setRequired(true),
        )
        .addChannelOption((option) =>
            option
                .setName("channel")
                .setDescription("Der Kanal für das Giveaway (Standard: aktueller Kanal).")
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        // Defer up front: sending the giveaway message + DB write can exceed the 3s window
        await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

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
                "Du brauchst die Berechtigung „Server verwalten“, um ein Giveaway zu starten.",
                { userId: interaction.user.id, guildId: interaction.guildId }
            );
        }

        logger.info(`Giveaway creation started by ${interaction.user.tag} in guild ${interaction.guildId}`);

        const durationString = interaction.options.getString("duration");
        const winnerCount = interaction.options.getInteger("winners")!;
        const prize = interaction.options.getString("prize");
        const targetChannel = (interaction.options.getChannel("channel") || interaction.channel) as GuildBasedChannel;

        const giveaway = await startGiveaway(interaction.client, interaction.guildId, targetChannel, {
            duration: durationString,
            winnerCount,
            prize,
            hostId: interaction.user.id,
        });

        await InteractionHelper.safeReply(interaction, {
            embeds: [startedEmbed(giveaway.prize!, `<#${targetChannel.id}>`, durationString)],
            flags: MessageFlags.Ephemeral,
        });
    },
} satisfies Command;
