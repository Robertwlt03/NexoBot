// /profil: the member's Nexo profile card, Bernis balance and the way to the profile shop in the dashboard.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from '../../utils/embeds.js';
import { ErrorTypes, NexoBotError } from '../../utils/errorHandler.js';
import { publicDashboardUrl } from '../../web/dashboard.js';
import { CURRENCY } from '../../shared/cosmetics.js';
import { formatCoins } from '../../shared/coins.js';

const COIN_TEXT = '🟤 Bronze · ⚪ Silber (100 Bronze) · 🟡 Gold (100 Silber) · 💠 Platin (100 Gold)';
import { formatNumber } from '../../shared/profileCard.js';
import { getBalance } from '../../services/cosmetics/store.js';
import { getDailyQuests } from '../../services/cosmetics/quests.js';
import { writeReminders } from '../../services/cosmetics/reminders.js';
import { communityGoals } from '../../services/cosmetics/community.js';
import { getSeason } from '../../services/cosmetics/season.js';
import { pendingCommunity, pendingQuestCounts } from '../../services/cosmetics/activity.js';
import { canAttachFiles, loadProfileCardData, profileCardAttachment, yearCardAttachment } from '../../services/profileCardRenderer.js';
import { loadYearReview } from '../../services/cosmetics/yearReview.js';
import { cosmeticsPool } from '../../services/cosmetics/db.js';

/** "Mein Profil" area of the dashboard (wallet, shop, profile editor). */
function shopUrl(): string | null {
  const base = publicDashboardUrl();
  return base ? `${base}/me` : null;
}

const shopRow = (url: string) => new ActionRowBuilder<ButtonBuilder>().addComponents(
  new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Zum Shop').setURL(url),
);

const EARN_TEXT = `${CURRENCY.name} bekommst du für Level-ups, Minispiele, Monatsrankings, Erfolge und den täglichen Bonus. `
  + 'Im Shop tauschst du sie gegen Hintergründe, Rahmen, Abzeichen und mehr für deine Profilkarte.';

