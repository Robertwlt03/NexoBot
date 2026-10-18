// AutoMod: shared settings in the guild config plus Nexo's rules in Discord's native AutoMod (same logic as /automod).

import express from 'express';
import { DiscordAPIError, PermissionFlagsBits } from 'discord.js';
import type { AutoModerationRule, Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import type { AutomodFeatureId, AutomodFeatures, AutomodSettingsDto } from '../dto/automod.js';
import {
  AUTOMOD_MAX_ALLOW, AUTOMOD_MAX_ENTRY_LENGTH, AUTOMOD_MAX_EXEMPT_CHANNELS, AUTOMOD_MAX_EXEMPT_ROLES,
  AUTOMOD_MAX_TIMEOUT, AUTOMOD_MAX_WORDS,
} from '../dto/automod.js';
import { locals } from '../dashboard.js';
import { badRequest, body, bool, channel, idList, int, str } from '../http.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import {
  DEFAULT_BAD_WORDS, DEFAULT_LINK_ALLOW, DEFAULT_MENTION_LIMIT, RULE_NAMES,
  applyFeature, automodSettingsOf, getNexoRules, saveAutomodSettings, timeoutMinutesOf,
  type AutomodFeatureOptions, type AutomodSettings,
} from '../../services/automodService.js';
import type { NexoClient } from '../../types/index.js';

const FEATURES: AutomodFeatureId[] = ['spam', 'links', 'invites', 'badwords', 'mentions'];

const canManage = (guild: Guild) => Boolean(guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild));

function featuresOf(rules: AutoModerationRule[]): AutomodFeatures {
  const byName = (name: string) => rules.find((rule) => rule.name === name);
  const links = byName(RULE_NAMES.links);
  const invites = byName(RULE_NAMES.invites);
  const badwords = byName(RULE_NAMES.badwords);
  const mentions = byName(RULE_NAMES.mentions);
  return {
    spam: { enabled: byName(RULE_NAMES.spam)?.enabled ?? false },
    links: {
      enabled: links?.enabled ?? false,
      allow: links ? links.triggerMetadata.allowList.map((entry) => entry.replace(/^\*|\*$/g, '')) : [...DEFAULT_LINK_ALLOW],
      timeoutMinutes: links ? timeoutMinutesOf(links) : 0,
    },
    invites: { enabled: invites?.enabled ?? false, timeoutMinutes: invites ? timeoutMinutesOf(invites) : 0 },
    badwords: {
      enabled: badwords?.enabled ?? false,
      words: badwords?.triggerMetadata.keywordFilter.length ? [...badwords.triggerMetadata.keywordFilter] : [...DEFAULT_BAD_WORDS],
      timeoutMinutes: badwords ? timeoutMinutesOf(badwords) : 0,
    },
    mentions: {
      enabled: mentions?.enabled ?? false,
      limit: mentions?.triggerMetadata.mentionTotalLimit ?? DEFAULT_MENTION_LIMIT,
      timeoutMinutes: mentions ? timeoutMinutesOf(mentions) : 0,
    },
  };
}

