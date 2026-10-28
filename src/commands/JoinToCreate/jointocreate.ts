import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType, ComponentType } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { NexoBotError, ErrorTypes, replyUserError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import {
    createJoinToCreateTrigger, getTriggerSettings, removeJoinToCreateTrigger, updateTriggerSettings,
} from '../../services/jointocreate/jointocreate.js';
import {
    TEMPLATE_CHOICES, bitrateModal, bitrateUpdatedEmbed, dashboard, nameTemplateModal, removeCancelledEmbed, removeConfirmation,
    removedEmbed, setupDoneEmbed, templateUpdatedEmbed, userLimitModal, userLimitUpdatedEmbed,
} from '../../services/jointocreate/views.js';
import type { ButtonInteraction, CategoryChannel, ChatInputCommandInteraction, EmbedBuilder, GuildMember, ModalBuilder, ModalSubmitInteraction, VoiceChannel } from 'discord.js';
import type { Command, NexoClient } from '../../types/index.js';

const canManage = (member: unknown) => Boolean((member as GuildMember | null)?.permissions?.has(PermissionFlagsBits.ManageGuild));
const NO_PERMISSION = '❌ Du brauchst die Berechtigung **Server verwalten**, um diese Einstellungen zu ändern.';

export default {
    data: new SlashCommandBuilder()
        .setName("jointocreate")
        .setDescription("Join-to-Create-Sprachkanäle verwalten.")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setup")
                .setDescription("Neuen Join-to-Create-Sprachkanal einrichten.")
                .addChannelOption((option) =>
                    option
                        .setName("category")
                        .setDescription("Kategorie, in der der Kanal erstellt wird.")
                        .addChannelTypes(ChannelType.GuildCategory)
                )
                .addStringOption((option) =>
                    option
                        .setName("channel_name")
                        .setDescription("Vorlage für die Namen temporärer Sprachkanäle.")
                        .addChoices(...TEMPLATE_CHOICES.map((value) => ({ name: value, value })))
                )
                .addIntegerOption((option) =>
                    option
                        .setName("user_limit")
                        .setDescription("Maximale Nutzerzahl in temporären Kanälen (0 = unbegrenzt).")
                )
                .addIntegerOption((option) =>
                    option
                        .setName("bitrate")
                        .setDescription("Bitrate temporärer Kanäle in kbps (8-96).")
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dashboard")
                .setDescription("Bestehendes Join-to-Create-System konfigurieren.")
                .addChannelOption((option) =>
                    option
                        .setName("trigger_channel")
                        .setDescription("Der Join-to-Create-Trigger-Kanal, der konfiguriert werden soll.")
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildVoice)
                )
        ),
    category: "utility",

    async execute(interaction, config, client) {
        try {
            
            if (!canManage(interaction.member)) {
                throw new NexoBotError(
                    'User lacks ManageGuild permission',
                    ErrorTypes.PERMISSION,
                    'Du brauchst die Berechtigung **Server verwalten**, um diesen Command zu nutzen.'
                );
            }

            const subcommand = interaction.options.getSubcommand();
            await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral });

            if (subcommand === "setup") {
                await handleSetupSubcommand(interaction, client);
                return;
            } else if (subcommand === "dashboard") {
                await handleConfigSubcommand(interaction, client);
                return;
            }

        } catch (error) {
            try {
                let errorMessage = 'Beim Ausführen dieses Commands ist ein Fehler aufgetreten.';
                
                if (error instanceof NexoBotError) {
                    errorMessage = error.userMessage || 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.';
                    logger.debug(`NexoBotError [${error.type}]: ${(error as Error).message}`, error.context || {});
                } else {
                    logger.error('Unexpected error in jointocreate command:', error);
                    errorMessage = 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut oder wende dich an den Support.';
                }

                return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: errorMessage });
            } catch (replyError) {
                logger.error('Failed to send error message:', replyError);
            }
        }
    }
} satisfies Command;

async function handleSetupSubcommand(interaction: ChatInputCommandInteraction, client: NexoClient) {
    const category = interaction.options.getChannel('category') as CategoryChannel | null;
    const nameTemplate = interaction.options.getString('channel_name') || "Raum von {username}";
    const userLimit = interaction.options.getInteger('user_limit') || 0;
    const bitrate = interaction.options.getInteger('bitrate') || 64;

    try {
        const { channel } = await createJoinToCreateTrigger(client, interaction.guild!, interaction.user.id, {
            categoryId: category?.id, nameTemplate, userLimit, bitrate,
        });
        await InteractionHelper.safeEditReply(interaction, {
            embeds: [setupDoneEmbed(`<#${channel.id}>`, { nameTemplate, userLimit, bitrate }, category?.name ?? null)],
        });
    } catch (error) {
        if (error instanceof NexoBotError) throw error;
        logger.error('Error in handleSetupSubcommand:', error);
        throw new NexoBotError(`Setup failed: ${(error as Error).message}`, ErrorTypes.DISCORD_API,
            'Join-to-Create konnte nicht eingerichtet werden. Bitte prüfe die Berechtigungen des Bots.');
    }
}

