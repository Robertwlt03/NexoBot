// automodService.ts — manages Nexo's rules in Discord's native AutoMod.
// Discord enforces the rules itself (also while the bot is offline); Nexo only creates and edits them.

import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
} from 'discord.js';
import type {
  AutoModerationActionOptions,
  AutoModerationRule,
  AutoModerationRuleCreateOptions,
  Guild,
} from 'discord.js';
import type { GuildConfig, NexoClient } from '../types/index.js';
import { updateGuildConfig } from './config/guildConfig.js';

export type AutomodFeature = 'spam' | 'links' | 'invites' | 'badwords' | 'mentions';

/** Shared settings stored in the guild config (`automod` key). */
export interface AutomodSettings {
  alertChannelId?: string | null;
  exemptRoleIds?: string[];
  exemptChannelIds?: string[];
}

export interface AutomodFeatureOptions {
  /** Domains that stay allowed for the links rule. */
  allow?: string[];
  /** Custom keywords for the bad words rule. */
  words?: string[];
  /** Mention limit for the mentions rule. */
  limit?: number;
  /** Timeout in minutes (0 = no timeout). Only for keyword and mention rules. */
  timeoutMinutes?: number;
}

export const RULE_PREFIX = 'Nexo · ';

export const RULE_NAMES = {
  spam: `${RULE_PREFIX}Spam`,
  links: `${RULE_PREFIX}Links`,
  invites: `${RULE_PREFIX}Einladungen`,
  badwords: `${RULE_PREFIX}Schimpfwörter`,
  badwordsPresets: `${RULE_PREFIX}Schimpfwörter (Discord-Listen)`,
  mentions: `${RULE_PREFIX}Massen-Erwähnungen`,
} as const;

const BLOCK_MESSAGES: Record<AutomodFeature, string> = {
  spam: 'Deine Nachricht wurde als Spam erkannt und blockiert.',
  links: 'Links sind auf diesem Server nicht erlaubt.',
  invites: 'Einladungen zu anderen Servern sind hier nicht erlaubt.',
  badwords: 'Deine Nachricht enthält unerlaubte Wörter.',
  mentions: 'Deine Nachricht enthält zu viele Erwähnungen.',
};

// GIF picker and Discord's own CDN post links too; blocking them would break normal chatting.
export const DEFAULT_LINK_ALLOW = ['tenor.com', 'giphy.com', 'discord.com', 'discordapp.com', 'discordapp.net'];

// Discord's presets only cover English, so a small German list is added on top.
// Plain keywords match whole words only, which keeps false positives low.
export const DEFAULT_BAD_WORDS = [
  'arschloch', 'wichser', 'wixxer', 'hurensohn', 'fotze', 'missgeburt', 'spast', 'spasti',
  'schlampe', 'bastard', 'nutte', 'drecksau', 'vollidiot', 'fick dich', 'verpiss dich',
];

export const DEFAULT_MENTION_LIMIT = 5;
const MAX_TIMEOUT_MINUTES = 40320; // Discord limit: 28 days

const LINK_PATTERNS = ['https?://\\S+', 'www\\.\\S+'];
const INVITE_PATTERNS = ['(?:discord(?:app)?\\.com/invite|discord\\.gg|dsc\\.gg)/[\\w-]+'];

/** `youtube.com`, `https://www.YouTube.com/` → `*youtube.com*` (Discord wildcard syntax). */
export function toAllowEntry(domain: string): string | null {
  const cleaned = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  return cleaned ? `*${cleaned.slice(0, 58)}*` : null;
}

