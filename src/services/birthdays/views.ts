// Discord views of the birthday feature: every embed the /birthday commands and the daily announcement send.

import { EmbedBuilder } from 'discord.js';
import type { UpcomingBirthday } from './core.js';

const RED = 0xFF0000;
const GREEN = 0x00FF00;
const YELLOW = 0xFFFF00;

const embed = (color: number, title: string, description: string) =>
  new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
const plural = (count: number) => `${count} Geburtstag${count !== 1 ? 'e' : ''}`;

export const savedEmbed = (day: number, monthName: string) =>
  embed(GREEN, 'Geburtstag gespeichert!', `Dein Geburtstag ist jetzt der **${day}. ${monthName}**!`);

export const removedEmbed = () => embed(GREEN, 'Geburtstag entfernt', 'Dein Geburtstag wurde vom Server entfernt.');

export const nothingToRemoveEmbed = () =>
  embed(RED, 'Kein Geburtstag gefunden', 'Du hast keinen Geburtstag eingetragen, den du entfernen könntest.');

export const infoEmbed = (day: number, monthName: string, userMention: string) =>
  embed(GREEN, 'Geburtstagsinfo', `**Datum:** ${day}. ${monthName}\n**Nutzer:** ${userMention}`);

export const noInfoEmbed = (self: boolean, username: string) =>
  embed(RED, 'Kein Geburtstag gefunden', self
    ? 'Du hast deinen Geburtstag noch nicht eingetragen. Nutze `/birthday set`, um ihn hinzuzufügen!'
    : `${username} hat noch keinen Geburtstag eingetragen.`);

// `removed`: birthdays of members who left were just removed, so the server had entries, just none of current members.
export function listEmbed(guildName: string, entries: { userId: string; day: number; monthName: string }[], removed: number) {
  if (entries.length === 0) {
    return embed(RED, 'Keine Geburtstage', removed
      ? 'Keines der aktuellen Mitglieder hat einen Geburtstag eingetragen.'
      : 'Auf diesem Server wurden noch keine Geburtstage eingetragen.');
  }
  const lines = entries.map((entry, i) => `${i + 1}. <@${entry.userId}> - ${entry.day}. ${entry.monthName}\n`).join('');
  const list = `**${plural(entries.length)} auf ${guildName}**\n\n${lines}`;
  return embed(GREEN, 'Geburtstage auf dem Server', `${list}\n\nGesamt: ${plural(entries.length)}`);
}

function timeUntil(daysUntil: number): string {
  if (daysUntil === 0) return '🎉 **Heute!**';
  if (daysUntil === 1) return '📅 **Morgen!**';
  return `In ${daysUntil} Tagen`;
}

export function nextEmbed(guildName: string, upcoming: UpcomingBirthday[], names: Map<string, string>, removed: number) {
  if (upcoming.length === 0) {
    return removed
      ? embed(RED, 'Keine anstehenden Geburtstage', 'Für die aktuellen Mitglieder stehen keine Geburtstage an.')
      : embed(RED, 'Keine Geburtstage gefunden', 'Auf diesem Server sind noch keine Geburtstage eingetragen. Nutze `/birthday set`, um deinen hinzuzufügen!');
  }
  const entries = upcoming.map((birthday, i) => {
    const name = names.get(birthday.userId);
    return `${i + 1}. ${name ? `**${name}**\n` : ''}<@${birthday.userId}>\n📅 **Datum:** ${birthday.day}. ${birthday.monthName}\n⏰ **Wann:** ${timeUntil(birthday.daysUntil)}\n\n`;
  }).join('');
  return embed(GREEN, 'Die nächsten 5 Geburtstage',
    `🎂 **Die nächsten 5 Geburtstage**\n\nDas sind die nächsten 5 Geburtstage auf ${guildName}:\n\n${entries}Nutze /birthday set, um deinen Geburtstag einzutragen!`);
}

export const noPermissionEmbed = () =>
  embed(RED, 'Keine Berechtigung', 'Du brauchst die Berechtigung **Server verwalten**, um den Geburtstagskanal einzurichten.');

export const channelSetEmbed = (channelMention: string) =>
  embed(GREEN, 'Geburtstagsankündigungen aktiviert', `Geburtstagsankündigungen werden ab jetzt in ${channelMention} gepostet.`);

export const channelClearedEmbed = () =>
  embed(YELLOW, 'Geburtstagsankündigungen deaktiviert', 'Kein Kanal angegeben – Geburtstagsankündigungen wurden deaktiviert.');

export const channelErrorEmbed = () =>
  embed(RED, '⚠️ Konfigurationsfehler', 'Die Einstellung für den Geburtstagskanal konnte nicht gespeichert werden.');

/** The daily congratulation in the announcement channel (plain embed data, sent by the daily job). */
export const birthdayAnnouncement = (mentions: string[]) => ({
  embeds: [{
    title: '🎉 Alles Gute zum Geburtstag! 🎂',
    description: `Alles Liebe zum Geburtstag, ${mentions.join(', ')}! Auf einen großartigen Tag! 🎈`,
    color: 0xff69b4,
    footer: { text: 'Nexo Geburtstage' },
    timestamp: new Date().toISOString(),
  }],
});
