// Global Bernis wallet: atomic earn/spend with a row lock per user, the daily cap for level-up and mini-game income,
// the daily bonus with streak and the transaction log. Balances never go negative (CHECK constraint + spend check).

import type pg from 'pg';
import type { DailyBonusState, TransactionPage, WalletSummary, WalletTransaction } from '../../web/dto/profile.js';
import { HttpError } from '../../web/http.js';
import { T, requirePool, withTx, type Queryable } from './db.js';
import { dailyBonusAmount, getEconomyConfig } from './config.js';
import { berlinDay, nextBerlinMidnight, shiftDay } from './time.js';
import type { EconomyConfig } from '../../web/dto/profile.js';

interface WalletRow {
  balance: string; lifetime_earned: string; daily_earned: number; daily_day: string | null; daily_streak: number; last_daily_claim: string | null;
}

const WALLET_COLUMNS = `balance, lifetime_earned, daily_earned, to_char(daily_day, 'YYYY-MM-DD') AS daily_day, daily_streak,
  to_char(last_daily_claim, 'YYYY-MM-DD') AS last_daily_claim`;

/** Locks (and creates) the user's wallet row inside a transaction. */
async function lockWallet(client: pg.PoolClient, userId: string): Promise<WalletRow> {
  await client.query(`INSERT INTO ${T.user_wallets} (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
  const result = await client.query<WalletRow>(`SELECT ${WALLET_COLUMNS} FROM ${T.user_wallets} WHERE user_id = $1 FOR UPDATE`, [userId]);
  return result.rows[0];
}

export interface TxMeta { [key: string]: string | number | null }

async function logTransaction(client: Queryable, userId: string, amount: number, reason: string, label: string, guildId: string | null, meta: TxMeta | null = null) {
  await client.query(
    `INSERT INTO ${T.wallet_transactions} (user_id, amount, reason, label, guild_id, meta) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [userId, amount, reason, label.slice(0, 200), guildId, meta ? JSON.stringify(meta) : null],
  );
}

/** How much of `amount` still fits under the daily cap (capped income only). */
export function cappedGrant(amount: number, earnedToday: number, cap: number): number {
  return Math.max(0, Math.min(amount, cap - earnedToday));
}

export interface EarnOptions { capped?: boolean; meta?: TxMeta }

/** Earn inside an existing transaction. Returns the amount actually credited (0 when the daily cap is reached). */
export async function earnTx(client: pg.PoolClient, userId: string, amount: number, reason: string, label: string, guildId: string | null, options: EarnOptions = {}, config?: EconomyConfig): Promise<number> {
  if (!Number.isInteger(amount) || amount <= 0) return 0;
  const wallet = await lockWallet(client, userId);
  const today = berlinDay();
  const earnedToday = wallet.daily_day === today ? wallet.daily_earned : 0;
  const grant = options.capped ? cappedGrant(amount, earnedToday, (config ?? await getEconomyConfig()).dailyEarnCap) : amount;
  if (grant <= 0) return 0;
  await client.query(
    `UPDATE ${T.user_wallets} SET balance = balance + $2, lifetime_earned = lifetime_earned + $2,
       daily_earned = $3, daily_day = $4::date, updated_at = NOW() WHERE user_id = $1`,
    [userId, grant, options.capped ? earnedToday + grant : earnedToday, today],
  );
  await logTransaction(client, userId, grant, reason, label, guildId, options.meta ?? null);
  return grant;
}

export async function earn(userId: string, amount: number, reason: string, label: string, guildId: string | null, options: EarnOptions = {}): Promise<number> {
  const config = await getEconomyConfig();
  return withTx((client) => earnTx(client, userId, amount, reason, label, guildId, options, config));
}

/** Spend inside an existing transaction; throws 400 when the balance is too low. */
export async function spendTx(client: pg.PoolClient, userId: string, amount: number, reason: string, label: string, meta: TxMeta | null = null): Promise<void> {
  const wallet = await lockWallet(client, userId);
  if (Number(wallet.balance) < amount) {
    throw new HttpError(400, `Dafür reichen deine Bernis nicht (${Number(wallet.balance).toLocaleString('de-DE')} von ${amount.toLocaleString('de-DE')}).`);
  }
  await client.query(`UPDATE ${T.user_wallets} SET balance = balance - $2, updated_at = NOW() WHERE user_id = $1`, [userId, amount]);
  await logTransaction(client, userId, -amount, reason, label, null, meta);
}