/** Comma or newline separated user input → trimmed, de-duplicated, non-empty values. */
export function parseList(input: string | null | undefined): string[] | undefined {
  if (input == null) {
    return undefined;
  }
  return [...new Set(input.split(/[,\n]/).map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
}

function buildActions(feature: AutomodFeature, settings: AutomodSettings, timeoutMinutes = 0): AutoModerationActionOptions[] {
  const actions: AutoModerationActionOptions[] = [
    { type: AutoModerationActionType.BlockMessage, metadata: { customMessage: BLOCK_MESSAGES[feature] } },
  ];
  if (settings.alertChannelId) {
    actions.push({ type: AutoModerationActionType.SendAlertMessage, metadata: { channel: settings.alertChannelId } });
  }
  const minutes = Math.min(Math.max(Math.trunc(timeoutMinutes), 0), MAX_TIMEOUT_MINUTES);
  if (minutes > 0) {
    actions.push({ type: AutoModerationActionType.Timeout, metadata: { durationSeconds: minutes * 60 } });
  }
  return actions;
}

/** Rule payloads for one feature (bad words uses two rules: Discord's presets plus custom keywords). */
export function buildRules(feature: AutomodFeature, options: AutomodFeatureOptions, settings: AutomodSettings): AutoModerationRuleCreateOptions[] {
  const base = {
    eventType: AutoModerationRuleEventType.MessageSend,
    enabled: true,
    exemptRoles: settings.exemptRoleIds ?? [],
    exemptChannels: settings.exemptChannelIds ?? [],
  };
  const timeout = options.timeoutMinutes ?? 0;

  switch (feature) {
    case 'spam':
      return [{ ...base, name: RULE_NAMES.spam, triggerType: AutoModerationRuleTriggerType.Spam, actions: buildActions('spam', settings) }];
    case 'links':
      return [{
        ...base,
        name: RULE_NAMES.links,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: {
          regexPatterns: LINK_PATTERNS,
          allowList: (options.allow ?? DEFAULT_LINK_ALLOW).map(toAllowEntry).filter((entry): entry is string => entry !== null).slice(0, 100),
        },
        actions: buildActions('links', settings, timeout),
      }];
    case 'invites':
      return [{
        ...base,
        name: RULE_NAMES.invites,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: { regexPatterns: INVITE_PATTERNS },
        actions: buildActions('invites', settings, timeout),
      }];
    case 'badwords':
      return [
        {
          ...base,
          name: RULE_NAMES.badwordsPresets,
          triggerType: AutoModerationRuleTriggerType.KeywordPreset,
          triggerMetadata: {
            presets: [
              AutoModerationRuleKeywordPresetType.Profanity,
              AutoModerationRuleKeywordPresetType.SexualContent,
              AutoModerationRuleKeywordPresetType.Slurs,
            ],
          },
          actions: buildActions('badwords', settings),
        },
        {
          ...base,
          name: RULE_NAMES.badwords,
          triggerType: AutoModerationRuleTriggerType.Keyword,
          triggerMetadata: { keywordFilter: (options.words ?? DEFAULT_BAD_WORDS).map((word) => word.slice(0, 60)).slice(0, 1000) },
          actions: buildActions('badwords', settings, timeout),
        },
      ];
    case 'mentions':
      return [{
        ...base,
        name: RULE_NAMES.mentions,
        triggerType: AutoModerationRuleTriggerType.MentionSpam,
        triggerMetadata: {
          mentionTotalLimit: Math.min(Math.max(options.limit ?? DEFAULT_MENTION_LIMIT, 1), 50),
          mentionRaidProtectionEnabled: true,
        },
        actions: buildActions('mentions', settings, timeout),
      }];
  }
}

// Discord allows only one rule of these types per server.
const SINGLETON_TRIGGERS = new Set([
  AutoModerationRuleTriggerType.Spam,
  AutoModerationRuleTriggerType.KeywordPreset,
  AutoModerationRuleTriggerType.MentionSpam,
]);

export function timeoutMinutesOf(rule: AutoModerationRule): number {
  const timeout = rule.actions.find((action) => action.type === AutoModerationActionType.Timeout);
  return timeout?.metadata.durationSeconds ? timeout.metadata.durationSeconds / 60 : 0;
}

/** Options left out keep the values of the rule that already exists. */
function withExistingDefaults(feature: AutomodFeature, options: AutomodFeatureOptions, existing: AutoModerationRule | undefined): AutomodFeatureOptions {
  if (!existing) {
    return options;
  }
  const allow = existing.triggerMetadata.allowList.map((entry) => entry.replace(/^\*|\*$/g, ''));
  return {
    allow: options.allow ?? (feature === 'links' ? allow : undefined),
    words: options.words ?? (feature === 'badwords' && existing.triggerMetadata.keywordFilter.length ? [...existing.triggerMetadata.keywordFilter] : undefined),
    limit: options.limit ?? existing.triggerMetadata.mentionTotalLimit ?? undefined,
    timeoutMinutes: options.timeoutMinutes ?? timeoutMinutesOf(existing),
  };
}

export interface AutomodApplyResult {
  created: number;
  updated: number;
  /** Rules of a one-per-server type that existed before and are now managed by Nexo. */
  adopted: number;
  disabled: number;
}

export async function applyFeature(
  guild: Guild,
  feature: AutomodFeature,
  enabled: boolean,
  options: AutomodFeatureOptions,
  settings: AutomodSettings,
  reason: string,
): Promise<AutomodApplyResult> {
  const result: AutomodApplyResult = { created: 0, updated: 0, adopted: 0, disabled: 0 };
  const rules = await guild.autoModerationRules.fetch();
  const names = new Set(buildRules(feature, {}, settings).map((rule) => rule.name));

  if (!enabled) {
    for (const rule of rules.values()) {
      if (names.has(rule.name) && rule.enabled) {
        await rule.edit({ enabled: false, reason });
        result.disabled += 1;
      }
    }
    return result;
  }

  // The custom keyword rule carries the editable settings (allow list, words, limit, timeout).
  const primaryName = feature === 'badwords' ? RULE_NAMES.badwords : [...names][0];
  const resolved = withExistingDefaults(feature, options, rules.find((rule) => rule.name === primaryName));

  for (const payload of buildRules(feature, resolved, settings)) {
    const byName = rules.find((rule) => rule.name === payload.name);
    const existing = byName ?? (SINGLETON_TRIGGERS.has(payload.triggerType) ? rules.find((rule) => rule.triggerType === payload.triggerType) : undefined);

    if (existing) {
      const { triggerType: _triggerType, ...edit } = payload;
      await existing.edit({ ...edit, reason });
      if (byName) {
        result.updated += 1;
      } else {
        result.adopted += 1;
      }
    } else {
      await guild.autoModerationRules.create({ ...payload, reason });
      result.created += 1;
    }
  }
  return result;
}

/** Re-applies alert channel and exemptions to every Nexo rule, keeping block message and timeout. */
export async function applySharedSettings(guild: Guild, settings: AutomodSettings, reason: string): Promise<number> {
  const rules = await guild.autoModerationRules.fetch();
  let updated = 0;
  for (const rule of rules.values()) {
    if (!rule.name.startsWith(RULE_PREFIX)) {
      continue;
    }
    const actions: AutoModerationActionOptions[] = rule.actions
      .filter((action) => action.type !== AutoModerationActionType.SendAlertMessage)
      .map((action) => ({
        type: action.type,
        metadata: {
          customMessage: action.metadata.customMessage ?? undefined,
          durationSeconds: action.metadata.durationSeconds ?? undefined,
        },
      }));
    if (settings.alertChannelId) {
      actions.push({ type: AutoModerationActionType.SendAlertMessage, metadata: { channel: settings.alertChannelId } });
    }
    await rule.edit({
      actions,
      exemptRoles: settings.exemptRoleIds ?? [],
      exemptChannels: settings.exemptChannelIds ?? [],
      reason,
    });
    updated += 1;
  }
  return updated;
}

export function automodSettingsOf(config: GuildConfig | null): AutomodSettings {
  return {
    alertChannelId: config?.automod?.alertChannelId ?? null,
    exemptRoleIds: config?.automod?.exemptRoleIds ?? [],
    exemptChannelIds: config?.automod?.exemptChannelIds ?? [],
  };
}

/** Stores the shared settings and re-applies them to every Nexo rule (used by /automod and the web dashboard). */
export async function saveAutomodSettings(client: NexoClient, guild: Guild, settings: AutomodSettings, userTag: string): Promise<number> {
  await updateGuildConfig(client, guild.id, { automod: settings });
  return applySharedSettings(guild, settings, `AutoMod-Einstellung von ${userTag}`);
}

export async function getNexoRules(guild: Guild): Promise<AutoModerationRule[]> {
  const rules = await guild.autoModerationRules.fetch();
  return [...rules.values()].filter((rule) => rule.name.startsWith(RULE_PREFIX));
}

