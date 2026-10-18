import {
  ChannelType,
  DiscordAPIError,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { ChatInputCommandInteraction, Guild, SlashCommandBooleanOption, SlashCommandIntegerOption } from 'discord.js';
import type { Command } from '../../types/index.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { replyUserError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import {
  applyFeature,
  automodSettingsOf,
  getNexoRules,
  parseList,
  saveAutomodSettings,
  timeoutMinutesOf,
  type AutomodFeature,
  type AutomodSettings,
} from '../../services/automodService.js';

const FEATURE_LABELS: Record<AutomodFeature, string> = {
  spam: 'Spam-Filter',
  links: 'Link-Filter',
  invites: 'Einladungs-Filter',
  badwords: 'Schimpfwort-Filter',
  mentions: 'Schutz vor Massen-Erwähnungen',
};

const addEnabled = (description: string) => (option: SlashCommandBooleanOption) =>
  option.setName('enabled').setDescription(description).setRequired(true);
const addTimeout = (option: SlashCommandIntegerOption) =>
  option.setName('timeout').setDescription('Timeout in Minuten für Verstöße (0 = kein Timeout)').setMinValue(0).setMaxValue(40320);

function toggle(list: string[], id: string): { list: string[]; added: boolean } {
  return list.includes(id) ? { list: list.filter((entry) => entry !== id), added: false } : { list: [...list, id], added: true };
}

async function handleFeature(interaction: ChatInputCommandInteraction, guild: Guild, feature: AutomodFeature, settings: AutomodSettings) {
  const enabled = interaction.options.getBoolean('enabled', true);
  const timeout = interaction.options.getInteger('timeout');
  const options = {
    allow: parseList(interaction.options.getString('allow')),
    words: parseList(interaction.options.getString('words')),
    limit: interaction.options.getInteger('limit') ?? undefined,
    timeoutMinutes: timeout ?? undefined,
  };

  const result = await applyFeature(guild, feature, enabled, options, settings, `AutoMod-Einstellung von ${interaction.user.tag}`);
  const label = FEATURE_LABELS[feature];

  if (!enabled) {
    return successEmbed(`${label} deaktiviert`, result.disabled > 0
      ? `Der ${label} ist jetzt aus. Die Einstellungen bleiben gespeichert und gelten wieder, sobald du ihn aktivierst.`
      : `Der ${label} war nicht aktiv.`);
  }

  const notes = [`Der ${label} ist aktiv. Discord blockiert passende Nachrichten automatisch, auch wenn Nexo offline ist.`];
  if (result.adopted > 0) {
    notes.push('Discord erlaubt diesen Regeltyp nur einmal pro Server. Eine bereits vorhandene Regel wurde deshalb übernommen.');
  }
  if (!settings.alertChannelId) {
    notes.push('Tipp: Mit `/automod alerts` legst du einen Kanal für Meldungen über blockierte Nachrichten fest.');
  }
  return successEmbed(`${label} aktiviert`, notes.join('\n\n'));
}

