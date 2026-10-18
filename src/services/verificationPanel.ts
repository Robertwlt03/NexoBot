// Verification panel message (embed + "verify_user" button), shared by /verification and the web dashboard.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { Guild, Message, TextChannel } from 'discord.js';
import { botConfig, getColor } from '../config/bot.js';
import { logger } from '../utils/logger.js';
import { NexoBotError, ErrorTypes } from '../utils/errorHandler.js';
import type { VerificationConfig } from './verificationService.js';

type PanelContent = Pick<VerificationConfig, 'message' | 'buttonText'>;

export function buildVerificationPanel(cfg: PanelContent) {
    const verifyEmbed = new EmbedBuilder()
        .setTitle('Server-Verifizierung')
        .setDescription(cfg.message || botConfig.verification.defaultMessage)
        .setColor(getColor('success'));

    const verifyButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('verify_user')
            .setLabel(cfg.buttonText || botConfig.verification.defaultButtonText)
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
    );

    return { embeds: [verifyEmbed], components: [verifyButton] };
}

/** Edits the posted panel in place (no-op when it is gone). */
export async function updateLiveVerificationPanel(guild: Guild, cfg: VerificationConfig): Promise<void> {
    if (!cfg.channelId || !cfg.messageId) return;
    try {
        const channel = guild.channels.cache.get(cfg.channelId) as TextChannel | undefined;
        if (!channel) return;
        const msg = await channel.messages.fetch(cfg.messageId).catch(() => null);
        if (!msg) return;
        await msg.edit(buildVerificationPanel(cfg));
    } catch (error) {
        logger.warn('Could not update live verification panel:', (error as Error).message);
    }
}

/** Posts a fresh panel in the configured channel. The caller stores the returned message id. */
export async function repostVerificationPanel(guild: Guild, cfg: VerificationConfig): Promise<Message> {
    const channel = (await guild.channels.fetch(cfg.channelId!).catch(() => null)) as TextChannel | null;
    if (!channel) {
        throw new NexoBotError(
            'Panel channel missing',
            ErrorTypes.CONFIGURATION,
            'Der eingerichtete Verifizierungskanal existiert nicht mehr. Lege im Dashboard einen neuen Kanal fest.',
        );
    }
    return channel.send(buildVerificationPanel(cfg));
}

/** Deletes the posted panel if it still exists. */
export async function deleteVerificationPanel(guild: Guild, cfg: VerificationConfig): Promise<void> {
    if (!cfg.channelId || !cfg.messageId) return;
    const channel = guild.channels.cache.get(cfg.channelId) as TextChannel | undefined;
    if (!channel) return;
    const msg = await channel.messages.fetch(cfg.messageId).catch(() => null);
    if (msg) await msg.delete().catch(() => {});
}