/** A zero-amount log entry (e.g. a received gift). */
export async function noteTx(client: pg.PoolClient, userId: string, reason: string, label: string, meta: TxMeta | null = null): Promise<void> {
  await logTransaction(client, userId, 0, reason, label, null, meta);
}

async function readWallet(client: Queryable, userId: string): Promise<WalletRow | null> {
  const result = await client.query<WalletRow>(`SELECT ${WALLET_COLUMNS} FROM ${T.user_wallets} WHERE user_id = $1`, [userId]);
  return result.rows[0] ?? null;
}

export async function walletSummary(userId: string, client: Queryable = requirePool()): Promise<WalletSummary> {
  const [wallet, config] = await Promise.all([readWallet(client, userId), getEconomyConfig()]);
  return {
    balance: Number(wallet?.balance ?? 0),
    lifetimeEarned: Number(wallet?.lifetime_earned ?? 0),
    todayEarned: wallet && wallet.daily_day === berlinDay() ? wallet.daily_earned : 0,
    dailyCap: config.dailyEarnCap,
  };
}

// ---------- Daily bonus ----------

/** Daily bonus state from the stored streak and last claim day (Berlin days). A missed day resets the streak. */
export function dailyState(lastClaim: string | null, storedStreak: number, today: string, config: EconomyConfig, now: Date = new Date()): DailyBonusState & { claimStreak: number } {
  const claimedToday = lastClaim === today;
  const continues = lastClaim === shiftDay(today, -1);
  const streak = claimedToday || continues ? storedStreak : 0;
  const claimStreak = claimedToday ? storedStreak + 1 : streak + 1;
  return {
    available: !claimedToday,
    streak,
    nextAmount: dailyBonusAmount(config, claimStreak),
    nextAt: claimedToday ? nextBerlinMidnight(now).toISOString() : null,
    claimStreak,
  };
}

export async function getDailyState(userId: string): Promise<DailyBonusState> {
  const [wallet, config] = await Promise.all([readWallet(requirePool(), userId), getEconomyConfig()]);
  const { claimStreak: _unused, ...state } = dailyState(wallet?.last_daily_claim ?? null, wallet?.daily_streak ?? 0, berlinDay(), config);
  return state;
}

/** Claims today's bonus (not capped). Throws 409 when it was already claimed today. */
export async function claimDaily(userId: string): Promise<{ claimed: number; streak: number }> {
  const config = await getEconomyConfig();
  return withTx(async (client) => {
    const wallet = await lockWallet(client, userId);
    const today = berlinDay();
    const state = dailyState(wallet.last_daily_claim, wallet.daily_streak, today, config);
    if (!state.available) throw new HttpError(409, 'Du hast deinen Tagesbonus heute schon abgeholt.');
    await client.query(
      `UPDATE ${T.user_wallets} SET balance = balance + $2, lifetime_earned = lifetime_earned + $2, daily_streak = $3,
         last_daily_claim = $4::date, updated_at = NOW() WHERE user_id = $1`,
      [userId, state.nextAmount, state.claimStreak, today],
    );
    await logTransaction(client, userId, state.nextAmount, 'daily', `Tagesbonus (Serie: ${state.claimStreak} ${state.claimStreak === 1 ? 'Tag' : 'Tage'})`, null);
    return { claimed: state.nextAmount, streak: state.claimStreak };
  });
}

// ---------- Transactions ----------

const PAGE_SIZE = 20;

export async function listTransactions(userId: string, page: number, guildName: (guildId: string) => string | null): Promise<TransactionPage> {
  const pool = requirePool();
  const [count, rows] = await Promise.all([
    pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM ${T.wallet_transactions} WHERE user_id = $1`, [userId]),
    pool.query<{ id: string; amount: string; reason: string; label: string; guild_id: string | null; created_at: Date }>(
      `SELECT id, amount, reason, label, guild_id, created_at FROM ${T.wallet_transactions}
       WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
      [userId, PAGE_SIZE, (page - 1) * PAGE_SIZE],
    ),
  ]);
  const items: WalletTransaction[] = rows.rows.map((row) => ({
    id: String(row.id),
    amount: Number(row.amount),
    reason: row.reason,
    label: row.label,
    guildName: row.guild_id ? guildName(row.guild_id) : null,
    createdAt: row.created_at.toISOString(),
  }));
  return { items, page, pages: Math.max(1, Math.ceil(Number(count.rows[0].total) / PAGE_SIZE)) };
}
