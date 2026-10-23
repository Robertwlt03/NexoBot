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
import { canAttachFiles, loadProfileCardData, profileCardAttachment } from '../../services/profileCardRenderer.js';

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
