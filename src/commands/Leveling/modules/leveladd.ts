import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { logger } from '../../../utils/logger.js';
import { NexoBotError, ErrorTypes } from '../../../utils/errorHandler.js';
import { checkUserPermissions } from '../../../utils/permissionGuard.js';
import { addLevels, getLevelingConfig } from '../../../services/leveling/leveling.js';
import { disabledEmbed, levelsAddedEmbed } from '../../../services/leveling/views.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import type { Command } from '../../../types/index.js';
export default {
  data: new SlashCommandBuilder()
    .setName('leveladd')
    .setDescription('Einem Nutzer Level hinzufügen')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Der Nutzer, der Level erhalten soll')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('levels')
        .setDescription('Anzahl der Level, die hinzugefügt werden')
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),
  category: 'Leveling',

  async execute(interaction, config, client) {
    await InteractionHelper.safeDefer(interaction);

    const hasPermission = await checkUserPermissions(
      interaction,
      PermissionFlagsBits.ManageGuild,
      'Du brauchst die Berechtigung „Server verwalten“, um diesen Command zu nutzen.'
    );
    if (!hasPermission) return;

    const levelingConfig = await getLevelingConfig(client, interaction.guildId!);
    if (!levelingConfig?.enabled) {
      await InteractionHelper.safeEditReply(interaction, {
        embeds: [disabledEmbed()],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const targetUser = interaction.options.getUser('user')!;
    const levelsToAdd = interaction.options.getInteger('levels')!;

    const member = await interaction.guild!.members.fetch(targetUser.id).catch(() => null);
    if (!member) {
      throw new NexoBotError(
        `User ${targetUser.id} not found in this guild`,
        ErrorTypes.USER_INPUT,
        'Der angegebene Nutzer ist nicht auf diesem Server.'
      );
    }

    const userData = await addLevels(client, interaction.guildId!, targetUser.id, levelsToAdd);

    await InteractionHelper.safeEditReply(interaction, {
      embeds: [levelsAddedEmbed(targetUser, levelsToAdd, userData)]
    });

    logger.info(
      `[ADMIN] User ${interaction.user.tag} added ${levelsToAdd} levels to ${targetUser.tag} in guild ${interaction.guildId}`
    );
  }
} satisfies Command;