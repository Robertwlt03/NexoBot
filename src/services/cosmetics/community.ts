// Community goals: while a shop event runs, every server works towards one goal together – a number of messages,
// scaled to how active the server was in the four weeks before the event. Each member's share is a user_stats row
// `ev:<event>:<startDay>:<guild>`; once the server reaches the goal, everyone who wrote at least COMMUNITY_MINIMUM
// messages gets COMMUNITY_REWARD once (marker `evpaid:...`), a step towards the Teamgeist achievements, and the
// server gets a short announcement.

import type { Client } from 'discord.js';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { formatCoins } from '../../shared/coins.js';
import type { CommunityGoal, ShopEvent } from '../../web/dto/profile.js';
import { logger } from '../../utils/logger.js';
import { createEmbed } from '../../utils/embeds.js';
import { T, cosmeticsPool, requirePool, withTx } from './db.js';
import { loadStoredEvents, runningEvents } from './events.js';
import { berlinDay, shiftDay } from './time.js';
import { earnTx } from './wallet.js';

export const COMMUNITY_REWARD = 150;
export const COMMUNITY_MINIMUM = 5;

const eventKey = (event: ShopEvent) => `${event.id}:${berlinDay(new Date(event.startsAt))}`;
export const communityStat = (event: ShopEvent, guildId: string) => `ev:${eventKey(event)}:${guildId}`;
const paidStat = (stat: string) => `evpaid:${stat.slice(3)}`;

// ---------- Running events, cached for the message hot path ----------

let cached: { events: ShopEvent[]; at: number } = { events: [], at: 0 };
let refreshing = false;

function refreshEvents(): void {
  if (refreshing || !cosmeticsPool()) return;
  refreshing = true;
  loadStoredEvents()
    .then((stored) => { cached = { events: runningEvents(new Date(), stored), at: Date.now() }; })
    .catch((error: unknown) => logger.warn('Events für Gemeinschaftsziele nicht geladen:', (error as Error).message))
    .finally(() => { refreshing = false; });
}

/** The community stats a message in `guildId` counts towards (uses the cached running events, refreshed each minute). */
export function communityStatsFor(guildId: string, now = Date.now()): string[] {
  if (now - cached.at > 60_000) refreshEvents();
  return cached.events.filter((event) => Date.parse(event.startsAt) <= now && now < Date.parse(event.endsAt)).map((event) => communityStat(event, guildId));
}

// ---------- Goal size ----------

/** Messages to reach: three quarters of the server's usual pace over the event, rounded to 50. Pure, for tests. */
export function goalTarget(messagesBefore: number, daysMeasured: number, eventDays: number): number {
  const perDay = daysMeasured >= 7 ? messagesBefore / daysMeasured : 40;
  return Math.min(100_000, Math.max(150, Math.round((perDay * eventDays * 0.75) / 50) * 50));
}

const targets = new Map<string, number>();

