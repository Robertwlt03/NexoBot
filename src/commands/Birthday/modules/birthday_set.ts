import { setBirthday } from '../../../services/birthdays/birthdays.js';
import { savedEmbed } from '../../../services/birthdays/views.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import type { SubcommandModule } from '../../../types/index.js';

export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const month = interaction.options.getInteger("month")!;
        const day = interaction.options.getInteger("day")!;
        const saved = await setBirthday(client, interaction.guildId!, interaction.user.id, month, day);

        await InteractionHelper.safeEditReply(interaction, { embeds: [savedEmbed(saved.day, saved.monthName)] });
    }
} satisfies SubcommandModule;
