// Discord views of Join-to-Create: setup reply, the /jointocreate dashboard with its buttons and modals, replies.

import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, LabelBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { getColor } from '../../config/bot.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import type { JoinToCreateChannelOptions } from './core.js';

export const temporaryChannelFailedMessage = '❌ Dein temporärer Sprachkanal konnte nicht erstellt werden. Bitte wende dich an einen Server-Admin.';

export const TEMPLATE_CHOICES = [
  'Raum von {username}', 'Kanal von {username}', 'Lounge von {username}', 'Bereich von {username}', 'Raum von {displayName}',
  'VC von {username}', 'Musikraum von {username}', 'Gaming-Raum von {username}', 'Chatraum von {username}', 'Privater Raum von {username}',
];

const limitText = (limit: number) => (limit === 0 ? 'Unbegrenzt' : `${limit} Nutzer`);

export function setupDoneEmbed(channelMention: string, settings: { nameTemplate: string; userLimit: number; bitrate: number }, categoryName: string | null) {
  return successEmbed('✅ Einrichtung abgeschlossen',
    `Join-to-Create-Kanal erstellt: ${channelMention}\n\n**Einstellungen:**\n• Vorlage: \`${settings.nameTemplate}\`\n`
    + `• Nutzerlimit: ${limitText(settings.userLimit)}\n• Bitrate: ${settings.bitrate} kbps\n`
    + (categoryName ? `• Kategorie: ${categoryName}` : '• Kategorie: Oberste Ebene'));
}

const DASHBOARD_BUTTONS = [
  ['name', '📝 Namensvorlage', ButtonStyle.Primary],
  ['limit', '👥 Nutzerlimit', ButtonStyle.Primary],
  ['bitrate', '🎵 Bitrate', ButtonStyle.Primary],
  ['delete', '🗑️ Kanal entfernen', ButtonStyle.Danger],
] as const;

/** The dashboard with the `jtc_config_{name|limit|bitrate|delete}_{channelId}` buttons; `expired` disables them. */
export function dashboard(channelMention: string, channelId: string, settings: JoinToCreateChannelOptions, expired = false) {
  const embed = new EmbedBuilder()
    .setTitle('Join-to-Create-Konfiguration')
    .setDescription(`Konfiguration für ${channelMention}`)
    .setColor(getColor('info'))
    .addFields(
      { name: 'Kanalnamen-Vorlage', value: `\`${settings.nameTemplate}\``, inline: false },
      { name: 'Nutzerlimit', value: limitText(settings.userLimit), inline: true },
      { name: 'Bitrate', value: `${settings.bitrate / 1000} kbps`, inline: true },
    )
    .setFooter({ text: expired
      ? 'Sitzung abgelaufen. Führe den Command erneut aus, um Änderungen vorzunehmen.'
      : 'Nutze die Buttons unten, um Einstellungen zu ändern • Nur ein Trigger-Kanal pro Server möglich' })
    .setTimestamp();
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(DASHBOARD_BUTTONS.map(([id, label, style]) =>
    new ButtonBuilder().setCustomId(`jtc_config_${id}_${channelId}`).setLabel(label).setStyle(style).setDisabled(expired)));
  return { embeds: [embed], components: [row] };
}

export function nameTemplateModal(channelId: string, current: string) {
  // A stored template that is not in the list (e.g. an older English one) stays selectable and preselected.
  const choices = TEMPLATE_CHOICES.includes(current) ? TEMPLATE_CHOICES : [current.slice(0, 100), ...TEMPLATE_CHOICES];
  const select = new StringSelectMenuBuilder()
    .setCustomId('template')
    .setPlaceholder('Wähle eine Namensvorlage...')
    .setOptions(choices.map((value) => ({ label: value, value, default: value === current })));
  return new ModalBuilder()
    .setCustomId(`jtc_name_modal_${channelId}`)
    .setTitle('Kanalnamen-Vorlage')
    .addLabelComponents(new LabelBuilder().setLabel('Kanalnamen-Vorlage').setStringSelectMenuComponent(select));
}

function numberModal(customId: string, title: string, inputId: string, label: string, placeholder: string, maxLength: number, value: number) {
  return new ModalBuilder().setCustomId(customId).setTitle(title).addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder()
      .setCustomId(inputId).setLabel(label).setPlaceholder(placeholder).setStyle(TextInputStyle.Short)
      .setRequired(true).setMinLength(1).setMaxLength(maxLength).setValue(String(value))),
  );
}

export const userLimitModal = (channelId: string, current: number) => numberModal(`jtc_limit_modal_${channelId}`, 'Nutzerlimit festlegen',
  'user_limit', 'Nutzerlimit (0-99, 0 = unbegrenzt)', 'Gib eine Zahl zwischen 0 und 99 ein', 2, current);

export const bitrateModal = (channelId: string, currentKbps: number) => numberModal(`jtc_bitrate_modal_${channelId}`, 'Bitrate festlegen',
  'bitrate', 'Bitrate in kbps (8-384)', 'Gib eine Zahl zwischen 8 und 384 ein', 3, currentKbps);

export const templateUpdatedEmbed = (template: string) => successEmbed('Aktualisiert', `Kanalnamen-Vorlage geändert zu \`${template}\``);
export const userLimitUpdatedEmbed = (limit: number) => successEmbed('Aktualisiert', `Nutzerlimit geändert zu ${limitText(limit)}`);
export const bitrateUpdatedEmbed = (kbps: number) => successEmbed('Aktualisiert', `Bitrate geändert zu ${kbps} kbps`);

/** Confirmation with the `jtc_delete_{confirm|cancel}_{channelId}` buttons. */
export function removeConfirmation(channelName: string, channelId: string) {
  return {
    embeds: [warningEmbed('Löschen bestätigen', `Willst du **${channelName}** wirklich aus dem Join-to-Create-System entfernen?\n\nDas kann nicht rückgängig gemacht werden.`)],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`jtc_delete_confirm_${channelId}`).setLabel('🗑️ Ja, löschen').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`jtc_delete_cancel_${channelId}`).setLabel('❌ Abbrechen').setStyle(ButtonStyle.Secondary),
    )],
  };
}

export const removedEmbed = (channelName: string) => successEmbed('Entfernt', `**${channelName}** wurde aus dem Join-to-Create-System entfernt.`);
export const removeCancelledEmbed = () => successEmbed('Abgebrochen', 'Das Entfernen des Kanals wurde abgebrochen.');