async function handleStatus(guild: Guild, settings: AutomodSettings) {
  const rules = await getNexoRules(guild);
  const lines = rules.length
    ? rules
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((rule) => {
        const timeout = timeoutMinutesOf(rule);
        return `${rule.enabled ? '✅' : '⏸️'} **${rule.name}**${timeout > 0 ? ` · Timeout ${timeout} Min.` : ''}`;
      })
    : ['Noch keine AutoMod-Regeln von Nexo. Starte z. B. mit `/automod spam enabled:true`.'];

  const roles = settings.exemptRoleIds?.map((id) => `<@&${id}>`).join(', ') || 'keine';
  const channels = settings.exemptChannelIds?.map((id) => `<#${id}>`).join(', ') || 'keine';

  return createEmbed({
    title: '🛡️ AutoMod',
    description: lines.join('\n'),
    fields: [
      { name: 'Meldekanal', value: settings.alertChannelId ? `<#${settings.alertChannelId}>` : 'keiner', inline: true },
      { name: 'Ausgenommene Rollen', value: roles, inline: true },
      { name: 'Ausgenommene Kanäle', value: channels, inline: true },
    ],
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Discords AutoMod einrichten: Spam, Links, Einladungen, Schimpfwörter, Erwähnungen')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('status').setDescription('Zeigt alle AutoMod-Regeln von Nexo und ihre Einstellungen'))
    .addSubcommand((sub) => sub.setName('spam').setDescription('Blockt Nachrichten, die Discord als Spam erkennt')
      .addBooleanOption(addEnabled('Spam-Filter ein- oder ausschalten')))
    .addSubcommand((sub) => sub.setName('links').setDescription('Blockt Links (GIFs und Discord-Links bleiben erlaubt)')
      .addBooleanOption(addEnabled('Link-Filter ein- oder ausschalten'))
      .addStringOption((option) => option.setName('allow').setDescription('Erlaubte Domains, mit Komma getrennt (z. B. youtube.com, twitch.tv)').setMaxLength(1000))
      .addIntegerOption(addTimeout))
    .addSubcommand((sub) => sub.setName('invites').setDescription('Blockt Einladungen zu anderen Discord-Servern')
      .addBooleanOption(addEnabled('Einladungs-Filter ein- oder ausschalten'))
      .addIntegerOption(addTimeout))
    .addSubcommand((sub) => sub.setName('badwords').setDescription('Blockt Schimpfwörter (Discord-Listen plus deutsche Wortliste)')
      .addBooleanOption(addEnabled('Schimpfwort-Filter ein- oder ausschalten'))
      .addStringOption((option) => option.setName('words').setDescription('Eigene Wortliste, mit Komma getrennt (ersetzt die deutsche Standardliste)').setMaxLength(4000))
      .addIntegerOption(addTimeout))
    .addSubcommand((sub) => sub.setName('mentions').setDescription('Blockt Nachrichten mit zu vielen Erwähnungen')
      .addBooleanOption(addEnabled('Schutz vor Massen-Erwähnungen ein- oder ausschalten'))
      .addIntegerOption((option) => option.setName('limit').setDescription('Maximale Erwähnungen pro Nachricht (Standard 5)').setMinValue(1).setMaxValue(50))
      .addIntegerOption(addTimeout))
    .addSubcommand((sub) => sub.setName('alerts').setDescription('Kanal für Meldungen über blockierte Nachrichten festlegen oder entfernen')
      .addChannelOption((option) => option.setName('channel').setDescription('Meldekanal (leer lassen zum Entfernen)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand((sub) => sub.setName('exempt').setDescription('Rolle oder Kanal vom AutoMod ausnehmen oder wieder einbeziehen')
      .addRoleOption((option) => option.setName('role').setDescription('Rolle, die nicht gefiltert wird'))
      .addChannelOption((option) => option.setName('channel').setDescription('Kanal, der nicht gefiltert wird'))),

  slashOnly: true,
  // Setting up several rules in a row is normal; keep the moderation cooldown out of the way.
  abuseProtection: { maxAttempts: 15, windowMs: 60_000 },

  async execute(interaction, config, client) {
    const guild = interaction.guild!;
    if (!(await InteractionHelper.safeDefer(interaction, { flags: MessageFlags.Ephemeral }))) {
      return;
    }

    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return replyUserError(interaction, {
        type: ErrorTypes.PERMISSION,
        message: 'Ich brauche die Berechtigung „Server verwalten“, um AutoMod-Regeln anzulegen.',
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const settings = automodSettingsOf(config);

    try {
      if (subcommand === 'status') {
        return InteractionHelper.safeEditReply(interaction, { embeds: [await handleStatus(guild, settings)] });
      }

      if (subcommand === 'alerts') {
        const channel = interaction.options.getChannel('channel');
        const updated = await saveAutomodSettings(client, guild, { ...settings, alertChannelId: channel?.id ?? null }, interaction.user.tag);
        return InteractionHelper.safeEditReply(interaction, {
          embeds: [successEmbed('Meldekanal gespeichert', channel
            ? `Blockierte Nachrichten werden in ${channel} gemeldet (${updated} Regeln aktualisiert).`
            : `Es werden keine Meldungen mehr gesendet (${updated} Regeln aktualisiert).`)],
        });
      }

      if (subcommand === 'exempt') {
        const role = interaction.options.getRole('role');
        const channel = interaction.options.getChannel('channel');
        if (!role && !channel) {
          return replyUserError(interaction, { type: ErrorTypes.VALIDATION, message: 'Gib eine Rolle oder einen Kanal an.' });
        }
        const next = { ...settings };
        const changes: string[] = [];
        if (role) {
          const result = toggle(next.exemptRoleIds ?? [], role.id);
          next.exemptRoleIds = result.list;
          changes.push(`${role} ${result.added ? 'wird jetzt nicht mehr gefiltert' : 'wird wieder gefiltert'}.`);
        }
        if (channel) {
          const result = toggle(next.exemptChannelIds ?? [], channel.id);
          next.exemptChannelIds = result.list;
          changes.push(`${channel} ${result.added ? 'wird jetzt nicht mehr gefiltert' : 'wird wieder gefiltert'}.`);
        }
        await saveAutomodSettings(client, guild, next, interaction.user.tag);
        return InteractionHelper.safeEditReply(interaction, { embeds: [successEmbed('Ausnahmen gespeichert', changes.join('\n'))] });
      }

      const embed = await handleFeature(interaction, guild, subcommand as AutomodFeature, settings);
      return InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    } catch (error) {
      logger.error('AutoMod command error:', error);
      const detail = error instanceof DiscordAPIError ? ` Discord meldet: ${error.message}` : '';
      return replyUserError(interaction, {
        type: ErrorTypes.DISCORD_API,
        message: `Die AutoMod-Regel konnte nicht gespeichert werden.${detail}`,
      });
    }
  },
} satisfies Command;

