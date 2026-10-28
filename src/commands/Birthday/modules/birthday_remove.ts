import { deleteBirthday } from '../../../services/birthdays/birthdays.js';
import { nothingToRemoveEmbed, removedEmbed } from '../../../services/birthdays/views.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import type { SubcommandModule } from '../../../types/index.js';

export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const removed = await deleteBirthday(client, interaction.guildId!, interaction.user.id);

        await InteractionHelper.safeEditReply(interaction, { embeds: [removed ? removedEmbed() : nothingToRemoveEmbed()] });
    }
} satisfies SubcommandModule;