async function targetFor(event: ShopEvent, guildId: string): Promise<number> {
  const key = `${eventKey(event)}:${guildId}`;
  const known = targets.get(key);
  if (known) return known;
  const start = berlinDay(new Date(event.startsAt));
  const result = await requirePool().query<{ messages: string; days: string }>(
    `SELECT COALESCE(SUM(messages), 0) AS messages, COUNT(*) AS days FROM ${T.guild_daily_stats}
     WHERE guild_id = $1 AND day >= $2::date AND day < $3::date`,
    [guildId, shiftDay(start, -28), start],
  );
  const eventDays = Math.max(1, Math.round((Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 86_400_000));
  const target = goalTarget(Number(result.rows[0].messages), Number(result.rows[0].days), eventDays);
  targets.set(key, target);
  return target;
}

// ponytail: SUM over user_stats by stat scans the table; add an index on (stat) if user_stats grows into the millions.
async function progressOf(stat: string): Promise<number> {
  const result = await requirePool().query<{ total: string }>(`SELECT COALESCE(SUM(value), 0) AS total FROM ${T.user_stats} WHERE stat = $1`, [stat]);
  return Number(result.rows[0].total);
}

// ---------- Payout ----------

let client: Client | null = null;
export function setCommunityClient(next: Client): void { client = next; }

async function announce(guildId: string, event: ShopEvent, target: number, paid: number): Promise<void> {
  const guild = client?.guilds.cache.get(guildId);
  const channel = guild?.systemChannel;
  const me = guild?.members.me;
  if (!channel || channel.type !== ChannelType.GuildText || !me || !channel.permissionsFor(me).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) return;
  await channel.send({ embeds: [createEmbed({
    title: `🎉 Gemeinschaftsziel geschafft: ${event.name}`,
    description: `Zusammen habt ihr **${target.toLocaleString('de-DE')} Nachrichten** geschrieben! ${paid} ${paid === 1 ? 'Mitglied bekommt' : 'Mitglieder bekommen'} je ${formatCoins(COMMUNITY_REWARD)}.\n`
      + `Wer bis zum Event-Ende noch ${COMMUNITY_MINIMUM} Nachrichten schreibt, bekommt die Belohnung auch.`,
  })] }).catch(() => undefined);
}

/** Pays everyone who helped once a touched goal is reached (called after each activity flush). Never throws. */
export async function syncCommunity(stats: Iterable<string>): Promise<void> {
  if (!cosmeticsPool()) return;
  const now = Date.now();
  for (const stat of new Set(stats)) {
    try {
      const [, eventId, startDay, guildId] = stat.split(':');
      const event = cached.events.find((entry) => entry.id === eventId && berlinDay(new Date(entry.startsAt)) === startDay);
      if (!event || now >= Date.parse(event.endsAt)) continue;
      const target = await targetFor(event, guildId);
      if (await progressOf(stat) < target) continue;
      const result = await requirePool().query<{ user_id: string }>(
        `SELECT s.user_id FROM ${T.user_stats} s WHERE s.stat = $1 AND s.value >= $2
         AND NOT EXISTS (SELECT 1 FROM ${T.user_stats} p WHERE p.user_id = s.user_id AND p.stat = $3)`,
        [stat, COMMUNITY_MINIMUM, paidStat(stat)],
      );
      if (!result.rows.length) continue;
      const first = !(await requirePool().query(`SELECT 1 FROM ${T.user_stats} WHERE stat = $1 LIMIT 1`, [paidStat(stat)])).rowCount;
      let paid = 0;
      for (const { user_id: userId } of result.rows) {
        const done = await withTx(async (tx) => {
          const marked = await tx.query(`INSERT INTO ${T.user_stats} (user_id, stat, value) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING`, [userId, paidStat(stat)]);
          if (!marked.rowCount) return false;
          await earnTx(tx, userId, COMMUNITY_REWARD, 'community_goal', `Gemeinschaftsziel: ${event.name}`, guildId);
          await tx.query(
            `INSERT INTO ${T.user_stats} AS s (user_id, stat, value) VALUES ($1, 'community_goals', 1)
             ON CONFLICT (user_id, stat) DO UPDATE SET value = s.value + 1`, [userId],
          );
          return true;
        });
        if (done) paid += 1;
      }
      if (first && paid) await announce(guildId, event, target, paid);
    } catch (error) {
      logger.warn('Gemeinschaftsziel konnte nicht geprüft werden:', (error as Error).message);
    }
  }
}

// ---------- Member view ----------

/** Goals of the running events on the given servers, with the member's own share. */
export async function communityGoals(userId: string, guilds: { id: string; name: string; iconUrl: string | null }[], pending: Map<string, number> = new Map()): Promise<CommunityGoal[]> {
  const events = runningEvents(new Date(), await loadStoredEvents());
  const goals: CommunityGoal[] = [];
  for (const event of events) {
    for (const guild of guilds) {
      const stat = communityStat(event, guild.id);
      const [target, progress, mine] = await Promise.all([
        targetFor(event, guild.id),
        progressOf(stat),
        requirePool().query<{ stat: string; value: string }>(`SELECT stat, value FROM ${T.user_stats} WHERE user_id = $1 AND stat = ANY($2::text[])`, [userId, [stat, paidStat(stat)]]),
      ]);
      const own = Number(mine.rows.find((row) => row.stat === stat)?.value ?? 0) + (pending.get(stat) ?? 0);
      goals.push({
        eventId: event.id, eventName: event.name, endsAt: event.endsAt, guildId: guild.id, guildName: guild.name, guildIconUrl: guild.iconUrl,
        progress: progress + (pending.get(stat) ?? 0), target, mine: own, minimum: COMMUNITY_MINIMUM, reward: COMMUNITY_REWARD,
        paid: mine.rows.some((row) => row.stat === paidStat(stat)),
      });
    }
  }
  return goals;
}
