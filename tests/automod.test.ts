import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AutoModerationActionType,
  AutoModerationRuleTriggerType,
  Collection,
} from 'discord.js';
import type { AutoModerationRule, Guild } from 'discord.js';
import { applyFeature, buildRules, parseList, RULE_NAMES, toAllowEntry } from '../src/services/automodService.js';

test('rule payloads per feature', () => {
  const settings = { alertChannelId: '42', exemptRoleIds: ['7'], exemptChannelIds: [] };

  const [links] = buildRules('links', { allow: ['youtube.com'], timeoutMinutes: 10 }, settings);
  assert.equal(links.triggerType, AutoModerationRuleTriggerType.Keyword);
  assert.deepEqual(links.triggerMetadata?.allowList, ['*youtube.com*']);
  assert.deepEqual(links.actions.map((action) => action.type), [
    AutoModerationActionType.BlockMessage,
    AutoModerationActionType.SendAlertMessage,
    AutoModerationActionType.Timeout,
  ]);
  assert.equal(links.actions[2].metadata?.durationSeconds, 600);
  assert.deepEqual(links.exemptRoles, ['7']);

  // Spam rules do not support timeouts; bad words uses Discord's presets plus a custom keyword rule.
  const [spam] = buildRules('spam', { timeoutMinutes: 10 }, {});
  assert.deepEqual(spam.actions.map((action) => action.type), [AutoModerationActionType.BlockMessage]);
  const badwords = buildRules('badwords', { words: ['blöd'] }, {});
  assert.deepEqual(badwords.map((rule) => rule.triggerType), [AutoModerationRuleTriggerType.KeywordPreset, AutoModerationRuleTriggerType.Keyword]);
  assert.deepEqual(badwords[1].triggerMetadata?.keywordFilter, ['blöd']);

  const [mentions] = buildRules('mentions', { limit: 99 }, {});
  assert.equal(mentions.triggerMetadata?.mentionTotalLimit, 50);
});

test('input helpers', () => {
  assert.equal(toAllowEntry('https://www.YouTube.com/watch?v=1'), '*youtube.com*');
  assert.equal(toAllowEntry('  '), null);
  assert.deepEqual(parseList('a, B,a,\n c'), ['a', 'b', 'c']);
  assert.equal(parseList(null), undefined);
});

/** Minimal stand-in for guild.autoModerationRules that records what Nexo does. */
function fakeGuild(existing: Array<{ name: string; triggerType: AutoModerationRuleTriggerType; enabled?: boolean }>) {
  const calls: string[] = [];
  const rules = new Collection<string, AutoModerationRule>();
  existing.forEach((rule, index) => {
    rules.set(String(index), {
      ...rule,
      enabled: rule.enabled ?? true,
      actions: [],
      triggerMetadata: { allowList: [], keywordFilter: [], regexPatterns: [], presets: [], mentionTotalLimit: null, mentionRaidProtectionEnabled: false },
      edit: async (data: { enabled?: boolean; name?: string }) => { calls.push(`edit ${rule.name} -> ${data.enabled === false ? 'disabled' : data.name}`); },
    } as unknown as AutoModerationRule); // only the fields applyFeature reads
  });
  const guild = {
    autoModerationRules: {
      fetch: async () => rules,
      create: async (data: { name: string }) => { calls.push(`create ${data.name}`); },
    },
  } as unknown as Guild; // only autoModerationRules is used
  return { guild, calls };
}

test('applyFeature creates, adopts one-per-server rules and disables only Nexo rules', async () => {
  const { guild, calls } = fakeGuild([{ name: 'Mein Spamfilter', triggerType: AutoModerationRuleTriggerType.Spam }]);
  const spam = await applyFeature(guild, 'spam', true, {}, {}, 'test');
  assert.deepEqual(spam, { created: 0, updated: 0, adopted: 1, disabled: 0 });
  assert.deepEqual(calls, [`edit Mein Spamfilter -> ${RULE_NAMES.spam}`]);

  const fresh = fakeGuild([]);
  assert.equal((await applyFeature(fresh.guild, 'badwords', true, {}, {}, 'test')).created, 2);

  const off = fakeGuild([
    { name: RULE_NAMES.links, triggerType: AutoModerationRuleTriggerType.Keyword },
    { name: 'Fremde Regel', triggerType: AutoModerationRuleTriggerType.Keyword },
  ]);
  assert.equal((await applyFeature(off.guild, 'links', false, {}, {}, 'test')).disabled, 1);
  assert.deepEqual(off.calls, [`edit ${RULE_NAMES.links} -> disabled`]);
});
