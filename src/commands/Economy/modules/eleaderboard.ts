import type { Command } from '../../../types/index.js';
import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../../utils/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { getEconomyLeaderboard } from '../../../utils/economy.js';

export default {
    data: new SlashCommandBuilder()
        .setName("eleaderboard")
        .setDescription("Zeige die 10 reichsten Nutzer des Servers.")
        .setDMPermission(false),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

            const guildId = interaction.guildId!;

            logger.debug(`[ECONOMY] Leaderboard requested`, { guildId });

            const allUserData = await getEconomyLeaderboard(client, guildId);

            if (allUserData.length === 0) {
                throw createError(
                    "No economy data found",
                    ErrorTypes.VALIDATION,
                    "Für diesen Server wurden keine Wirtschaftsdaten gefunden."
                );
            }

            const topUsers = allUserData.slice(0, 10);
            const userRank =
                allUserData.findIndex((u) => u.userId === interaction.user.id) +
                1;
            const rankEmoji = ["🥇", "🥈", "🥉"];
            const leaderboardEntries: string[] = [];

            for (let i = 0; i < topUsers.length; i++) {
                const user = topUsers[i];
                const rank = i + 1;
                const emoji = rankEmoji[i] || `**#${rank}**`;

                leaderboardEntries.push(
                    `${emoji} <@${user.userId}> - 🏦 ${user.net_worth.toLocaleString()}`,
                );
            }

            logger.info(`[ECONOMY] Leaderboard generated`, { 
                guildId, 
                userCount: allUserData.length,
                userRank 
            });

            const description = leaderboardEntries.length > 0
                ? leaderboardEntries.join("\n")
                : "Für diesen Server gibt es noch keine Wirtschaftsdaten.";

            const embed = createEmbed({
                title: `Wirtschafts-Bestenliste`,
                description,
                footer: `Dein Rang: ${userRank > 0 ?`#${userRank}`: "Keine Rangdaten verfügbar"}`,
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'eleaderboard' })
} satisfies Command;
