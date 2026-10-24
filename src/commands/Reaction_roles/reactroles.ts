import { getColor } from '../../config/bot.js';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, RoleSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle, MessageFlags, ComponentType, EmbedBuilder, LabelBuilder, CheckboxBuilder, TextDisplayBuilder } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { createError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { hasDangerousPermissions, getAllReactionRoleMessages } from '../../services/reactionRoleService.js';
import {
    addRoleToPanel,
    deleteReactionRolePanel,
    editPanelText,
    fetchPanelMessage,
    migrateReactionRoleMessageId,
    postReactionRolePanel,
    reactionRoleProblem,
    removeRoleFromPanel,
    repostReactionRolePanel,
} from '../../services/reactionRolePanel.js';
import type { SelectMenuPanel } from '../../services/reactionRolePanel.js';
import {
    getReactionRolePanelStatus,
    formatPanelStatusField,
} from '../../utils/panelStatus.js';
import { startDashboardSession } from '../../utils/dashboardSession.js';
import type { AutocompleteInteraction, ButtonInteraction, ChatInputCommandInteraction, Guild, GuildBasedChannel, GuildTextBasedChannel, Message, Role, StringSelectMenuInteraction } from 'discord.js';
import type { ReactionRoleMessage } from '../../services/reactionRoleService.js';
import type { PanelStatus } from '../../utils/panelStatus.js';
import type { Command, NexoClient } from '../../types/index.js';
import { messageEmbed, messageTitle } from '../../utils/embedCard.js';

/**
 * Panels managed by this command are select-menu panels (see SelectMenuPanel).
 * Panel channels are looked up from stored ids and are assumed to be guild text channels, as the JS did.
 */

const DASHBOARD_EPHEMERAL = MessageFlags.Ephemeral;

export default {
    data: new SlashCommandBuilder()
        .setName('reactroles')
        .setDescription('Reaktionsrollen verwalten')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Neues Reaktionsrollen-Panel einrichten')
                .addChannelOption(option => 
                    option.setName('channel')
                        .setDescription('Kanal, in den das Reaktionsrollen-Panel gesendet wird')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('Titel des Reaktionsrollen-Panels')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Beschreibung des Reaktionsrollen-Panels')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option.setName('role1')
                        .setDescription('Erste Rolle')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option.setName('role2')
                        .setDescription('Zweite Rolle')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('role3')
                        .setDescription('Dritte Rolle')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('role4')
                        .setDescription('Vierte Rolle')
                        .setRequired(false)
                )
                .addRoleOption(option =>
                    option.setName('role5')
                        .setDescription('Fünfte Rolle')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('dashboard')
                .setDescription('Deine Reaktionsrollen-Panels verwalten und konfigurieren')
                .addStringOption(option =>
                    option
                        .setName('panel')
                        .setDescription('Reaktionsrollen-Panel zum Verwalten auswählen')
                        .setRequired(false)
                        .setAutocomplete(true)
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            await handleSetup(interaction);
        } else if (subcommand === 'dashboard') {
            const selectedPanelId = interaction.options.getString('panel');
            await handleDashboard(interaction, selectedPanelId);
        }
    },

    async autocomplete(interaction: AutocompleteInteraction) {
        if (interaction.commandName !== 'reactroles') return;
        if (interaction.options.getSubcommand() !== 'dashboard') return;

        // Autocomplete must respond within 3s. Build choices from stored panel data and
        // cached channels/messages only — no network fetches — to avoid DiscordAPIError 10062.
        try {
            const guildId = interaction.guild!.id;
            const client = interaction.client;
            const guild = interaction.guild!;

            let panels: ReactionRoleMessage[];
            try {
                panels = await getAllReactionRoleMessages(client, guildId);
            } catch {
                await interaction.respond([]).catch(() => {});
                return;
            }

            if (!panels?.length) {
                await interaction.respond([]).catch(() => {});
                return;
            }

            const choices: { name: string; value: string }[] = [];
            for (const panel of panels) {
                if (!panel.messageId || !panel.channelId) continue;

                const channel = guild.channels.cache.get(panel.channelId) as GuildTextBasedChannel | undefined;
                if (!channel) continue;

                const cachedTitle = messageTitle(channel.messages?.cache?.get(panel.messageId));
                const roleCount = Array.isArray(panel.roles) ? panel.roles.length : 0;
                const label = cachedTitle
                    ? `${cachedTitle} (#${channel.name})`
                    : `#${channel.name} · ${roleCount} Rolle${roleCount === 1 ? '' : 'n'}`;

                choices.push({ name: label.substring(0, 100), value: panel.messageId });
                if (choices.length >= 25) break;
            }

            await interaction.respond(choices).catch(() => {});
        } catch {
            await interaction.respond([]).catch(() => {});
        }
    }
} satisfies Command;

async function handleSetup(interaction: ChatInputCommandInteraction) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction);
    if (!deferSuccess) return;
    
    logger.info(`Reaction role setup initiated by ${interaction.user.tag} in guild ${interaction.guild!.name}`);
    
    const channel = interaction.options.getChannel('channel') as GuildBasedChannel;
    const title = interaction.options.getString('title')!;
    const description = interaction.options.getString('description')!;

    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
        throw createError(
            `Invalid channel type: ${channel.type}`,
            ErrorTypes.VALIDATION,
            'Bitte wähle einen Text- oder Ankündigungskanal.',
            { channelType: channel.type }
        );
    }

    if (!interaction.guild!.members.me!.permissions.has(PermissionFlagsBits.ManageRoles)) {
        throw createError(
            'Bot missing ManageRoles permission',
            ErrorTypes.PERMISSION,
            'Ich brauche die Berechtigung „Rollen verwalten“, um Reaktionsrollen einzurichten.',
            { permission: 'ManageRoles' }
        );
    }
    
    if (!channel.permissionsFor(interaction.guild!.members.me!).has(PermissionFlagsBits.SendMessages)) {
        throw createError(
            `Bot cannot send messages in ${channel.name}`,
            ErrorTypes.PERMISSION,
            `Ich habe keine Berechtigung, Nachrichten in ${channel} zu senden.`,
            { channelId: channel.id }
        );
    }

    const existingPanels = await getAllReactionRoleMessages(interaction.client, interaction.guildId!);
    if (existingPanels && existingPanels.length >= 5) {
        throw createError(
            'Panel limit reached',
            ErrorTypes.VALIDATION,
            'Dein Server hat das Maximum von 5 Reaktionsrollen-Panels erreicht. Lösche ein bestehendes Panel, um ein neues zu erstellen.',
            { maxPanels: 5, currentPanels: existingPanels.length }
        );
    }

    const roles: Role[] = [];
    const roleValidationErrors: string[] = [];
    const seenRoleIds = new Set<string>();
    
    for (let i = 1; i <= 5; i++) {
        // Guild-only command: resolved roles are cached Role objects.
        const role = interaction.options.getRole(`role${i}`) as Role | null;
        if (role) {
            if (seenRoleIds.has(role.id)) {
                roleValidationErrors.push(`**${role.name}** - Diese Rolle wurde mehrfach ausgewählt`);
                continue;
            }

            if (role.position >= interaction.guild!.members.me!.roles.highest.position) {
                roleValidationErrors.push(`**${role.name}** - Meine Rolle steht in der Rollenhierarchie unter dieser Rolle, daher kann ich sie nicht vergeben`);
                continue;
            }
            
            if (hasDangerousPermissions(role)) {
                roleValidationErrors.push(`**${role.name}** - Diese Rolle hat gefährliche Berechtigungen (Administrator, Server verwalten usw.)`);
                continue;
            }
            
            if (role.managed) {
                roleValidationErrors.push(`**${role.name}** - Das ist eine verwaltete Rolle (Integrations-/Bot-Rolle)`);
                continue;
            }
            
            if (role.id === interaction.guild!.id) {
                roleValidationErrors.push(`**${role.name}** - Die @everyone-Rolle kann nicht verwendet werden`);
                continue;
            }
            
            seenRoleIds.add(role.id);
            roles.push(role);
        }
    }
    
    if (roleValidationErrors.length > 0) {
        const errorMsg = `Folgende Rollen können nicht hinzugefügt werden:\n${roleValidationErrors.join('\n')}`;
        
        if (roles.length === 0) {
            throw createError(
                'No valid roles provided',
                ErrorTypes.VALIDATION,
                errorMsg,
                { errors: roleValidationErrors }
            );
        }
        
        await interaction.followUp({
            embeds: [warningEmbed('Warnung zur Rollenprüfung', errorMsg)],
            flags: MessageFlags.Ephemeral
        });
    }

    if (roles.length < 1) {
        throw createError(
            'No roles provided',
            ErrorTypes.VALIDATION,
            'Du musst mindestens eine gültige Rolle angeben.',
            {}
        );
    }

    const message = await postReactionRolePanel(
        interaction.client,
        channel as GuildTextBasedChannel,
        { title, description, roles },
        { id: interaction.user.id, tag: interaction.user.tag },
    );

    await InteractionHelper.safeEditReply(interaction, {
        embeds: [successEmbed('Erfolg', `✅ Reaktionsrollen-Panel in ${channel} erstellt!\n\n${message.url}`)]
    });
}

