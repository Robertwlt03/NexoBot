// Reaction role panel message (embed + "reaction_roles" select menu), shared by /reactroles and the web dashboard.

import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js';
import type { APIEmbed, Guild, GuildTextBasedChannel, Message, Role } from 'discord.js';
import { getColor } from '../config/bot.js';
import { logger } from '../utils/logger.js';
import { createError, ErrorTypes } from '../utils/errorHandler.js';
import { getReactionRoleKey } from '../utils/database/keys.js';
import { logEvent, EVENT_TYPES } from './loggingService.js';
import { createReactionRoleMessage, deleteReactionRoleMessage, hasDangerousPermissions } from './reactionRoleService.js';
import type { ReactionRoleMessage } from './reactionRoleService.js';
import type { NexoClient } from '../types/index.js';
import { messageEmbed } from '../utils/embedCard.js';

/** Select-menu panel: `roles` is a list of role ids (the legacy emoji -> role mapping is never edited). */
export type SelectMenuPanel = ReactionRoleMessage & { roles: string[] };

export const MAX_REACTION_ROLE_PANELS = 5;
export const MAX_REACTION_ROLES_PER_PANEL = 25;
const ROLE_FIELD = 'Verfügbare Rollen';

export interface PanelActor {
    id: string;
    tag: string;
}

export function buildReactionRoleSelectRow(roles: Role[]) {
    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('reaction_roles')
            .setPlaceholder('Wähle deine Rollen')
            .setMinValues(0)
            .setMaxValues(roles.length)
            .addOptions(
                roles.map(role => ({
                    label: role.name.substring(0, 100),
                    description: `Rolle ${role.name} hinzufügen/entfernen`.substring(0, 100),
                    value: role.id,
                    emoji: '🎭',
                })),
            ),
    );
}

export function buildReactionRolePanelEmbed(title: string, description: string, roles: Role[]) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(getColor('info'))
        .addFields({ name: ROLE_FIELD, value: roles.map(role => `• ${role}`).join('\n') });
}

/** Why a role cannot be offered in a panel (same texts as the /reactroles dashboard), or null when it is fine. */
export function reactionRoleProblem(guild: Guild, role: Role): string | null {
    if (role.id === guild.id) return 'Du kannst @everyone nicht verwenden.';
    if (role.managed) return 'Verwaltete Rollen und Bot-Rollen können nicht verwendet werden.';
    if (hasDangerousPermissions(role)) {
        return 'Diese Rolle hat sensible Berechtigungen (Administrator, Server verwalten usw.) und kann nicht verwendet werden.';
    }
    if (role.position >= guild.members.me!.roles.highest.position) {
        return 'Diese Rolle steht in der Hierarchie über meiner höchsten Rolle. Verschiebe meine Rolle zuerst darüber.';
    }
    return null;
}

export function panelRoles(guild: Guild, panel: SelectMenuPanel): Role[] {
    return panel.roles.map(id => guild.roles.cache.get(id)).filter((role): role is Role => Boolean(role));
}

export async function fetchPanelMessage(guild: Guild, panel: ReactionRoleMessage): Promise<Message | null> {
    const channel = guild.channels.cache.get(panel.channelId) as GuildTextBasedChannel | undefined;
    if (!channel) return null;
    return channel.messages.fetch(panel.messageId).catch(() => null);
}

/** Posts a new panel and stores it; removes the message again if saving fails. */
export async function postReactionRolePanel(
    client: NexoClient,
    channel: GuildTextBasedChannel,
    content: { title: string; description: string; roles: Role[] },
    actor: PanelActor,
): Promise<Message> {
    const { title, description, roles } = content;
    const panelEmbed = buildReactionRolePanelEmbed(title, description, roles)
        .setFooter({ text: 'Wähle deine Rollen im Dropdown-Menü unten' });

    const message = await channel.send({ embeds: [panelEmbed], components: [buildReactionRoleSelectRow(roles)] });

    try {
        await createReactionRoleMessage(client, channel.guildId, channel.id, message.id, roles.map(role => role.id));
    } catch (saveError) {
        // The panel is already posted but its data failed to persist, so the dropdown
        // would not work. Remove the orphaned message before surfacing the error.
        await message.delete().catch(() => {});
        throw saveError;
    }

    logger.info(`Reaction role message created: ${message.id} with ${roles.length} roles by ${actor.tag}`);

    try {
        await logEvent({
            client,
            guildId: channel.guildId,
            eventType: EVENT_TYPES.REACTION_ROLE_CREATE,
            data: {
                description: `Reaktionsrollen-Panel erstellt von ${actor.tag}`,
                userId: actor.id,
                channelId: channel.id,
                fields: [
                    { name: 'Titel', value: title, inline: false },
                    { name: 'Kanal', value: channel.toString(), inline: true },
                    { name: 'Rollen', value: `${roles.length} Rollen`, inline: true },
                    { name: 'Rollenliste', value: roles.map(r => r.toString()).join(','), inline: false },
                    { name: 'Nachrichtenlink', value: message.url, inline: false },
                ],
            },
        });
    } catch (logError) {
        logger.warn('Failed to log reaction role creation:', logError);
    }

    return message;
}

/** Rewrites the role field and select menu of the posted panel (keeps title/description). */
export async function rebuildLivePanelMessage(guild: Guild, panelData: SelectMenuPanel): Promise<void> {
    try {
        const msg = await fetchPanelMessage(guild, panelData);
        if (!msg || !messageEmbed(msg)) return;

        const roleObjects = panelRoles(guild, panelData);
        if (roleObjects.length === 0) return;

        await msg.edit({ embeds: [withRoleField(EmbedBuilder.from(messageEmbed(msg)!), messageEmbed(msg)!, roleObjects)], components: [buildReactionRoleSelectRow(roleObjects)] });
    } catch (error) {
        logger.warn('Could not rebuild live reaction role panel:', (error as Error).message);
    }
}

