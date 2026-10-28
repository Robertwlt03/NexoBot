import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatChannelName, normalizeConfig, ownedTemporaryChannel, temporaryChannelName, triggerSettings, validateBitrate, validateChannelNameTemplate,
  validateUserLimit,
} from '../src/services/jointocreate/core.js';

const vars = { username: 'jürgen', userTag: 'jürgen#0', displayName: 'Jürgen Ö.', guildName: 'Notizen', channelName: 'Join-to-Create' };
const fails = (fn: () => void) => assert.throws(fn, (error: { userMessage?: string }) => Boolean(error.userMessage));

test('channel names fill every allowed placeholder and keep umlauts', () => {
  assert.equal(formatChannelName('Raum von {username}', vars), 'Raum von jürgen');
  assert.equal(formatChannelName('Raum von {displayName}', vars), 'Raum von Jürgen Ö.');
  assert.equal(formatChannelName('{guild_name} {channelName}', vars), 'Notizen Join-to-Create');
  assert.equal(formatChannelName('{unknown}', vars), 'Sprachraum');
  assert.equal(formatChannelName('x'.repeat(150), vars).length, 100);
});

test('templates without a member placeholder number the channels', () => {
  assert.equal(temporaryChannelName('Lounge von {username}', vars, 3), 'Lounge von jürgen');
  assert.equal(temporaryChannelName('Lounge', vars, 3), 'Join-to-Create 4');
});

test('validation of template, bitrate and user limit', () => {
  assert.doesNotThrow(() => validateChannelNameTemplate('Raum von {displayName}'));
  fails(() => validateChannelNameTemplate('Raum @{username}'));
  fails(() => validateChannelNameTemplate('Raum von {nick}'));
  fails(() => validateChannelNameTemplate(''));
  assert.doesNotThrow(() => validateBitrate(384));
  fails(() => validateBitrate(7));
  fails(() => validateBitrate(Number.NaN));
  assert.doesNotThrow(() => validateUserLimit(0));
  fails(() => validateUserLimit(100));
});

test('config defaults, trigger settings and owned channels', () => {
  const config = normalizeConfig({ triggerChannels: ['t'], channelOptions: { t: { nameTemplate: 'VC von {username}', bitrate: 500_000 } } });
  assert.deepEqual([config.enabled, config.channelNameTemplate, config.bitrate, config.temporaryChannels], [false, 'Raum von {username}', 64_000, {}]);
  assert.deepEqual(triggerSettings(config, 't'), { nameTemplate: 'VC von {username}', userLimit: 0, bitrate: 384_000 });
  assert.deepEqual(triggerSettings(config, 'other'), { nameTemplate: 'Raum von {username}', userLimit: 0, bitrate: 64_000 });
  config.temporaryChannels = { c1: { ownerId: 'u1', triggerChannelId: 't', createdAt: 0 } };
  assert.equal(ownedTemporaryChannel(config, 'u1'), 'c1');
  assert.equal(ownedTemporaryChannel(config, 'u2'), undefined);
});
