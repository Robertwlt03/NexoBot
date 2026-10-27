import type { ButtonHandler } from '../../../types/index.js';
import { HttpError } from '../../../web/http.js';
import { nexoMessage } from '../../../utils/nexoMessage.js';
import { feedPet } from '../../../services/cosmetics/pets.js';
import { syncAchievements } from '../../../services/cosmetics/achievements.js';
import { PET_FEED_BUTTON, petMessage } from '../../../commands/Profile/modules/pet.js';

// "Füttern" under /profil pet (ephemeral, so only the owner sees it): feeds and redraws the card.
export default {
  name: PET_FEED_BUTTON,
  async execute(interaction, _client, args) {
    try {
      await feedPet(interaction.user.id, args[0] ?? '');
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      await interaction.reply({ content: error.message, ephemeral: true });
      return;
    }
    await syncAchievements(interaction.user.id);
    const { container, files } = await petMessage(interaction.user.id, true);
    await interaction.update({ ...nexoMessage(container), files, attachments: [] });
  },
} satisfies ButtonHandler;