/** Sets the title/description of the posted panel and refreshes its role field. */
export async function editPanelText(guild: Guild, panelData: SelectMenuPanel, discordMsg: Message, title: string, description: string): Promise<void> {
    const roleObjects = panelRoles(guild, panelData);
    const updatedEmbed = EmbedBuilder.from(messageEmbed(discordMsg)!).setTitle(title).setDescription(description);
    if (roleObjects.length > 0) withRoleField(updatedEmbed, messageEmbed(discordMsg)!, roleObjects);
    await discordMsg.edit({ embeds: [updatedEmbed] }).catch(() => {});
}

function withRoleField(target: EmbedBuilder, current: Pick<APIEmbed, 'fields'>, roles: Role[]): EmbedBuilder {
    const fields = current.fields?.map(f => ({ name: f.name, value: f.value, inline: f.inline })) || [];
    const roleFieldIdx = fields.findIndex(f => (f.name === ROLE_FIELD || f.name === 'Available Roles'));
    const newRoleValue = roles.map(r => `• ${r}`).join('\n');
    if (roleFieldIdx !== -1) {
        fields[roleFieldIdx] = { name: ROLE_FIELD, value: newRoleValue, inline: false };
    } else {
        fields.push({ name: ROLE_FIELD, value: newRoleValue, inline: false });
    }
    return target.setFields(fields);
}

export async function migrateReactionRoleMessageId(client: NexoClient, guildId: string, panelData: ReactionRoleMessage, newMessageId: string | undefined): Promise<void> {
    if (!newMessageId || panelData.messageId === newMessageId) return;
    const oldKey = getReactionRoleKey(guildId, panelData.messageId);
    panelData.messageId = newMessageId;
    await client.db.set(getReactionRoleKey(guildId, newMessageId), panelData);
    await client.db.delete(oldKey).catch(() => {});
}

export async function repostReactionRolePanel(guild: Guild, panelData: SelectMenuPanel, client: NexoClient, guildId: string, fallbackEmbed: Pick<APIEmbed, 'title' | 'description'> | null | undefined = null): Promise<Message> {
    const channel = (await guild.channels.fetch(panelData.channelId).catch(() => null)) as GuildTextBasedChannel | null;
    if (!channel) {
        throw createError(
            'Panel channel missing',
            ErrorTypes.CONFIGURATION,
            'Der eingestellte Panel-Kanal existiert nicht mehr.',
        );
    }

    const roleObjects = panelRoles(guild, panelData);
    if (roleObjects.length === 0) {
        throw createError(
            'No valid roles',
            ErrorTypes.VALIDATION,
            'Dieses Panel hat keine gültigen Rollen mehr, die erneut gepostet werden können.',
        );
    }

    const title = fallbackEmbed?.title || 'Reaktionsrollen';
    const description = fallbackEmbed?.description || 'Wähle deine Rollen über das Menü unten.';

    const sent = await channel.send({
        embeds: [buildReactionRolePanelEmbed(title, description, roleObjects)],
        components: [buildReactionRoleSelectRow(roleObjects)],
    });
    await migrateReactionRoleMessageId(client, guildId, panelData, sent.id);
    return sent;
}

/** Deletes the panel message and its stored data, then writes the audit log entry. */
export async function deleteReactionRolePanel(
    client: NexoClient,
    guild: Guild,
    panelData: ReactionRoleMessage,
    discordMsg: Message | null,
    title: string,
    actor: PanelActor,
): Promise<void> {
    if (discordMsg) {
        await discordMsg.delete().catch(() => {});
    }
    await deleteReactionRoleMessage(client, guild.id, panelData.messageId);

    const channel = guild.channels.cache.get(panelData.channelId);
    try {
        await logEvent({
            client,
            guildId: guild.id,
            eventType: EVENT_TYPES.REACTION_ROLE_DELETE,
            data: {
                description: `Reaktionsrollen-Panel gelöscht von ${actor.tag}`,
                userId: actor.id,
                channelId: panelData.channelId,
                fields: [
                    { name: 'Panel', value: title, inline: true },
                    { name: 'Kanal', value: channel ? channel.toString() : 'Unbekannt', inline: true },
                ],
            },
        });
    } catch (logErr) {
        logger.warn('Failed to log reaction role deletion:', logErr);
    }
}

/** Removes a role; deleting the last role deletes the whole panel (message + data). Returns true when the panel is gone. */
export async function removeRoleFromPanel(client: NexoClient, guild: Guild, panelData: SelectMenuPanel, roleId: string): Promise<boolean> {
    panelData.roles = panelData.roles.filter(id => id !== roleId);

    if (panelData.roles.length === 0) {
        const msg = await fetchPanelMessage(guild, panelData);
        if (msg) await msg.delete().catch(() => {});
        await deleteReactionRoleMessage(client, guild.id, panelData.messageId);
        return true;
    }

    await client.db.set(getReactionRoleKey(guild.id, panelData.messageId), panelData);
    await rebuildLivePanelMessage(guild, panelData);
    return false;
}

export async function addRoleToPanel(client: NexoClient, guild: Guild, panelData: SelectMenuPanel, roleId: string): Promise<void> {
    panelData.roles.push(roleId);
    await client.db.set(getReactionRoleKey(guild.id, panelData.messageId), panelData);
    await rebuildLivePanelMessage(guild, panelData);
}
