// Opt-in reminders by DM: once a day at 19:00 (Berlin) Nexo reminds members who switched them on about an unclaimed
// daily bonus (and the streak that would end at midnight) and unfinished daily quests. Stored as
// user_profiles.settings.reminders; a member whose DMs are closed is switched off so we stop trying.

import cron from 'node-cron';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type Client } from 'discord.js';
import { formatCoins } from '../../shared/coins.js';
import { logger } from '../../utils/logger.js';
import { createEmbed } from '../../utils/embeds.js';
import { publicDashboardUrl } from '../../web/dashboard.js';
import { getEconomyConfig } from './config.js';
import { T, cosmeticsPool, requirePool } from './db.js';
import { getDailyQuests } from './quests.js';
import { berlinDay } from './time.js';
import { dailyState } from './wallet.js';

export async function readReminders(userId: string): Promise<boolean> {
  const result = await requirePool().query<{ on: boolean | null }>(
    `SELECT (settings->>'reminders')::boolean AS on FROM ${T.user_profiles} WHERE user_id = $1`, [userId],
  );
  return result.rows[0]?.on === true;
}

export async function writeReminders(userId: string, on: boolean): Promise<boolean> {
  await requirePool().query(
    `INSERT INTO ${T.user_profiles} (user_id, settings, updated_at) VALUES ($1, jsonb_build_object('reminders', $2::boolean), NOW())
     ON CONFLICT (user_id) DO UPDATE SET settings = ${T.user_profiles}.settings || jsonb_build_object('reminders', $2::boolean), updated_at = NOW()`,
    [userId, on],
  );
  return on;
}

/** The reminder text, or null when there is nothing left to do today. Pure, for tests. */
export function reminderLines(daily: { available: boolean; streak: number; nextAmount: number; shields?: number }, openQuests: { label: string }[]): string[] | null {
  const lines: string[] = [];
  if (daily.available) {
    lines.push(daily.streak >= 2 && !daily.shields
      ? `🔥 Deine Serie von **${daily.streak} Tagen** endet um Mitternacht – hol dir heute noch deinen Tagesbonus (${formatCoins(daily.nextAmount)}).`
      : `🎁 Dein Tagesbonus wartet: ${formatCoins(daily.nextAmount)}.`);
  }
  if (openQuests.length) lines.push(`📋 Noch offen: ${openQuests.map((quest) => quest.label).join(' · ')}`);
  return lines.length ? lines : null;
}

export async function sendReminders(client: Client): Promise<number> {
  const pool = cosmeticsPool();
  if (!pool) return 0;
  const [result, config] = await Promise.all([
    pool.query<{ user_id: string; daily_streak: number | null; last_daily_claim: string | null; shields: string | null }>(
      `SELECT p.user_id, w.daily_streak, to_char(w.last_daily_claim, 'YYYY-MM-DD') AS last_daily_claim, s.value AS shields
       FROM ${T.user_profiles} p LEFT JOIN ${T.user_wallets} w ON w.user_id = p.user_id
       LEFT JOIN ${T.user_stats} s ON s.user_id = p.user_id AND s.stat = 'streak_shields'
       WHERE p.settings->>'reminders' = 'true'`,
    ),
    getEconomyConfig(),
  ]);
  const url = publicDashboardUrl();
  const today = berlinDay();
  let sent = 0;
  // ponytail: sequential DMs with a short pause; fine for hundreds of opt-ins, queue them if it ever gets thousands.
  for (const row of result.rows) {
    try {
      const daily = dailyState(row.last_daily_claim, row.daily_streak ?? 0, today, config, new Date(), Number(row.shields ?? 0));
      const { quests } = await getDailyQuests(row.user_id);
      const lines = reminderLines(daily, quests.filter((quest) => !quest.done));
      if (!lines) continue;
      const user = await client.users.fetch(row.user_id);
      await user.send({
        embeds: [createEmbed({ title: 'Kurze Erinnerung von Nexo', description: `${lines.join('\n')}\n\n-# Ausschalten: /profil erinnerung oder im Dashboard beim Tagesbonus.` })],
        components: url ? [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Zum Tagesbonus').setURL(`${url}/me`))] : [],
      });
      sent += 1;
      await new Promise((resolve) => { setTimeout(resolve, 250); });
    } catch (error) {
      // 50007: the member does not accept DMs from us – stop reminding them.
      if ((error as { code?: number }).code === 50007) await writeReminders(row.user_id, false).catch(() => undefined);
      else logger.warn(`Erinnerung an ${row.user_id} fehlgeschlagen:`, (error as Error).message);
    }
  }
  return sent;
}

export function startReminders(client: Client): void {
  cron.schedule('0 19 * * *', async () => {
    try {
      const sent = await sendReminders(client);
      if (sent) logger.info(`Erinnerungen verschickt: ${sent}`);
    } catch (error) {
      logger.error('Erinnerungen fehlgeschlagen:', error);
    }
  }, { timezone: 'Europe/Berlin' });
}