async function showPanelDashboard(
    interaction: ChatInputCommandInteraction,
    panelData: SelectMenuPanel,
    discordMsg: Message | null | undefined,
    guildId: string,
    guild: Guild,
    client: NexoClient,
    panelStatus: PanelStatus | null = null,
) {
    if (!panelStatus && client) {
        panelStatus = await getReactionRolePanelStatus(client, guild, panelData);
        if (panelStatus.recoveredId) {
            await migrateReactionRoleMessageId(client, guildId, panelData, panelStatus.recoveredId);
            discordMsg = panelStatus.message || discordMsg;
        }
    }

    const payload = buildReactionRoleDashboardPayload(panelData, discordMsg, guildId, guild, panelStatus);
    await InteractionHelper.safeEditReply(interaction, { ...payload, flags: DASHBOARD_EPHEMERAL });
}

function buildReactionRoleDashboardPayload(
    panelData: SelectMenuPanel,
    discordMsg: Message | null | undefined,
    guildId: string,
    guild: Guild,
    panelStatus: PanelStatus | null = null,
) {
    const channel = guild.channels.cache.get(panelData.channelId) as GuildTextBasedChannel | undefined;
    const title = messageTitle(discordMsg) ?? 'Panel ohne Titel';
    const roleList =
        panelData.roles.length > 0
            ? panelData.roles.map(id => `<@&${id}>`).join(',')
            : '`Keine`';

    const showRepost = panelStatus?.exists === false && panelStatus?.reason === 'panel_deleted';

    const embed = new EmbedBuilder()
        .setTitle('Reaktionsrollen-Dashboard')
        .setDescription(
            `**Titel:** ${title}\n\nWähle unten eine Option, um eine Einstellung zu ändern.${discordMsg ? `\n[Hier klicken, um das Panel anzusehen](${discordMsg.url})` : ''}`,
        )
        .setColor(getColor('info'))
        .addFields(
            { name: 'Panel-Status', value: formatPanelStatusField(panelStatus), inline: false },
            { name: 'Kanal', value: channel ? `<#${channel.id}>` : '`Nicht gefunden`', inline: true },
            { name: 'Rollen', value: `\`${panelData.roles.length} / 25\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Rollenliste', value: roleList, inline: false },
        )
        .setFooter({ text: 'Das Dashboard schließt sich nach 10 Minuten Inaktivität' })
        .setTimestamp();

    const buttons: ButtonBuilder[] = [];

    if (showRepost) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`rr_repost_${guildId}`)
                .setLabel('Panel erneut posten')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('📌'),
        );
    }

    buttons.push(
        new ButtonBuilder()
            .setCustomId(`rr_edit_text_${guildId}`)
            .setLabel('Panel-Text bearbeiten')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId(`rr_delete_${guildId}`)
            .setLabel('Panel löschen')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
    );

    const optionsSelect = new StringSelectMenuBuilder()
        .setCustomId(`rr_opts_${guildId}`)
        .setPlaceholder('Wähle eine Aktion...')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('Rolle hinzufügen')
                .setDescription('Rolle zu diesem Panel hinzufügen (max. 25)')
                .setValue('add_role')
                .setEmoji('➕'),
            ...(panelData.roles.length > 0
                ? [
                      new StringSelectMenuOptionBuilder()
                          .setLabel('Rolle entfernen')
                          .setDescription('Rolle aus diesem Panel entfernen')
                          .setValue('remove_role')
                          .setEmoji('➖'),
                  ]
                : []),
        );

    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(buttons),
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(optionsSelect),
        ],
    };
}

async function handleDashboard(interaction: ChatInputCommandInteraction, selectedPanelId: string | null) {
    const deferSuccess = await InteractionHelper.safeDefer(interaction, { flags: DASHBOARD_EPHEMERAL });
    if (!deferSuccess) return;

    const client = interaction.client;
    const guildId = interaction.guild!.id;
    const guild = interaction.guild!;

    const panels = await getAllReactionRoleMessages(client, guildId);
    if (!panels?.length) {
        throw createError(
            'No panels',
            ErrorTypes.CONFIGURATION,
            'Keine Reaktionsrollen-Panels gefunden. Nutze zuerst `/reactroles setup`.',
        );
    }

    // See SelectMenuPanel: the dashboard edits select-menu panels whose roles are a list.
    let panelData = (selectedPanelId ? panels.find(p => p.messageId === selectedPanelId) : null) as SelectMenuPanel | null | undefined;
    if (!panelData) {
        if (panels.length === 1) {
            panelData = panels[0] as SelectMenuPanel;
        } else {
            throw createError(
                'Panel required',
                ErrorTypes.VALIDATION,
                'Es gibt mehrere Panels. Wähle eins über die Option **panel**.',
            );
        }
    }

    let panelStatus = await getReactionRolePanelStatus(client, guild, panelData);
    if (panelStatus.recoveredId) {
        await migrateReactionRoleMessageId(client, guildId, panelData, panelStatus.recoveredId);
        panelStatus = await getReactionRolePanelStatus(client, guild, panelData);
    }

    const discordMsg = panelStatus.message || (await fetchPanelMessage(guild, panelData));
    const payload = buildReactionRoleDashboardPayload(panelData, discordMsg, guildId, guild, panelStatus);

    await startDashboardSession({
        interaction,
        ...payload,
        flags: DASHBOARD_EPHEMERAL,
        selectMenuId: `rr_opts_${guildId}`,
        buttonMatcher: (customId: string) =>
            customId === `rr_edit_text_${guildId}` ||
            customId === `rr_delete_${guildId}` ||
            customId === `rr_repost_${guildId}`,
        onSelect: async (selectInteraction) => {
            const selectedOption = selectInteraction.values[0];
            if (selectedOption === 'add_role') {
                await handleAddRole(selectInteraction, interaction, panelData, guildId, guild, client);
            } else if (selectedOption === 'remove_role') {
                await handleRemoveRole(selectInteraction, interaction, panelData, panels, guildId, guild, client);
            }
        },
        onButton: async (btnInteraction) => {
            if (btnInteraction.customId === `rr_repost_${guildId}`) {
                await btnInteraction.deferUpdate();
                const fallbackEmbed = messageEmbed(discordMsg);
                const newMsg = await repostReactionRolePanel(
                    guild,
                    panelData,
                    client,
                    guildId,
                    fallbackEmbed,
                );
                await btnInteraction.followUp({
                    embeds: [successEmbed('Panel erneut gepostet', `Reaktionsrollen-Panel in ${newMsg.channel} wiederhergestellt.`)],
                    flags: MessageFlags.Ephemeral,
                });
                await showPanelDashboard(
                    interaction,
                    panelData,
                    newMsg,
                    guildId,
                    guild,
                    client,
                    { exists: true, message: newMsg },
                );
                return;
            }

            if (btnInteraction.customId === `rr_edit_text_${guildId}`) {
                await handleEditText(btnInteraction, interaction, panelData, guildId, guild, client);
                return;
            }

            if (btnInteraction.customId === `rr_delete_${guildId}`) {
                await handleDeletePanel(btnInteraction, interaction, panelData, panels, guildId, guild, client);
            }
        },
    });
}

async function handleEditText(buttonInteraction: ButtonInteraction, rootInteraction: ChatInputCommandInteraction, panelData: SelectMenuPanel, guildId: string, guild: Guild, client: NexoClient) {
    const channel = guild.channels.cache.get(panelData.channelId) as GuildTextBasedChannel | undefined;
    const discordMsg = channel
        ? await channel.messages.fetch(panelData.messageId).catch(() => null)
        : null;

    const currentTitle = messageTitle(discordMsg) ?? '';
    const currentDesc = messageEmbed(discordMsg)?.description ?? '';

    const modal = new ModalBuilder()
        .setCustomId('rr_edit_text')
        .setTitle('Panel-Text bearbeiten')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('panel_title')
                    .setLabel('Titel')
                    .setStyle(TextInputStyle.Short)
                    .setValue(currentTitle)
                    .setMaxLength(256)
                    .setMinLength(1)
                    .setRequired(true),
            ),
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('panel_description')
                    .setLabel('Beschreibung')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(currentDesc)
                    .setMaxLength(2048)
                    .setMinLength(1)
                    .setRequired(true),
            ),
        );

    try {
        await buttonInteraction.showModal(modal);
    } catch (error) {
        logger.error('Error showing edit text modal:', error);
        await replyUserError(buttonInteraction, {
            type: ErrorTypes.UNKNOWN,
            message: 'Das Formular zum Bearbeiten konnte nicht geöffnet werden. Bitte versuche es erneut.',
        }).catch(() => {});
        return;
    }

    const submitted = await buttonInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'rr_edit_text' && i.user.id === buttonInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) return;

    const newTitle = submitted.fields.getTextInputValue('panel_title').trim();
    const newDescription = submitted.fields.getTextInputValue('panel_description').trim();

    if (discordMsg) {
        await editPanelText(guild, panelData, discordMsg, newTitle, newDescription);
    }

    await submitted.reply({
        embeds: [successEmbed('Panel aktualisiert', 'Titel und Beschreibung wurden aktualisiert.')],
        flags: MessageFlags.Ephemeral,
    });

    const refreshedMsg = channel
        ? await channel.messages.fetch(panelData.messageId).catch(() => null)
        : null;
    await showPanelDashboard(rootInteraction, panelData, refreshedMsg, guildId, guild, client);
}

async function handleAddRole(selectInteraction: StringSelectMenuInteraction, rootInteraction: ChatInputCommandInteraction, panelData: SelectMenuPanel, guildId: string, guild: Guild, client: NexoClient) {
    await selectInteraction.deferUpdate();

    if (panelData.roles.length >= 25) {
        await replyUserError(selectInteraction, {
            type: ErrorTypes.VALIDATION,
            message: 'Dieses Panel hat bereits das Maximum von 25 Rollen.',
        });
        return;
    }

    const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('rr_add_role_pick')
        .setPlaceholder('Wähle eine Rolle zum Hinzufügen...')
        .setMaxValues(1);

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Rolle hinzufügen')
                .setDescription(
                    `**Aktuelle Rollen:** ${panelData.roles.length}/25\n\nWähle eine Rolle, die zu diesem Panel hinzugefügt werden soll.`,
                )
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const roleCollector = (rootInteraction.channel as GuildTextBasedChannel).createMessageComponentCollector({
        componentType: ComponentType.RoleSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'rr_add_role_pick',
        time: 60_000,
        max: 1,
    });

    roleCollector.on('collect', async roleInteraction => {
        await roleInteraction.deferUpdate();
        const role = roleInteraction.roles.first() as Role;

        if (panelData.roles.includes(role.id)) {
            await replyUserError(roleInteraction, {
                type: ErrorTypes.VALIDATION,
                message: `${role} ist bereits in diesem Panel.`,
            });
            return;
        }
        const problem = reactionRoleProblem(guild, role);
        if (problem) {
            await replyUserError(roleInteraction, {
                type: role.id === guild.id || role.managed ? ErrorTypes.VALIDATION : ErrorTypes.PERMISSION,
                message: problem,
            });
            return;
        }

        await addRoleToPanel(client, guild, panelData, role.id);

        await roleInteraction.followUp({
            embeds: [successEmbed('Rolle hinzugefügt', `${role} wurde zum Panel hinzugefügt.`)],
            flags: MessageFlags.Ephemeral,
        });

        const channel = guild.channels.cache.get(panelData.channelId) as GuildTextBasedChannel | undefined;
        const discordMsg = channel
            ? await channel.messages.fetch(panelData.messageId).catch(() => null)
            : null;
        await showPanelDashboard(rootInteraction, panelData, discordMsg, guildId, guild, client);
    });

    roleCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'Keine Rolle ausgewählt. Es wurde nichts geändert.',
            }).catch(() => {});
        }
    });
}

async function handleRemoveRole(selectInteraction: StringSelectMenuInteraction, rootInteraction: ChatInputCommandInteraction, panelData: SelectMenuPanel, panels: ReactionRoleMessage[], guildId: string, guild: Guild, client: NexoClient) {
    await selectInteraction.deferUpdate();

    const roleOptions = panelData.roles
        .map(id => {
            const role = guild.roles.cache.get(id);
            return role ? { label: role.name.substring(0, 100), value: id } : null;
        })
        .filter((option): option is { label: string; value: string } => Boolean(option));

    if (roleOptions.length === 0) {
        await replyUserError(selectInteraction, {
            type: ErrorTypes.USER_INPUT,
            message: 'Die Rollen dieses Panels existieren auf dem Server nicht mehr.',
        });
        return;
    }

    const removeSelect = new StringSelectMenuBuilder()
        .setCustomId('rr_remove_role_pick')
        .setPlaceholder('Wähle eine Rolle zum Entfernen...')
        .setMaxValues(1)
        .addOptions(
            roleOptions.map(r =>
                new StringSelectMenuOptionBuilder().setLabel(r.label).setValue(r.value).setEmoji('🎭'),
            ),
        );

    await selectInteraction.followUp({
        embeds: [
            new EmbedBuilder()
                .setTitle('Rolle entfernen')
                .setDescription('Wähle die Rolle, die du aus diesem Panel entfernen willst.')
                .setColor(getColor('info')),
        ],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(removeSelect)],
        flags: MessageFlags.Ephemeral,
    });

    const removeCollector = (rootInteraction.channel as GuildTextBasedChannel).createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i =>
            i.user.id === selectInteraction.user.id && i.customId === 'rr_remove_role_pick',
        time: 60_000,
        max: 1,
    });

    removeCollector.on('collect', async removeInteraction => {
        await removeInteraction.deferUpdate();
        const roleId = removeInteraction.values[0];
        const role = guild.roles.cache.get(roleId);

        const panelDeleted = await removeRoleFromPanel(client, guild, panelData, roleId);

        if (panelDeleted) {

            await removeInteraction.followUp({
                embeds: [
                    successEmbed(
                        '✅ Rolle entfernt',
                        'Das war die letzte Rolle im Panel. Das Panel wurde gelöscht.',
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

            const panelIndex = panels.findIndex(p => p.messageId === panelData.messageId);
            if (panelIndex > -1) {
                panels.splice(panelIndex, 1);
            }

            if (panels.length === 0) {
                await InteractionHelper.safeEditReply(rootInteraction, {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Reaktionsrollen-Dashboard')
                            .setDescription('Keine Panels mehr vorhanden. Nutze `/reactroles setup`, um eins zu erstellen.')
                            .setColor(getColor('info')),
                    ],
                    components: [],
                    flags: DASHBOARD_EPHEMERAL,
                });
            } else {
                
                await InteractionHelper.safeEditReply(rootInteraction, {
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Reaktionsrollen-Dashboard')
                            .setDescription('Panel gelöscht. Führe `/reactroles dashboard` aus, um ein anderes Panel zu verwalten.')
                            .setColor(getColor('success')),
                    ],
                    components: [],
                    flags: DASHBOARD_EPHEMERAL,
                });
            }
        } else {

            await removeInteraction.followUp({
                embeds: [
                    successEmbed(
                        '✅ Rolle entfernt',
                        `${role ? role.toString() :`<@&${roleId}>`} wurde aus dem Panel entfernt.`,
                    ),
                ],
                flags: MessageFlags.Ephemeral,
            });

            const channel = guild.channels.cache.get(panelData.channelId) as GuildTextBasedChannel | undefined;
            const discordMsg = channel
                ? await channel.messages.fetch(panelData.messageId).catch(() => null)
                : null;
            await showPanelDashboard(rootInteraction, panelData, discordMsg, guildId, guild, client);
        }
    });

    removeCollector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            replyUserError(selectInteraction, {
                type: ErrorTypes.RATE_LIMIT,
                message: 'Keine Rolle ausgewählt. Es wurde nichts geändert.',
            }).catch(() => {});
        }
    });
}

async function handleDeletePanel(btnInteraction: ButtonInteraction, rootInteraction: ChatInputCommandInteraction, panelData: SelectMenuPanel, panels: ReactionRoleMessage[], guildId: string, guild: Guild, client: NexoClient) {
    const channel = guild.channels.cache.get(panelData.channelId) as GuildTextBasedChannel | undefined;
    const discordMsg = channel
        ? await channel.messages.fetch(panelData.messageId).catch(() => null)
        : null;
    const title = messageTitle(discordMsg) ?? 'dieses Panel';

    const deleteModal = new ModalBuilder()
        .setCustomId('rr_delete_confirm_modal')
        .setTitle('Reaktionsrollen-Panel löschen');

    const deleteWarningText = new TextDisplayBuilder()
        .setContent(`⚠️ Du bist dabei, das Panel **${title}** dauerhaft zu löschen. Dabei werden die Discord-Nachricht und alle zugehörigen Reaktionsrollen-Zuweisungen entfernt.`);

    const deleteCheckbox = new CheckboxBuilder()
        .setCustomId('delete_confirmation')
        .setDefault(false);

    const deleteCheckboxLabel = new LabelBuilder()
        .setLabel('Ich bestätige – das ist endgültig')
        .setCheckboxComponent(deleteCheckbox);

    deleteModal
        .addTextDisplayComponents(deleteWarningText)
        .addLabelComponents(deleteCheckboxLabel);

    await btnInteraction.showModal(deleteModal);

    const submitted = await btnInteraction
        .awaitModalSubmit({
            filter: i => i.customId === 'rr_delete_confirm_modal' && i.user.id === btnInteraction.user.id,
            time: 120_000,
        })
        .catch(() => null);

    if (!submitted) {
        await showPanelDashboard(rootInteraction, panelData, discordMsg, guildId, guild, client);
        return;
    }

    const confirmed = submitted.fields.getCheckbox('delete_confirmation');

    if (!confirmed) {
        await replyUserError(submitted, { type: ErrorTypes.VALIDATION, message: 'Du musst das Bestätigungskästchen anhaken, um das Panel zu löschen.' });
        await showPanelDashboard(rootInteraction, panelData, discordMsg, guildId, guild, client);
        return;
    }

    await submitted.deferUpdate();

    await deleteReactionRolePanel(client, guild, panelData, discordMsg, title, { id: submitted.user.id, tag: submitted.user.tag });

    await submitted.followUp({
        embeds: [successEmbed('Panel gelöscht', `**${title}** wurde gelöscht.`)],
        flags: MessageFlags.Ephemeral,
    });

    const panelIndex = panels.findIndex(p => p.messageId === panelData.messageId);
    if (panelIndex > -1) {
        panels.splice(panelIndex, 1);
    }

    if (panels.length === 0) {
        await InteractionHelper.safeEditReply(rootInteraction, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Reaktionsrollen-Dashboard')
                    .setDescription('Keine Panels mehr vorhanden. Nutze `/reactroles setup`, um eins zu erstellen.')
                    .setColor(getColor('info')),
            ],
            components: [],
            flags: DASHBOARD_EPHEMERAL,
        });
    } else {
        await InteractionHelper.safeEditReply(rootInteraction, {
            embeds: [
                new EmbedBuilder()
                    .setTitle('Reaktionsrollen-Dashboard')
                    .setDescription('Panel gelöscht. Führe `/reactroles dashboard` aus, um ein anderes Panel zu verwalten.')
                    .setColor(getColor('success')),
            ],
            components: [],
            flags: DASHBOARD_EPHEMERAL,
        });
    }
}