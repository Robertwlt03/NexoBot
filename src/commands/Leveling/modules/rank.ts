import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { NexoBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { getUserLevelData, getLevelingConfig } from '../../../services/leveling/leveling.js';
import { disabledEmbed, rankEmbed } from '../../../services/leveling/views.js';
import { canAttachFiles, profileCardAttachment } from '../../../services/profileCardRenderer.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import type { Command } from '../../../types/index.js';
export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Zeigt deinen Rang und dein Level oder die eines anderen Nutzers')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Der Nutzer, dessen Rang du sehen willst')
        .setRequired(false)
    )
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

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild!.members
      .fetch(targetUser.id)
      .catch(() => null);

    if (!member) {
      throw new NexoBotError(
        `User ${targetUser.id} not found in guild`,
        ErrorTypes.USER_INPUT,
        'Der angegebene Nutzer wurde auf diesem Server nicht gefunden.'
      );
    }

    // Image card first; the text embed below stays as fallback (no AttachFiles or rendering failed).
    const card = canAttachFiles(interaction) ? await profileCardAttachment(client, member, 'rang.png') : null;
    if (card) {
      await InteractionHelper.safeEditReply(interaction, { files: [card] });
      return;
    }

    const userData = await getUserLevelData(client, interaction.guildId!, targetUser.id);

    await InteractionHelper.safeEditReply(interaction, { embeds: [rankEmbed(member, userData)] });
    logger.debug(`Rank checked for user ${targetUser.id} in guild ${interaction.guildId}`);
  }
} satisfies Command;
