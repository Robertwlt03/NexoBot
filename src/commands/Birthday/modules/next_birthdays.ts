import { getMemberBirthdays } from '../../../services/birthdays/birthdays.js';
import { nextEmbed } from '../../../services/birthdays/views.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import type { SubcommandModule } from '../../../types/index.js';

export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const guild = interaction.guild!;
        const { upcoming, names, removed } = await getMemberBirthdays(client, guild);
        const next5 = upcoming.slice(0, 5);

        await InteractionHelper.safeEditReply(interaction, { embeds: [nextEmbed(guild.name, next5, names, removed)] });

        logger.info('Next birthdays retrieved successfully', {
            userId: interaction.user.id,
            guildId: guild.id,
            upcomingCount: next5.length,
            commandName: 'next_birthdays'
        });
    }
} satisfies SubcommandModule;
