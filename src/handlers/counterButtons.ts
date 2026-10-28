import type { ButtonHandler } from '../types/index.js';
import { performDeletionByCounterId } from '../services/serverstats/serverstats.js';
import { cancelledEmbed, deletedEmbed } from '../services/serverstats/views.js';
import { logger } from '../utils/logger.js';
import { ErrorTypes, replyUserError, handleInteractionError } from '../utils/errorHandler.js';

export const counterDeleteActionHandler = {
  name: 'counter-delete',
  async execute(interaction, client, args = []) {
    try {
      
      try {
        await interaction.deferUpdate();
      } catch (error) {
        logger.error("Failed to defer button interaction:", error);
        return;
      }

      const [action, counterId, ownerId] = args;

      if (!interaction.inGuild()) {
        await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Diese Aktion kannst du nur auf einem Server nutzen.' }).catch(logger.error);
        return;
      }

      if (!action || !counterId) {
        await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Die Daten zum Löschen des Zählers fehlen.' }).catch(logger.error);
        return;
      }

      if (ownerId && interaction.user.id !== ownerId) {
        await replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'Nur der Nutzer, der das Löschen gestartet hat, kann diese Buttons nutzen.' }).catch(logger.error);
        return;
      }

      if (action === 'cancel') {
        await interaction.editReply({
          embeds: [cancelledEmbed()],
          components: []
        }).catch(logger.error);
        return;
      }

      if (action !== 'confirm') {
        await replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Unbekannte Aktion zum Löschen des Zählers.' }).catch(logger.error);
        return;
      }

      const result = await performDeletionByCounterId(client, interaction.guild!, counterId);

      await interaction.editReply({
        embeds: [deletedEmbed(result)],
        components: []
      }).catch(logger.error);
    } catch (error) {
      await handleInteractionError(interaction, error, {
        type: 'button',
        handler: 'counter_delete',
        customId: interaction.customId,
      });
    }
  }
} satisfies ButtonHandler;

export default counterDeleteActionHandler;