export default {
  data: new SlashCommandBuilder()
    .setName('profil')
    .setDescription('Dein Nexo-Profil: Profilkarte, Bernis und Shop')
    .addSubcommand((sub) => sub
      .setName('ansehen')
      .setDescription('Zeigt die Profilkarte von dir oder einem anderen Mitglied')
      .addUserOption((option) => option.setName('nutzer').setDescription('Wessen Profil du sehen willst').setRequired(false)))
    .addSubcommand((sub) => sub.setName('bernis').setDescription('Zeigt deinen Bernis-Kontostand'))
    .addSubcommand((sub) => sub.setName('shop').setDescription('Öffnet den Profil-Shop im Dashboard'))
    .addSubcommand((sub) => sub
      .setName('jahr')
      .setDescription('Dein Nexo-Jahr: deine Zahlen als Karte zum Teilen')
      .addIntegerOption((option) => option.setName('jahr').setDescription('Welches Jahr (Standard: das aktuelle)').setMinValue(2024).setMaxValue(2100)))
    .addSubcommand((sub) => sub.setName('aufgaben').setDescription('Deine drei Tagesaufgaben und wie weit du bist'))
    .addSubcommand((sub) => sub
      .setName('erinnerung')
      .setDescription('Erinnerung per DM um 19 Uhr an Tagesbonus und offene Aufgaben')
      .addBooleanOption((option) => option.setName('an').setDescription('Erinnerung einschalten (true) oder ausschalten (false)').setRequired(true)))
    .setDMPermission(false),

  async execute(interaction, _guildConfig, client) {
    const subcommand = interaction.options.getSubcommand();
    const url = shopUrl();

    if (subcommand === 'bernis') {
      const balance = await getBalance(interaction.user.id);
      await InteractionHelper.safeReply(interaction, {
        embeds: [createEmbed({ title: `${CURRENCY.symbol} Deine ${CURRENCY.name}`, description: `Du hast **${formatCoins(balance)}** (${formatNumber(balance)} ${balance === 1 ? CURRENCY.singular : CURRENCY.name}).\n\n${COIN_TEXT}\n${EARN_TEXT}` })],
        components: url ? [shopRow(url)] : [],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === 'jahr') {
      if (!cosmeticsPool()) {
        await InteractionHelper.safeReply(interaction, { embeds: [createEmbed({ title: 'Dein Nexo-Jahr', description: 'Dafür braucht Nexo seine Datenbank – versuch es später noch einmal.', color: 'warning' })], flags: MessageFlags.Ephemeral });
        return;
      }
      await InteractionHelper.safeDefer(interaction);
      const year = interaction.options.getInteger('jahr') ?? Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(new Date()));
      const member = await interaction.guild!.members.fetch(interaction.user.id);
      const review = await loadYearReview(interaction.user.id, year, (id) => client.guilds.cache.get(id)?.name ?? null);
      const card = canAttachFiles(interaction) ? await yearCardAttachment(client, member, review) : null;
      if (card) {
        await InteractionHelper.safeEditReply(interaction, { content: `🎉 **${member.displayName}s Nexo-Jahr ${year}**`, files: [card] });
        return;
      }
      await InteractionHelper.safeEditReply(interaction, {
        embeds: [createEmbed({
          title: `Dein Nexo-Jahr ${year}`,
          fields: review.tiles.map((tile) => ({ name: tile.label, value: tile.coins ? formatCoins(tile.value) : `${formatNumber(tile.value)}${tile.unit ? ` ${tile.unit}` : ''}`, inline: true })),
          description: review.highlights.map((line) => `⭐ ${line}`).join('\n') || null,
        })],
      });
      return;
    }

    if (subcommand === 'erinnerung') {
      const on = await writeReminders(interaction.user.id, interaction.options.getBoolean('an', true));
      await InteractionHelper.safeReply(interaction, {
        embeds: [createEmbed({ title: on ? '🔔 Erinnerung an' : '🔕 Erinnerung aus', description: on
          ? 'Ich schreibe dir um 19 Uhr eine DM, wenn dein Tagesbonus noch wartet oder Tagesaufgaben offen sind. Deine DMs müssen für Nexo offen sein.'
          : 'Keine Erinnerungen mehr. Einschalten kannst du sie jederzeit wieder mit /profil erinnerung.' })],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === 'aufgaben') {
      const { quests, bonus, resetsAt } = await getDailyQuests(interaction.user.id, pendingQuestCounts(interaction.user.id));
      const bar = (current: number, target: number) => '▰'.repeat(Math.round((current / target) * 8)) + '▱'.repeat(8 - Math.round((current / target) * 8));
      const lines = quests.map((quest) => (quest.done
        ? `✅ ~~${quest.label}~~ · ${formatCoins(quest.reward)}`
        : `⬜ ${quest.label} · ${formatCoins(quest.reward)}\n${bar(quest.current, quest.target)} ${quest.current}/${quest.target}`));
      const guild = interaction.guild!;
      const goals = await communityGoals(interaction.user.id, [{ id: guild.id, name: guild.name, iconUrl: null }], pendingCommunity(interaction.user.id));
      for (const goal of goals) {
        lines.push('', `🤝 **Gemeinschaftsziel ${goal.eventName}:** ${goal.progress.toLocaleString('de-DE')} von ${goal.target.toLocaleString('de-DE')} Nachrichten auf diesem Server (du: ${goal.mine}). `
          + (goal.paid ? 'Belohnung bekommen ✅' : `Ab ${goal.minimum} eigenen Nachrichten gibt es ${formatCoins(goal.reward)}, wenn ihr es schafft.`));
      }
      const season = await getSeason(interaction.user.id);
      const nextTier = season.tiers[season.tier];
      lines.push('', `🏆 **Saison ${season.name}:** Stufe ${season.tier} von ${season.tiers.length} · ${season.points} Punkte`
        + (nextTier ? ` (noch ${nextTier.points - season.points} bis Stufe ${season.tier + 1})` : ' – Pfad komplett!'));
      lines.push('', bonus.done ? `🎁 Bonus für alle drei kassiert: ${formatCoins(bonus.reward)}` : `🎁 Alle drei geschafft: ${formatCoins(bonus.reward)} extra`);
      lines.push(`Neue Aufgaben <t:${Math.floor(Date.parse(resetsAt) / 1000)}:R>. Zählt auf allen Servern mit Nexo, fertige Aufgaben zahlen sich von selbst aus.`);
      await InteractionHelper.safeReply(interaction, {
        embeds: [createEmbed({ title: '📋 Deine Tagesaufgaben', description: lines.join('\n') })],
        components: url ? [shopRow(url)] : [],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (subcommand === 'shop') {
      await InteractionHelper.safeReply(interaction, url
        ? { embeds: [createEmbed({ title: 'Profil-Shop', description: `Gestalte deine Profilkarte im Dashboard. ${EARN_TEXT}` })], components: [shopRow(url)], flags: MessageFlags.Ephemeral }
        : { embeds: [createEmbed({ title: 'Profil-Shop', description: 'Das Dashboard ist gerade nicht erreichbar. Versuch es später noch einmal.', color: 'warning' })], flags: MessageFlags.Ephemeral });
      return;
    }

    await InteractionHelper.safeDefer(interaction);
    const target = interaction.options.getUser('nutzer') ?? interaction.user;
    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    if (!member) {
      throw new NexoBotError(`User ${target.id} not found in guild`, ErrorTypes.USER_INPUT, 'Dieses Mitglied ist nicht auf diesem Server.');
    }

    const card = canAttachFiles(interaction) ? await profileCardAttachment(client, member) : null;
    if (card) {
      await InteractionHelper.safeEditReply(interaction, { files: [card] });
      return;
    }

    // Text fallback: no AttachFiles permission or rendering failed.
    const { subject } = await loadProfileCardData(client, member);
    await InteractionHelper.safeEditReply(interaction, {
      embeds: [createEmbed({
        title: `Profil von ${subject.name}`,
        description: subject.bio || null,
        thumbnail: subject.avatarUrl,
        fields: [
          { name: 'Level', value: String(subject.level), inline: true },
          { name: 'XP', value: `${formatNumber(subject.xp)} / ${formatNumber(subject.xpNeeded)}`, inline: true },
          { name: 'Rang', value: subject.rank ? `#${subject.rank}` : '–', inline: true },
          { name: CURRENCY.name, value: formatCoins(subject.balance), inline: true },
        ],
      })],
    });
  },
} satisfies Command;
