import { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../../types/index.js';
import { createEmbed } from '../../../utils/embeds.js';
import { logger } from '../../../utils/logger.js';

import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { BotConfig } from '../../../config/bot.js';
export default {
    data: new SlashCommandBuilder()
    .setName("support")
    .setDescription("Link zum Support-Server auf Discord"),

  async execute(interaction) {
    try {
      const supportButton = new ButtonBuilder()
        .setLabel("Support-Server beitreten")
        .setStyle(ButtonStyle.Link)
        .setURL(BotConfig.links.supportServer);

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(supportButton);

      await InteractionHelper.safeReply(interaction, {
        embeds: [
          createEmbed({ title: "Brauchst du Hilfe?", description: "Du brauchst Hilfe, hast einen Bug gefunden oder eine Idee für ein Feature? Komm auf unseren Discord-Server." }),
        ],
        components: [actionRow],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      logger.error('Support command error:', error);
      
      try {
        return await InteractionHelper.safeReply(interaction, {
          embeds: [createEmbed({ title: 'Systemfehler', description: 'Support-Infos konnten nicht angezeigt werden.', color: 'error' })],
          flags: MessageFlags.Ephemeral,
        });
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
} satisfies Command;