/** Shows the modal and waits for its submission by the same member; null when it timed out or was cancelled. */
async function askModal(interaction: ButtonInteraction, modal: ModalBuilder) {
    await interaction.showModal(modal);
    const customId = modal.data.custom_id;
    const submission = await interaction.awaitModalSubmit({
        filter: (i) => i.customId === customId && i.user.id === interaction.user.id,
        time: 60_000,
    }).catch(() => null);
    if (submission && !canManage(submission.member)) {
        await submission.reply({ content: NO_PERMISSION, flags: MessageFlags.Ephemeral });
        return null;
    }
    return submission;
}

async function handleConfigSubcommand(interaction: ChatInputCommandInteraction, client: NexoClient) {
    const triggerChannel = interaction.options.getChannel('trigger_channel') as VoiceChannel;
    const guildId = interaction.guild!.id;
    const mention = `<#${triggerChannel.id}>`;
    const settings = await getTriggerSettings(client, guildId, triggerChannel.id);

    await InteractionHelper.safeEditReply(interaction, dashboard(mention, triggerChannel.id, settings));
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300_000 });

    const update = async (submission: ModalSubmitInteraction, changes: Parameters<typeof updateTriggerSettings>[3], action: string, reply: EmbedBuilder) => {
        try {
            await updateTriggerSettings(client, guildId, triggerChannel.id, changes, interaction.user.id, action);
        } catch (error) {
            // The button is answered by the modal already, so invalid input is answered on the submission.
            if (!(error instanceof NexoBotError)) throw error;
            await submission.reply({ content: `❌ ${error.userMessage}`, flags: MessageFlags.Ephemeral });
            return;
        }
        await submission.reply({ embeds: [reply], flags: MessageFlags.Ephemeral });
    };

    collector.on('collect', async (button) => {
        try {
            if (!canManage(button.member)) {
                await button.reply({ content: '❌ Du brauchst die Berechtigung **Server verwalten**, um diese Steuerung zu nutzen.', flags: MessageFlags.Ephemeral });
                return;
            }
            const current = await getTriggerSettings(client, guildId, triggerChannel.id);
            const action = button.customId.slice('jtc_config_'.length, button.customId.lastIndexOf('_'));

            if (action === 'name') {
                const submission = await askModal(button, nameTemplateModal(triggerChannel.id, current.nameTemplate));
                if (!submission) return;
                const [nameTemplate] = submission.fields.getStringSelectValues('template');
                await update(submission, { nameTemplate }, 'Kanalnamen-Vorlage aktualisiert', templateUpdatedEmbed(nameTemplate));
            } else if (action === 'limit') {
                const submission = await askModal(button, userLimitModal(triggerChannel.id, current.userLimit));
                if (!submission) return;
                const userLimit = Number.parseInt(submission.fields.getTextInputValue('user_limit').trim(), 10);
                await update(submission, { userLimit }, 'Nutzerlimit aktualisiert', userLimitUpdatedEmbed(userLimit));
            } else if (action === 'bitrate') {
                const submission = await askModal(button, bitrateModal(triggerChannel.id, current.bitrate / 1000));
                if (!submission) return;
                const kbps = Number.parseInt(submission.fields.getTextInputValue('bitrate').trim(), 10);
                await update(submission, { bitrate: kbps * 1000 }, 'Bitrate aktualisiert', bitrateUpdatedEmbed(kbps));
            } else if (action === 'delete') {
                await confirmRemoval(button, triggerChannel, client);
            }
        } catch (error) {
            const userMessage = error instanceof NexoBotError ? error.userMessage || 'Ein Fehler ist aufgetreten.' : 'Bei der Verarbeitung deiner Anfrage ist ein Fehler aufgetreten.';
            if (!(error instanceof NexoBotError)) logger.error('Unexpected error in Join to Create dashboard:', error);
            const target = button.replied || button.deferred ? null : button;
            await target?.reply({ content: `❌ ${userMessage}`, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    });

    collector.on('end', async () => {
        const latest = await getTriggerSettings(client, guildId, triggerChannel.id).catch(() => settings);
        message.edit(dashboard(mention, triggerChannel.id, latest, true)).catch(() => {});
    });
}

async function confirmRemoval(interaction: ButtonInteraction, triggerChannel: VoiceChannel, client: NexoClient) {
    await InteractionHelper.safeReply(interaction, { ...removeConfirmation(triggerChannel.name, triggerChannel.id), flags: MessageFlags.Ephemeral });
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id && i.customId.endsWith(`_${triggerChannel.id}`) && i.customId.startsWith('jtc_delete_'),
        time: 600_000,
        max: 1,
    });

    collector.on('collect', async (button) => {
        try {
            if (!canManage(button.member)) {
                await button.reply({ content: '❌ Du brauchst die Berechtigung **Server verwalten**, um Kanäle zu entfernen.', flags: MessageFlags.Ephemeral });
                return;
            }
            if (button.customId === `jtc_delete_confirm_${triggerChannel.id}`) {
                await removeJoinToCreateTrigger(client, interaction.guild!, triggerChannel.id, interaction.user.id);
                await button.update({ embeds: [removedEmbed(triggerChannel.name)], components: [] });
            } else {
                await button.update({ embeds: [removeCancelledEmbed()], components: [] });
            }
        } catch (error) {
            logger.error('Error handling delete confirmation:', error);
            await button.reply({ content: '❌ Bei der Verarbeitung deiner Anfrage ist ein Fehler aufgetreten.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && collected.size === 0) message.edit({ components: [] }).catch(() => {});
    });
}
