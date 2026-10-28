// Discord views of the giveaway feature: the giveaway message (card and buttons), the announcements and the replies.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { getColor } from '../../config/bot.js';
import { withBanner } from '../../utils/cardBanner.js';
import { successEmbed } from '../../utils/embeds.js';
import { endTimeOf } from './core.js';
import type { Giveaway } from './core.js';

export type GiveawayState = 'active' | 'ended' | 'reroll';

const HEADLINE: Record<GiveawayState, string> = {
  active: '🎉 **NEUES GIVEAWAY** 🎉',
  ended: '🎉 **GIVEAWAY BEENDET** 🎉',
  reroll: '🔄 **GIVEAWAY NEU GEZOGEN** 🔄',
};

export const mentions = (userIds: string[]) => userIds.map((id) => `<@${id}>`).join(', ');

function giveawayEmbed(giveaway: Giveaway, state: GiveawayState) {
  const closed = state !== 'active';
  const embed = new EmbedBuilder()
    .setTitle(`${state === 'reroll' ? '🔄' : '🎉'} ${giveaway.prize}`)
    .setDescription('Klick auf den Button unten, um teilzunehmen!')
    .setColor(closed ? getColor('giveaway.ended') : getColor('giveaway.active'))
    .addFields(
      { name: '👤 Veranstaltet von', value: `<@${giveaway.hostId}>`, inline: true },
      { name: '🏆 Gewinner', value: String(giveaway.winnerCount ?? 1), inline: true },
      { name: '👥 Teilnahmen', value: String(giveaway.participants?.length ?? 0), inline: true },
    )
    .setTimestamp();
  if (closed) {
    const winners = giveaway.winnerIds ?? [];
    embed.addFields({ name: '🎯 Gewinner', value: winners.length ? mentions(winners) : 'Keine gültigen Teilnahmen', inline: false });
  } else {
    embed.addFields({ name: '⏰ Endet', value: `<t:${Math.floor((endTimeOf(giveaway) ?? 0) / 1000)}:R>`, inline: false });
  }
  return withBanner(embed, closed ? 'giftEnded' : 'gift');
}

function giveawayButtons(closed: boolean) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  return closed
    ? row.addComponents(
      new ButtonBuilder().setCustomId('giveaway_reroll').setLabel('🎲 Neu auslosen').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('giveaway_view').setLabel('👁️ Gewinner anzeigen').setStyle(ButtonStyle.Primary),
    )
    : row.addComponents(
      new ButtonBuilder().setCustomId('giveaway_join').setLabel('🎉 Teilnehmen').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('giveaway_end').setLabel('🛑 Beenden').setStyle(ButtonStyle.Danger),
    );
}

/** The whole giveaway message: headline, card and buttons for its state. */
export const giveawayMessage = (giveaway: Giveaway, state: GiveawayState) => ({
  content: HEADLINE[state],
  embeds: [giveawayEmbed(giveaway, state)],
  components: [giveawayButtons(state !== 'active')],
});

/** Card and buttons only (a join keeps the headline). */
export const giveawayCard = (giveaway: Giveaway) => ({ embeds: [giveawayEmbed(giveaway, 'active')], components: [giveawayButtons(false)] });

export const winnerAnnouncement = (giveaway: Giveaway) => (giveaway.winnerIds?.length
  ? `🎉 HERZLICHEN GLÜCKWUNSCH ${mentions(giveaway.winnerIds)}! Du hast das Giveaway **${giveaway.prize}** gewonnen! Melde dich beim Host <@${giveaway.hostId}>, um deinen Preis abzuholen.`
  : `Das Giveaway für **${giveaway.prize}** ist ohne gültige Teilnahmen zu Ende gegangen.`);

export const rerollAnnouncement = (giveaway: Giveaway, messageFound: boolean) => (messageFound
  ? `🔄 **NEUE GEWINNER** 🔄 HERZLICHEN GLÜCKWUNSCH ${mentions(giveaway.winnerIds ?? [])}! Du hast das Giveaway **${giveaway.prize}** gewonnen! Melde dich beim Host <@${giveaway.hostId}>, um deinen Preis abzuholen.`
  : `🔄 **GIVEAWAY NEU GEZOGEN** 🔄 Neue Gewinner für **${giveaway.prize}**: ${mentions(giveaway.winnerIds ?? [])}!`);

export const startedEmbed = (prize: string, channelMention: string, duration: string | null) =>
  successEmbed('Giveaway gestartet! 🎉', `Ein neues Giveaway für **${prize}** läuft jetzt in ${channelMention} und endet in **${duration}**.`);

export const endedEmbed = (giveaway: Giveaway, channelMention: string) =>
  successEmbed('Giveaway beendet ✅', `Das Giveaway für **${giveaway.prize}** in ${channelMention} wurde beendet. ${giveaway.winnerIds?.length ?? 0} Gewinner aus ${giveaway.participants?.length ?? 0} Teilnahmen gezogen.`);

export function rerolledEmbed(giveaway: Giveaway, channelMention: string | null, messageFound: boolean) {
  if (!channelMention) return successEmbed('Neu gezogen', 'Die neuen Gewinner wurden gezogen und gespeichert. Der Kanal für die Ankündigung wurde nicht gefunden.');
  if (!messageFound) return successEmbed('Neu gezogen', `Die neuen Gewinner wurden in ${channelMention} bekannt gegeben. (Ursprüngliche Nachricht nicht gefunden.)`);
  return successEmbed('Erfolgreich neu gezogen ✅', `Für das Giveaway **${giveaway.prize}** in ${channelMention} wurden ${giveaway.winnerIds?.length ?? 0} neue Gewinner gezogen.`);
}

export function deletedEmbed(giveaway: Giveaway, deletedMessage: boolean, channelName: string) {
  const status = deletedMessage
    ? ` und die Nachricht wurde aus #${channelName} entfernt`
    : ', die Nachricht war aber bereits gelöscht oder der Kanal war nicht erreichbar';
  const winners = giveaway.winnerIds?.length ?? 0;
  const winnerStatus = winners > 0
    ? `Für dieses Giveaway wurden bereits ${winners} Gewinner gezogen.`
    : giveaway.ended || giveaway.isEnded
      ? 'Dieses Giveaway wurde ohne gültige Gewinner beendet.'
      : 'Vor dem Löschen wurde kein Gewinner gezogen.';
  return successEmbed('Giveaway gelöscht', `Das Giveaway für **${giveaway.prize}** wurde gelöscht${status}. ${winnerStatus}`);
}

export const joinedEmbed = (participants: number) =>
  successEmbed('Geschafft! Du nimmst jetzt am Giveaway teil! 🎉', `Viel Glück! Es gibt jetzt ${participants} Teilnahme(n).`);

export const endedByButtonEmbed = (winners: number) =>
  successEmbed('Giveaway beendet ✅', `Das Giveaway wurde beendet und ${winners} Gewinner ausgelost!`);

export const rerolledByButtonEmbed = () => successEmbed('Giveaway neu ausgelost ✅', 'Neue Gewinner wurden ausgelost!');

export const winnersEmbed = (giveaway: Giveaway) => successEmbed(
  `Gewinner für ${giveaway.prize || 'dieses Giveaway'} 🎉`,
  giveaway.winnerIds?.length ? mentions(giveaway.winnerIds) : 'Für dieses Giveaway wurden keine gültigen Gewinner ausgelost.',
);
