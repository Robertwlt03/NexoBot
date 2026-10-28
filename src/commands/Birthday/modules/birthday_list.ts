import { getMemberBirthdays } from '../../../services/birthdays/birthdays.js';
import { listEmbed } from '../../../services/birthdays/views.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import type { SubcommandModule } from '../../../types/index.js';

export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const guild = interaction.guild!;
        const { all, removed } = await getMemberBirthdays(client, guild);

        await InteractionHelper.safeEditReply(interaction, { embeds: [listEmbed(guild.name, all, removed)] });

        logger.info('Birthday list retrieved successfully', {
            userId: interaction.user.id,
            guildId: guild.id,
            birthdayCount: all.length,
            staleRemoved: removed,
            commandName: 'birthday_list'
        });
    }
} satisfies SubcommandModule;
