import { getUserBirthday } from '../../../services/birthdays/birthdays.js';
import { infoEmbed, noInfoEmbed } from '../../../services/birthdays/views.js';
import { logger } from '../../../utils/logger.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import type { SubcommandModule } from '../../../types/index.js';

export default {
    async execute(interaction, config, client) {
        await InteractionHelper.safeDefer(interaction);

        const targetUser = interaction.options.getUser("user") || interaction.user;
        const guildId = interaction.guildId!;
        const birthday = await getUserBirthday(client, guildId, targetUser.id);

        if (!birthday) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [noInfoEmbed(targetUser.id === interaction.user.id, targetUser.username)]
            });
        }

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [infoEmbed(birthday.day, birthday.monthName, targetUser.toString())]
        });

        logger.info('Birthday info retrieved successfully', {
            userId: interaction.user.id,
            targetUserId: targetUser.id,
            guildId,
            commandName: 'birthday_info'
        });
    }
} satisfies SubcommandModule;
