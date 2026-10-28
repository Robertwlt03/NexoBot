// Welcome/goodbye placeholders and sending the greeting messages.

import { AttachmentBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { ColorResolvable, GuildMember, PartialGuildMember } from 'discord.js';
import { logger } from './logger.js';
import { botConfig, getColor } from '../config/bot.js';
import type { WelcomeConfig } from './database.js';
import type { WelcomeCard } from '../shared/welcomeCard.js';
import { applyMemberStyle, cardSubjectFromMember, renderWelcomeCard } from '../services/welcomeCardRenderer.js';
import { getProfileSettings, getResolvedCosmetics } from '../services/cosmetics/store.js';

/** Fields read from a (possibly partial) discord.js User. */
interface WelcomeFormatUser {
    toString?(): string;
    tag?: string | null;
    username?: string | null;
    discriminator?: string | null;
    id?: string;
}

/** Fields read from a discord.js Guild. */
interface WelcomeFormatGuild {
    name?: string;
    id?: string;
    memberCount?: number;
}

export interface WelcomeFormatData {
    user?: WelcomeFormatUser | null;
    guild?: WelcomeFormatGuild | null;
    [key: string]: unknown;
}

function replaceAll(message: string, token: string, value: unknown): string {
    if (value === undefined || value === null) {
        return message;
    }
    return message.split(token).join(String(value));
}

export function truncateForEmbedField(value: unknown, maxLength = 1024): string {
    const text = String(value ?? '').trim();
    if (!text) {
        return '—';
    }
    return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function formatWelcomeMessage(message: unknown, data: WelcomeFormatData | null | undefined): string {
    
    if (typeof message !== 'string') return '';
    if (!message) return '';
    if (!data || typeof data !== 'object') return message;

    const user = data?.user;
    const guild = data?.guild;

    if (!user || typeof user !== 'object') {
        logger.warn('Invalid user object passed to formatWelcomeMessage');
    }
    if (!guild || typeof guild !== 'object') {
        logger.warn('Invalid guild object passed to formatWelcomeMessage');
    }

    const tokens: Record<string, string> = {
        '{user}': user?.toString?.() || 'Nutzer',
        '{user.mention}': user?.toString?.() || 'Nutzer',
        '{user.tag}': user?.tag || 'Unbekannt#0000',
        '{user.username}': user?.username || 'Unbekannt',
        '{username}': user?.username || 'Unbekannt',
        '{user.discriminator}': user?.discriminator || '0000',
        '{user.id}': user?.id || 'unknown',
        '{server}': guild?.name || 'Server',
        '{server.name}': guild?.name || 'Server',
        '{guild.name}': guild?.name || 'Server',
        '{guild.id}': guild?.id || 'unknown',
        '{guild.memberCount}': guild?.memberCount?.toString?.() || '0',
        '{memberCount}': guild?.memberCount?.toString?.() || '0',
        '{membercount}': guild?.memberCount?.toString?.() || '0'
    };

    let result = message;
    for (const [token, value] of Object.entries(tokens)) {
        if (value === undefined || value === null) continue;
        result = replaceAll(result, token, String(value));
    }

    return result;
}


// ---------- Sending the welcome / goodbye message ----------

export type GreetingKind = 'welcome' | 'goodbye';
export type GreetingResult =
    | { status: 'sent'; url: string }
    | { status: 'no_channel' }
    | { status: 'no_permission' };

/** Renders the configured image card; null when off, not allowed or failing (caller falls back to the static image). */
async function renderCardAttachment(card: WelcomeCard | undefined, member: GuildMember | PartialGuildMember, name: string, memberStyle: boolean): Promise<AttachmentBuilder | null> {
    if (!card?.enabled) return null;
    try {
        if (memberStyle && (await getProfileSettings(member.id)).showOnWelcome) {
            const cosmetics = await getResolvedCosmetics(member.id);
            card = applyMemberStyle(card, cosmetics.frame, cosmetics.accent);
        }
        const png = await renderWelcomeCard(card, cardSubjectFromMember(member));
        return new AttachmentBuilder(png, { name });
    } catch (error) {
        logger.warn(`Welcome card render failed in guild ${member.guild.id}:`, error);
        return null;
    }
}

/**
 * Sends the welcome (join) or goodbye (leave) message of the guild's welcome config for `member`
 * into the configured channel. Used by the member events and the dashboard test button.
 */
export async function sendGreeting(kind: GreetingKind, member: GuildMember | PartialGuildMember, config: WelcomeConfig): Promise<GreetingResult> {
    const { guild, user } = member;
    const isWelcome = kind === 'welcome';
    const channelId = isWelcome ? config.channelId : config.goodbyeChannelId;
    const channel = channelId ? guild.channels.cache.get(channelId) : undefined;
    if (!channel?.isTextBased?.()) return { status: 'no_channel' };
    const me = guild.members.me;
    const permissions = me ? channel.permissionsFor(me) : null;
    if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) return { status: 'no_permission' };

    const formatData = { user, guild, member };
    const embedConfig = isWelcome ? config.welcomeEmbed : config.leaveEmbed;
    const message = formatWelcomeMessage(
        (isWelcome ? config.welcomeMessage : config.leaveMessage) || embedConfig?.description
            || (isWelcome ? botConfig.welcome?.defaultWelcomeMessage : botConfig.welcome?.defaultGoodbyeMessage)
            || (isWelcome ? 'Willkommen {user} auf {server}!' : '{user} hat den Server verlassen.'),
        formatData
    );
    const title = formatWelcomeMessage(embedConfig?.title || (isWelcome ? '🎉 Willkommen!' : '👋 Auf Wiedersehen'), formatData);
    const footer = embedConfig?.footer
        ? formatWelcomeMessage(embedConfig.footer, formatData)
        : isWelcome ? `Willkommen auf ${guild.name}!` : `Tschüss von ${guild.name}!`;
    const ping = isWelcome ? config.welcomePing : config.goodbyePing;
    // Goodbye restricts mentions to the member; welcome keeps Discord's default.
    const allowedMentions = isWelcome ? undefined : ping ? { users: [user.id] } : { parse: [] };

    if (!permissions.has(PermissionFlagsBits.EmbedLinks)) {
        const sent = await channel.send({
            content: isWelcome ? (ping ? user.toString() : message) : ping ? `<@${user.id}> ${message}` : message,
            allowedMentions,
        });
        return { status: 'sent', url: sent.url };
    }

    const embed = new EmbedBuilder()
        .setColor((embedConfig?.color || getColor(isWelcome ? 'success' : 'error')) as ColorResolvable)
        .setTitle(title)
        .setDescription(message)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
            { name: 'Nutzer', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'Mitglieder', value: guild.memberCount.toString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: footer });

    const fileName = isWelcome ? 'welcome.png' : 'goodbye.png';
    const attachment = permissions.has(PermissionFlagsBits.AttachFiles)
        ? await renderCardAttachment(isWelcome ? config.welcomeCard : config.goodbyeCard, member, fileName,
            (isWelcome ? config.welcomeMemberStyle : config.goodbyeMemberStyle) === true)
        : null;
    if (attachment) {
        embed.setImage(`attachment://${fileName}`);
    } else {
        // Stored embed config may carry an image string or object (not part of WelcomeEmbedConfig).
        const stored = embedConfig?.image as string | { url?: string } | undefined;
        const image = (isWelcome ? config.welcomeImage : null) || (typeof stored === 'string' ? stored : stored?.url);
        if (image) embed.setImage(image);
    }

    const sent = await channel.send({
        content: ping ? (isWelcome ? user.toString() : `<@${user.id}>`) : undefined,
        allowedMentions,
        embeds: [embed],
        files: attachment ? [attachment] : [],
    });
    return { status: 'sent', url: sent.url };
}
