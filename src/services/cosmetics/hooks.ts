// Bot-side entry points of the Bernis economy: mini-game rewards, XP/level-up income, counting points and the
// start-up work (catalog seed, monthly payout job). Every hook is best effort and never breaks the command it runs in.

import { randomInt } from 'node:crypto';
import cron from 'node-cron';
import type { Client, EmbedBuilder } from 'discord.js';
import { CURRENCY } from '../../shared/cosmetics.js';
import { formatCoins } from '../../shared/coins.js';
import { logger } from '../../utils/logger.js';
import { addActivity, startActivityTracker } from './activity.js';
import { syncAchievements } from './achievements.js';
import { seedCatalog } from './catalog.js';
import { getEconomyConfig, levelReward } from './config.js';
import { cosmeticsPool } from './db.js';
import { recordMinigamePoints, recordXpGain, runMonthlyPayout } from './rankings.js';
import { earn } from './wallet.js';

const GAME_LABELS = {
  work: 'Arbeiten', fish: 'Angeln', mine: 'Bergbau', gamble: 'Glücksspiel', crime: 'Verbrechen', rob: 'Raub', beg: 'Betteln',
  daily: 'Tägliche Belohnung', fight: 'Duell', flip: 'Münzwurf', roll: 'Würfeln',
} as const;
export type MinigameId = keyof typeof GAME_LABELS;

/** Commands without their own cooldown (flip, roll, fight) must not be farmed: one reward per game and user per window. */
const REWARD_COOLDOWN_MS = 30_000;
const REPLY_WAIT_MS = 1500;
// ponytail: in-memory cooldown per process; good enough with one bot process, the daily cap limits the rest.
const lastReward = new Map<string, number>();

function appendLine(embed: EmbedBuilder, line: string): void {
  const description = embed.data.description ?? '';
  const next = description ? `${description}\n${line}` : line;
  if (next.length <= 4096) embed.setDescription(next);
}

/**
 * Successful mini game: a small random Berni reward (daily cap applies) plus one monthly ranking point, and
 * "+N 🟠 Bernis" appended to the reply embed when the reward arrives in time.
 */
export async function rewardMinigame(embed: EmbedBuilder, user: { id: string; bot: boolean }, guildId: string | null, game: MinigameId): Promise<void> {
  if (user.bot || !cosmeticsPool()) return;
  const key = `${user.id}|${game}`;
  const now = Date.now();
  if (now - (lastReward.get(key) ?? 0) < REWARD_COOLDOWN_MS) return;
  lastReward.set(key, now);
  addActivity(user.id, `game_${game}`);
  if (lastReward.size > 5000) {
    for (const [entry, at] of lastReward) if (now - at >= REWARD_COOLDOWN_MS) lastReward.delete(entry);
  }

  const work = (async () => {
    const { minigameReward } = await getEconomyConfig();
    if (guildId) await recordMinigamePoints(guildId, user.id);
    const amount = minigameReward.max > 0 ? randomInt(minigameReward.min, minigameReward.max + 1) : 0;
    const granted = amount > 0 ? await earn(user.id, amount, 'minigame', `Minispiel: ${GAME_LABELS[game]}`, guildId, { capped: true }) : 0;
    void syncAchievements(user.id);
    return granted;
  })().catch((error: unknown) => {
    logger.warn('Minispiel-Bernis konnten nicht vergeben werden:', (error as Error).message);
    return 0;
  });
  const granted = await Promise.race([work, new Promise<number>((resolve) => { setTimeout(() => resolve(0), REPLY_WAIT_MS).unref(); })]);
  if (granted > 0) appendLine(embed, `+${formatCoins(granted)} ${CURRENCY.name}`);
}

/** XP from messages: monthly activity score and, on level-ups, Bernis (daily cap applies). Callers skip bots. */
/** Records monthly XP and pays the level-up reward; returns the Bernis actually credited (after the daily cap). */
export async function onXpGained(guild: { id: string; name: string }, userId: string, xp: number, fromLevel: number, toLevel: number): Promise<number> {
  if (!cosmeticsPool()) return 0;
  try {
    await recordXpGain(guild.id, userId, xp);
    if (toLevel <= fromLevel) return 0;
    const config = await getEconomyConfig();
    let amount = 0;
    for (let level = fromLevel + 1; level <= toLevel; level += 1) amount += levelReward(config, level);
    const credited = await earn(userId, amount, 'level_up', `Level ${toLevel} auf ${guild.name}`, guild.id, { capped: true });
    await syncAchievements(userId);
    return credited;
  } catch (error) {
    logger.warn('Level-Bernis konnten nicht vergeben werden:', (error as Error).message);
    return 0;
  }
}

/** Counting game: a correct number is one monthly mini-game point (no Bernis, to avoid spam). */
export async function onCountingCorrect(guildId: string, userId: string): Promise<void> {
  try {
    addActivity(userId, 'counting');
    await recordMinigamePoints(guildId, userId);
  } catch (error) {
    logger.warn('Zählspiel-Punkt konnte nicht gespeichert werden:', (error as Error).message);
  }
}

/** Seeds the catalog and schedules the monthly payout (1st, 00:05 Europe/Berlin; repeated on the 2nd and 3rd as an
 * idempotent catch-up in case the bot was offline). */
export async function startCosmetics(client: Client): Promise<void> {
  if (!cosmeticsPool()) {
    logger.info('Berni-Wirtschaft aus: keine PostgreSQL-Datenbank.');
    return;
  }
  try {
    const inserted = await seedCatalog();
    if (inserted > 0) logger.info(`Berni-Shop: ${inserted} neue Katalog-Items angelegt.`);
  } catch (error) {
    logger.error('Berni-Katalog konnte nicht angelegt werden:', error);
  }
  startActivityTracker();
  cron.schedule('5 0 1-3 * *', async () => {
    try {
      await runMonthlyPayout(client);
    } catch (error) {
      logger.error('Monatsranking-Auszahlung fehlgeschlagen:', error);
    }
  }, { timezone: 'Europe/Berlin' });
}
