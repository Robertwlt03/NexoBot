// /profil: the member's Nexo profile card, Bernis balance, quests, year review and the way to the profile shop in the
// dashboard. Answers use the Nexo card layout (Components V2, utils/nexoMessage.ts).

import { ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/index.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ErrorTypes, NexoBotError } from '../../utils/errorHandler.js';
import { ACCENTS, nexoCard, nexoMessage, textBar, type NexoBlock } from '../../utils/nexoMessage.js';
import { cmd } from '../../utils/commandMention.js';
import { publicDashboardUrl } from '../../web/dashboard.js';
import { CURRENCY } from '../../shared/cosmetics.js';
import { formatCoins } from '../../shared/coins.js';
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

const COIN_TEXT = '🟤 Bronze · ⚪ Silber (100 Bronze) · 🟡 Gold (100 Silber) · 💠 Platin (100 Gold)';

/** A page of the "Mein Profil" area of the dashboard, or null without a public dashboard URL. */
function dashboardUrl(path = ''): string | null {
  const base = publicDashboardUrl();
  return base ? `${base}/me${path}` : null;
}

const linkButton = (label: string, url: string | null) => (url ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(label).setURL(url)] : []);

const earnText = () => `${CURRENCY.name} bekommst du für Level-ups, Minispiele, Erfolge, Tagesaufgaben (${cmd('profil aufgaben')}) und den Tagesbonus. `
  + 'Im Shop tauschst du sie gegen Hintergründe, Rahmen, Begleiter und mehr für deine Profilkarte.';

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
    .addSubcommand((sub) => sub.setName('rollen').setDescription('Verknüpfte Rollen: Server-Rollen für dein Level, deine Saison-Stufe und mehr'))
    .addSubcommand((sub) => sub.setName('aufgaben').setDescription('Deine drei Tagesaufgaben und wie weit du bist'))
    .addSubcommand((sub) => sub
      .setName('erinnerung')
      .setDescription('Erinnerung per DM um 19 Uhr an Tagesbonus und offene Aufgaben')
      .addBooleanOption((option) => option.setName('an').setDescription('Erinnerung einschalten (true) oder ausschalten (false)').setRequired(true)))
    .setDMPermission(false),

  async execute(interaction, _guildConfig, client) {
    const subcommand = interaction.options.getSubcommand();
    const reply = (container: Parameters<typeof nexoMessage>[0]) => InteractionHelper.safeReply(interaction, nexoMessage(container, { ephemeral: true }));

    if (subcommand === 'bernis') {
      const balance = await getBalance(interaction.user.id);
      await reply(nexoCard({
        kicker: CURRENCY.name, title: 'Dein Kontostand', accent: ACCENTS.gold,
        blocks: [
          { text: `# ${formatCoins(balance)}\n-# ${formatNumber(balance)} ${balance === 1 ? CURRENCY.singular : CURRENCY.name} insgesamt` },
          { separator: true },
          { text: `${COIN_TEXT}\n\n${earnText()}` },
          { buttons: [...linkButton('Zum Shop', dashboardUrl('/shop')), ...linkButton('Tagesbonus abholen', dashboardUrl())] },
        ],
      }));
      return;
    }

    if (subcommand === 'shop') {
      const url = dashboardUrl('/shop');
      await reply(url
        ? nexoCard({
          kicker: 'Profil-Shop', title: 'Gestalte deine Profilkarte',
          blocks: [{ text: earnText() }, { buttons: [...linkButton('Zum Shop', url), ...linkButton('Black Market', dashboardUrl('/blackmarket')), ...linkButton('Saisonpfad', dashboardUrl('/saison'))] }],
        })
        : nexoCard({ kicker: 'Profil-Shop', title: 'Gerade nicht erreichbar', accent: ACCENTS.warn, blocks: [{ text: 'Das Dashboard ist gerade nicht erreichbar. Versuch es später noch einmal.' }] }));
      return;
    }

    if (subcommand === 'jahr') {
      if (!cosmeticsPool()) {
        await reply(nexoCard({ kicker: 'Dein Nexo-Jahr', title: 'Gerade nicht verfügbar', accent: ACCENTS.warn, blocks: [{ text: 'Dafür braucht Nexo seine Datenbank – versuch es später noch einmal.' }] }));
        return;
      }
      // Public on purpose: the year card is made for sharing.
      await InteractionHelper.safeDefer(interaction, {});
      const year = interaction.options.getInteger('jahr') ?? Number(new Intl.DateTimeFormat('en', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(new Date()));
      const member = await interaction.guild!.members.fetch(interaction.user.id);
      const review = await loadYearReview(interaction.user.id, year, (id) => client.guilds.cache.get(id)?.name ?? null);
      const card = canAttachFiles(interaction) ? await yearCardAttachment(client, member, review) : null;
      const blocks: NexoBlock[] = card
        ? [{ images: [`attachment://${card.name}`] }]
        : review.tiles.map((tile) => ({ text: `**${tile.coins ? formatCoins(tile.value) : `${formatNumber(tile.value)}${tile.unit ? ` ${tile.unit}` : ''}`}** · ${tile.label}` }));
      if (review.highlights.length) blocks.push({ text: review.highlights.map((line) => `– ${line}`).join('\n') });
      await InteractionHelper.safeEditReply(interaction, {
        ...nexoMessage(nexoCard({ kicker: 'Dein Nexo-Jahr', title: `${member.displayName} · ${year}`, accent: ACCENTS.gold, blocks, footer: `Deins sehen: ${cmd('profil jahr')}` })),
        files: card ? [card] : [],
      });
      return;
    }

    if (subcommand === 'rollen') {
      const verify = publicDashboardUrl();
      await reply(nexoCard({
        kicker: 'Verknüpfte Rollen', title: 'Rollen für deine Nexo-Werte',
        blocks: [
          { text: 'Server können Rollen vergeben, wenn du bestimmte Nexo-Werte erreichst: **höchstes Level, Saison-Stufe, Erfolge, Chat-Tage** und **verdiente Bernis**.' },
          { text: '**So geht’s:** Verknüpfe Nexo einmal mit deinem Discord-Konto. Danach siehst du in den Server-Rollen, welche du schon erfüllst, und Nexo hält deine Werte stündlich aktuell.' },
          { text: '-# Für Admins: Servereinstellungen → Rollen → Rolle wählen → Links → Anforderung hinzufügen → Nexo.' },
          { buttons: verify ? [new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Mit Discord verknüpfen').setURL(`${verify}/linked-role`)] : [] },
        ],
      }));
      return;
    }

    if (subcommand === 'erinnerung') {
      const on = await writeReminders(interaction.user.id, interaction.options.getBoolean('an', true));
      await reply(nexoCard({
        kicker: 'Erinnerung', title: on ? '🔔 Erinnerung an' : '🔕 Erinnerung aus', accent: on ? undefined : ACCENTS.calm,
        blocks: [{ text: on
          ? 'Ich schreibe dir um 19 Uhr eine DM, wenn dein Tagesbonus noch wartet oder Tagesaufgaben offen sind. Deine DMs müssen für Nexo offen sein.'
          : `Keine Erinnerungen mehr. Einschalten kannst du sie jederzeit wieder mit ${cmd('profil erinnerung')}.` }],
      }));
      return;
    }

    if (subcommand === 'aufgaben') {
      const { quests, bonus, resetsAt } = await getDailyQuests(interaction.user.id, pendingQuestCounts(interaction.user.id));
      const blocks: NexoBlock[] = quests.map((quest) => ({ text: quest.done
        ? `✅ ~~${quest.label}~~\n-# geschafft · ${formatCoins(quest.reward)}`
        : `⬜ **${quest.label}**\n${textBar(quest.current, quest.target)} ${quest.current}/${quest.target} · ${formatCoins(quest.reward)}` }));
      blocks.push({ text: bonus.done ? `Bonus für alle drei kassiert: ${formatCoins(bonus.reward)}` : `Alle drei geschafft: **${formatCoins(bonus.reward)}** extra` });
      const guild = interaction.guild!;
      const goals = await communityGoals(interaction.user.id, [{ id: guild.id, name: guild.name, iconUrl: null }], pendingCommunity(interaction.user.id));
      if (goals.length) blocks.push({ separator: true });
      for (const goal of goals) {
        blocks.push({ text: `**Gemeinschaftsziel ${goal.eventName}**\n${textBar(goal.progress, goal.target)} ${goal.progress.toLocaleString('de-DE')} / ${goal.target.toLocaleString('de-DE')} Nachrichten · du: ${goal.mine}\n-# `
          + (goal.paid ? 'Belohnung bekommen ✅' : `Ab ${goal.minimum} eigenen Nachrichten gibt es ${formatCoins(goal.reward)}, wenn ihr es schafft.`) });
      }
      const season = await getSeason(interaction.user.id);
      const nextTier = season.tiers[season.tier];
      blocks.push({ separator: true }, { text: `**Saison ${season.name}** · Stufe ${season.tier} von ${season.tiers.length}\n${nextTier ? `${textBar(season.points, nextTier.points)} ${season.points} / ${nextTier.points} Punkte` : 'Saisonpfad komplett!'}` });
      blocks.push({ buttons: [...linkButton('Saisonpfad', dashboardUrl('/saison')), ...linkButton('Zum Shop', dashboardUrl('/shop'))] });
      await reply(nexoCard({
        kicker: 'Tagesaufgaben', title: `${quests.filter((quest) => quest.done).length} von ${quests.length} geschafft`, blocks,
        footer: `Neue Aufgaben <t:${Math.floor(Date.parse(resetsAt) / 1000)}:R> · zählt auf allen Servern · zahlt sich von selbst aus`,
      }));
      return;
    }

    await InteractionHelper.safeDefer(interaction);
    const target = interaction.options.getUser('nutzer') ?? interaction.user;
    const member = await interaction.guild!.members.fetch(target.id).catch(() => null);
    if (!member) {
      throw new NexoBotError(`User ${target.id} not found in guild`, ErrorTypes.USER_INPUT, 'Dieses Mitglied ist nicht auf diesem Server.');
    }
    const own = target.id === interaction.user.id;
    const buttons = own ? linkButton('Profil gestalten', dashboardUrl()) : [];

    const card = canAttachFiles(interaction) ? await profileCardAttachment(client, member) : null;
    if (card) {
      await InteractionHelper.safeEditReply(interaction, { ...nexoMessage(nexoCard({ blocks: [{ images: [`attachment://${card.name}`] }, { buttons }] })), files: [card] });
      return;
    }

    // Text fallback: no AttachFiles permission or rendering failed.
    const { subject } = await loadProfileCardData(client, member);
    await InteractionHelper.safeEditReply(interaction, nexoMessage(nexoCard({
      kicker: 'Profil', title: subject.name,
      blocks: [
        { text: `${subject.bio ? `${subject.bio}\n\n` : ''}**Level ${subject.level}** · ${formatNumber(subject.xp)} / ${formatNumber(subject.xpNeeded)} XP · Rang ${subject.rank ? `#${subject.rank}` : '–'}\n${formatCoins(subject.balance)}`, ...(subject.avatarUrl ? { thumbnail: subject.avatarUrl } : {}) },
        { buttons },
      ],
    })));
  },
} satisfies Command;
