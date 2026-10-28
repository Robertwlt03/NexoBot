import { PermissionsBitField, MessageFlags, type GuildMember } from 'discord.js';
import { saveBirthdaySettings } from '../../../services/birthdays/birthdays.js';
import { channelClearedEmbed, channelErrorEmbed, channelSetEmbed, noPermissionEmbed } from '../../../services/birthdays/views.js';
import { InteractionHelper } from '../../../utils/interactionHelper.js';
import { logger } from '../../../utils/logger.js';
import type { SubcommandModule } from '../../../types/index.js';

export default {
    async execute(interaction, config, client) {
        if (!(interaction.member as GuildMember).permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return InteractionHelper.safeReply(interaction, { embeds: [noPermissionEmbed()], flags: MessageFlags.Ephemeral });
        }

        const channel = interaction.options.getChannel('channel');
        try {
            await saveBirthdaySettings(client, interaction.guildId!, { channelId: channel?.id ?? null });
        } catch (error) {
            logger.error('birthday_setchannel error:', error);
            return InteractionHelper.safeReply(interaction, { embeds: [channelErrorEmbed()], flags: MessageFlags.Ephemeral });
        }
        return InteractionHelper.safeReply(interaction, {
            embeds: [channel ? channelSetEmbed(`<#${channel.id}>`) : channelClearedEmbed()],
            flags: MessageFlags.Ephemeral,
        });
    },
} satisfies SubcommandModule;