async function readSettings(client: NexoClient, guild: Guild): Promise<AutomodSettingsDto> {
  const settings = automodSettingsOf(await getGuildConfig(client, guild.id));
  const manage = canManage(guild);
  const rules = manage ? await getNexoRules(guild) : [];
  return {
    alertChannelId: settings.alertChannelId ?? null,
    exemptRoleIds: settings.exemptRoleIds ?? [],
    exemptChannelIds: settings.exemptChannelIds ?? [],
    features: featuresOf(rules),
    rules: rules
      .map((rule) => ({ id: rule.id, name: rule.name, enabled: rule.enabled, timeoutMinutes: timeoutMinutesOf(rule) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    canManage: manage,
  };
}

/** Lowercased, trimmed, de-duplicated list like the command's parseList. */
function entries(value: unknown, field: string, max: number): string[] {
  if (!Array.isArray(value)) throw badRequest(`${field}: Liste erwartet.`);
  const list = [...new Set(value.map((entry) => str(entry, field, { max: AUTOMOD_MAX_ENTRY_LENGTH }).toLowerCase()).filter(Boolean))];
  if (list.length > max) throw badRequest(`${field}: höchstens ${max} Einträge.`);
  return list;
}

const timeout = (value: unknown, label: string) => int(value, `${label}: Timeout (Minuten)`, 0, AUTOMOD_MAX_TIMEOUT);

function parseFeatures(raw: unknown): AutomodFeatures {
  const input = body(raw);
  const spam = body(input.spam);
  const links = body(input.links);
  const invites = body(input.invites);
  const badwords = body(input.badwords);
  const mentions = body(input.mentions);
  const result: AutomodFeatures = {
    spam: { enabled: bool(spam.enabled, 'Spam-Filter') },
    links: {
      enabled: bool(links.enabled, 'Link-Filter'),
      allow: entries(links.allow, 'Erlaubte Domains', AUTOMOD_MAX_ALLOW),
      timeoutMinutes: timeout(links.timeoutMinutes, 'Link-Filter'),
    },
    invites: { enabled: bool(invites.enabled, 'Einladungs-Filter'), timeoutMinutes: timeout(invites.timeoutMinutes, 'Einladungs-Filter') },
    badwords: {
      enabled: bool(badwords.enabled, 'Schimpfwort-Filter'),
      words: entries(badwords.words, 'Wortliste', AUTOMOD_MAX_WORDS),
      timeoutMinutes: timeout(badwords.timeoutMinutes, 'Schimpfwort-Filter'),
    },
    mentions: {
      enabled: bool(mentions.enabled, 'Massen-Erwähnungen'),
      limit: int(mentions.limit, 'Maximale Erwähnungen', 1, 50),
      timeoutMinutes: timeout(mentions.timeoutMinutes, 'Massen-Erwähnungen'),
    },
  };
  if (result.badwords.enabled && result.badwords.words.length === 0) {
    throw badRequest('Schimpfwort-Filter: Die Wortliste darf nicht leer sein.');
  }
  return result;
}

function optionsOf(features: AutomodFeatures, feature: AutomodFeatureId): AutomodFeatureOptions {
  switch (feature) {
    case 'spam': return {};
    case 'links': return { allow: features.links.allow, timeoutMinutes: features.links.timeoutMinutes };
    case 'invites': return { timeoutMinutes: features.invites.timeoutMinutes };
    case 'badwords': return { words: features.badwords.words, timeoutMinutes: features.badwords.timeoutMinutes };
    case 'mentions': return { limit: features.mentions.limit, timeoutMinutes: features.mentions.timeoutMinutes };
  }
}

export const automodModule: DashboardModule = {
  id: 'automod',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild));
    });

    router.put('/', async (req, res) => {
      const { guild, member } = locals(res);
      if (!canManage(guild)) {
        throw badRequest('Nexo braucht die Berechtigung „Server verwalten“, um AutoMod-Regeln anzulegen.');
      }
      const input = body(req.body);
      const settings: AutomodSettings = {
        alertChannelId: channel(guild, input.alertChannelId, 'Meldekanal'),
        exemptRoleIds: idList(guild, input.exemptRoleIds, 'Ausgenommene Rollen', 'role', AUTOMOD_MAX_EXEMPT_ROLES),
        exemptChannelIds: idList(guild, input.exemptChannelIds, 'Ausgenommene Kanäle', 'channel', AUTOMOD_MAX_EXEMPT_CHANNELS),
      };
      const features = parseFeatures(input.features);
      const current = await readSettings(client, guild);
      const userTag = `${member.user.tag} (Dashboard)`;

      try {
        const sharedChanged = JSON.stringify([current.alertChannelId, current.exemptRoleIds, current.exemptChannelIds])
          !== JSON.stringify([settings.alertChannelId, settings.exemptRoleIds, settings.exemptChannelIds]);
        if (sharedChanged) {
          await saveAutomodSettings(client, guild, settings, userTag);
        }
        for (const feature of FEATURES) {
          const next = features[feature];
          const before = current.features[feature];
          // Options of a disabled filter are not stored anywhere (like /automod <feature> enabled:false).
          if ((!next.enabled && !before.enabled) || JSON.stringify(next) === JSON.stringify(before)) continue;
          await applyFeature(guild, feature, next.enabled, optionsOf(features, feature), settings, `AutoMod-Einstellung von ${userTag}`);
        }
      } catch (error) {
        if (error instanceof DiscordAPIError) {
          throw badRequest(`Die AutoMod-Regel konnte nicht gespeichert werden. Discord meldet: ${error.message}`);
        }
        throw error;
      }

      res.json(await readSettings(client, guild));
    });

    return router;
  },
};
