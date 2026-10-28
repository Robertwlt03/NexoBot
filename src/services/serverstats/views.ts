// Discord views of the server stats feature: the /serverstats embeds and the delete confirmation buttons.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { GuildBasedChannel } from 'discord.js';
import { getColor } from '../../config/bot.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getCounterEmoji, getCounterTypeDisplay, getCounterTypeLabel } from './core.js';
import type { ServerCounter } from './core.js';

const FOOTER = 'Zählersystem • Automatische Aktualisierung alle 15 Minuten';

export function createdEmbed(type: string, voice: boolean, categoryMention: string, channel: GuildBasedChannel, counterId: string) {
  return successEmbed(`**Zähler erfolgreich erstellt!**\n\n**Typ:** ${getCounterTypeLabel(type)}\n**Kanaltyp:** ${voice ? 'Sprachkanal' : 'Textkanal'}\n**Kategorie:** ${categoryMention}\n**Kanal:** ${channel}\n**Kanalname:** ${channel.name}\n**Zähler-ID:** \`${counterId}\`\n\nDer Zähler wird automatisch alle 15 Minuten aktualisiert.\n\nNutze \`/serverstats list\`, um alle Zähler anzusehen.`);
}

export function updatedEmbed(counterId: string | null, oldType: string, counter: ServerCounter, channel: GuildBasedChannel) {
  return successEmbed(`**Zähler erfolgreich aktualisiert!**\n\n**Zähler-ID:** \`${counterId}\`\n**Typ geändert:** ${getCounterTypeDisplay(oldType)} → ${getCounterTypeDisplay(counter.type)}\n\n**Aktuelle Einstellungen:**\n**Typ:** ${getCounterTypeDisplay(counter.type)}\n**Kanal:** ${channel}\n**Kanalname:** ${channel.name}\n\nDer Zähler wird automatisch alle 15 Minuten aktualisiert.`);
}

/** The confirmation with the `counter-delete:{action}:{counterId}:{userId}` buttons. */
export function deleteConfirmation(counter: ServerCounter, channel: GuildBasedChannel | null, userId: string) {
  const embed = createEmbed({
    title: 'Zähler & Kanal löschen',
    description: `Willst du diesen Zähler und seinen Kanal wirklich löschen?\n\n**ID:** \`${counter.id}\`\n**Typ:** ${getCounterTypeDisplay(counter.type)}\n**Kanal:** ${channel || 'Gelöschter Kanal'}\n\n **Der Kanal wird dauerhaft gelöscht!**`,
    color: getColor('error'),
  });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`counter-delete:confirm:${counter.id}:${userId}`).setLabel('Löschen bestätigen').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`counter-delete:cancel:${counter.id}:${userId}`).setLabel('Abbrechen').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

export function deletedEmbed({ counter, channelName, channelDeleted }: { counter: ServerCounter; channelName: string | null; channelDeleted: boolean }) {
  const channelLine = channelDeleted ? `${channelName} (gelöscht)` : channelName ? `${channelName} (Löschen fehlgeschlagen)` : 'Bereits gelöscht';
  return successEmbed(`✅ **Zähler erfolgreich gelöscht!**\n\n**ID:** \`${counter.id}\`\n**Typ:** ${getCounterTypeDisplay(counter.type)}\n**Kanal:** ${channelLine}`);
}

export const cancelledEmbed = () => createEmbed({ title: '❌ Abgebrochen', description: 'Löschen des Zählers abgebrochen.', color: 'error' });

export function emptyListEmbed() {
  return createEmbed({
    title: 'Server-Zähler',
    description: 'Für diesen Server wurden noch keine Zähler eingerichtet.\n\nNutze `/serverstats create`, um deinen ersten Zähler einzurichten!',
    color: getColor('warning'),
  }).addFields(
    { name: '**Verfügbare Zählertypen**', value: '**Mitglieder + Bots** - Alle Servermitglieder\n **Nur Mitglieder** - Nur menschliche Mitglieder\n **Nur Bots** - Nur Bot-Mitglieder', inline: false },
    { name: '**Beispiele**', value: '`/serverstats create type:members channel_type:voice category:Stats`\n`/serverstats create type:bots channel_type:text category:Server Info`\n`/serverstats list`', inline: false },
  ).setFooter({ text: FOOTER });
}

export function listEmbed(entries: { counter: ServerCounter; channel: GuildBasedChannel; count: number; upToDate: boolean }[], now: Date) {
  const embed = createEmbed({
    title: `Server-Zähler (${entries.length})`,
    description: 'Hier sind alle aktiven Zähler dieses Servers.\n\nZähler werden automatisch alle 15 Minuten aktualisiert.',
    color: getColor('info'),
  });
  entries.forEach(({ counter, channel, count, upToDate }, i) => {
    embed.addFields({
      name: `${getCounterEmoji(counter.type)} Zähler #${i + 1} - ${channel.name}`,
      value: `**ID:** \`${counter.id}\`\n**Typ:** ${getCounterTypeDisplay(counter.type)}\n**Kanal:** ${channel}\n**Aktueller Stand:** ${count}\n**Status:** ${upToDate ? '✅ Aktiv' : '⚠️ Nicht aktualisiert'}\n**Erstellt:** ${new Date(counter.createdAt).toLocaleDateString('de-DE')}`,
      inline: false,
    });
  });
  return embed.addFields(
    {
      name: '**Statistiken**',
      value: `**Zähler gesamt:** ${entries.length}\n**Aktive Zähler:** ${entries.filter((entry) => entry.upToDate).length}\n**Nächste Aktualisierung:** <t:${Math.ceil(now.getTime() / 900_000) * 900}:R>`,
      inline: false,
    },
    { name: '**Verwaltungs-Commands**', value: '`/serverstats create` - Neuen Zähler erstellen\n`/serverstats update` - Bestehenden Zähler aktualisieren\n`/serverstats delete` - Zähler löschen', inline: false },
  ).setFooter({ text: FOOTER }).setTimestamp(now);
}
