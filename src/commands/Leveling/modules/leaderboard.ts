import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { getLeaderboard, getLevelingConfig } from '../../../services/leveling/leveling.js';
import { disabledEmbed, emptyLeaderboardEmbed, leaderboardEmbed } from '../../../services/leveling/views.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import type { Command } from '../../../types/index.js';
export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Zeigt die Level-Bestenliste des Servers')
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    await InteractionHelper.safeDefer(interaction);

    const levelingConfig = await getLevelingConfig(client, interaction.guildId!);

    if (!levelingConfig?.enabled) {
      await InteractionHelper.safeEditReply(interaction, {
        embeds: [disabledEmbed()],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const leaderboard = await getLeaderboard(client, interaction.guildId!, 10);

    const embed = leaderboard.length ? leaderboardEmbed(leaderboard) : emptyLeaderboardEmbed();
    await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    logger.debug(`Leaderboard displayed for guild ${interaction.guildId}`);
  }
} satisfies Command;