// Linked Roles: servers can hand out roles by Nexo values (level, season tier, achievements, chat days, Bernis
// earned). Members link once through the verification URL (/dashboard/linked-role, OAuth2 role_connections.write);
// their tokens are kept encrypted (AES-256-GCM, key from SESSION_SECRET) in user_profiles.settings.linkedRole so
// Nexo can keep the values current: right after linking and then every hour when something changed.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import cron from 'node-cron';
import { Events, type Client } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { refreshTokens, revokeToken, type TokenResponse } from '../../web/discordOAuth.js';
import { T, cosmeticsPool, requirePool } from './db.js';
import { getSeason } from './season.js';

const API = 'https://discord.com/api/v10';

export interface LinkedRolesConfig { clientId: string; clientSecret: string; sessionSecret: string }

/** The five values servers can require (Discord allows at most five). Type 2 = integer greater than or equal. */
export const ROLE_METADATA = [
  { key: 'level', name: 'Höchstes Level', description: 'Dein höchstes Nexo-Level auf einem Server', type: 2 },
  { key: 'season_tier', name: 'Saison-Stufe', description: 'Deine Stufe im Saisonpfad dieses Monats (0–10)', type: 2 },
  { key: 'achievements', name: 'Erfolge', description: 'Anzahl deiner freigeschalteten Nexo-Erfolge', type: 2 },
  { key: 'chat_days', name: 'Chat-Tage', description: 'Tage, an denen du auf Servern mit Nexo geschrieben hast', type: 2 },
  { key: 'bernis', name: 'Verdiente Bernis', description: 'Insgesamt verdiente Bernis in Bronze (10.000 = 1 Gold)', type: 2 },
] as const;
export type RoleValues = Record<(typeof ROLE_METADATA)[number]['key'], number>;

// ---------- Token storage ----------

interface StoredTokens { access: string; refresh: string; expiresAt: number }

const keyFrom = (secret: string) => createHash('sha256').update(`nexo-linked-roles:${secret}`).digest();

export function seal(data: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFrom(secret), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}

export function unseal<T>(text: string, secret: string): T | null {
  try {
    const raw = Buffer.from(text, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')) as T;
  } catch {
    return null;
  }
}

async function readTokens(userId: string, secret: string): Promise<StoredTokens | null> {
  const result = await requirePool().query<{ sealed: string | null }>(`SELECT settings->>'linkedRole' AS sealed FROM ${T.user_profiles} WHERE user_id = $1`, [userId]);
  const sealed = result.rows[0]?.sealed;
  return sealed ? unseal<StoredTokens>(sealed, secret) : null;
}

async function writeTokens(userId: string, tokens: StoredTokens | null, secret: string): Promise<void> {
  if (!tokens) {
    await requirePool().query(`UPDATE ${T.user_profiles} SET settings = settings - 'linkedRole', updated_at = NOW() WHERE user_id = $1`, [userId]);
    return;
  }
  await requirePool().query(
    `INSERT INTO ${T.user_profiles} (user_id, settings, updated_at) VALUES ($1, jsonb_build_object('linkedRole', $2::text), NOW())
     ON CONFLICT (user_id) DO UPDATE SET settings = ${T.user_profiles}.settings || jsonb_build_object('linkedRole', $2::text), updated_at = NOW()`,
    [userId, seal(tokens, secret)],
  );
}

const toStored = (token: TokenResponse, previousRefresh = ''): StoredTokens => ({
  access: token.access_token, refresh: token.refresh_token ?? previousRefresh, expiresAt: Date.now() + token.expires_in * 1000,
});

export async function isLinked(userId: string): Promise<boolean> {
  const result = await requirePool().query(`SELECT 1 FROM ${T.user_profiles} WHERE user_id = $1 AND settings ? 'linkedRole'`, [userId]);
  return Boolean(result.rowCount);
}

// ---------- Values ----------

export async function roleValues(userId: string): Promise<RoleValues> {
  const pool = requirePool();
  const [row, season] = await Promise.all([
    pool.query<{ level: number | null; achievements: string; chat_days: string | null; bernis: string | null }>(
      `SELECT (SELECT MAX(level) FROM ${T.user_levels} WHERE user_id = $1) AS level,
              (SELECT COUNT(*) FROM ${T.user_achievements} WHERE user_id = $1) AS achievements,
              (SELECT value FROM ${T.user_stats} WHERE user_id = $1 AND stat = 'chat_days') AS chat_days,
              (SELECT lifetime_earned FROM ${T.user_wallets} WHERE user_id = $1) AS bernis`,
      [userId],
    ),
    getSeason(userId),
  ]);
  const r = row.rows[0];
  return { level: r?.level ?? 0, season_tier: season.tier, achievements: Number(r?.achievements ?? 0), chat_days: Number(r?.chat_days ?? 0), bernis: Number(r?.bernis ?? 0) };
}

/** Body of the role connection: values as strings, plus a short line Discord shows with the connection. Pure. */
export function connectionBody(values: RoleValues) {
  return {
    platform_name: 'Nexo',
    platform_username: `Level ${values.level} · Saison-Stufe ${values.season_tier} · ${values.achievements} Erfolge`,
    metadata: Object.fromEntries(ROLE_METADATA.map(({ key }) => [key, String(values[key])])),
  };
}

// ---------- Discord calls ----------

const lastPushed = new Map<string, string>();

/** Writes the member's current values to Discord. 'unlinked' when there is no (working) link. */
export async function pushRoleConnection(config: LinkedRolesConfig, userId: string, force = false): Promise<'ok' | 'unchanged' | 'unlinked'> {
  let tokens = await readTokens(userId, config.sessionSecret);
  if (!tokens) return 'unlinked';
  if (tokens.expiresAt < Date.now() + 60_000) {
    try {
      tokens = toStored(await refreshTokens(config, tokens.refresh), tokens.refresh);
      await writeTokens(userId, tokens, config.sessionSecret);
    } catch {
      // Refresh token revoked (member removed the app) – forget the link.
      await writeTokens(userId, null, config.sessionSecret);
      return 'unlinked';
    }
  }
  const body = JSON.stringify(connectionBody(await roleValues(userId)));
  if (!force && lastPushed.get(userId) === body) return 'unchanged';
  const response = await fetch(`${API}/users/@me/applications/${config.clientId}/role-connection`, {
    method: 'PUT', headers: { Authorization: `Bearer ${tokens.access}`, 'Content-Type': 'application/json' }, body,
  });
  if (response.status === 401) {
    await writeTokens(userId, null, config.sessionSecret);
    return 'unlinked';
  }
  if (!response.ok) throw new Error(`role-connection ${response.status}`);
  lastPushed.set(userId, body);
  return 'ok';
}

/** Stores the tokens of a fresh verification and writes the values right away. */
export async function completeLink(config: LinkedRolesConfig, userId: string, token: TokenResponse): Promise<void> {
  await writeTokens(userId, toStored(token), config.sessionSecret);
  await pushRoleConnection(config, userId, true);
}

/** Removes the connection on Discord (roles that need it fall away) and forgets the tokens. */
export async function unlink(config: LinkedRolesConfig, userId: string): Promise<void> {
  const tokens = await readTokens(userId, config.sessionSecret);
  if (tokens) {
    await fetch(`${API}/users/@me/applications/${config.clientId}/role-connection`, { method: 'DELETE', headers: { Authorization: `Bearer ${tokens.access}` } }).catch(() => undefined);
    await revokeToken({ ...config, redirectUri: '' }, tokens.refresh || tokens.access);
  }
  await writeTokens(userId, null, config.sessionSecret);
  lastPushed.delete(userId);
}

export function startLinkedRoles(client: Client, config: LinkedRolesConfig | null): void {
  if (!config || !cosmeticsPool()) return;
  const register = () => {
    client.rest.put(`/applications/${config.clientId}/role-connections/metadata`, { body: ROLE_METADATA })
      .then(() => logger.info('Linked Roles: Nexo-Werte bei Discord registriert.'))
      .catch((error: unknown) => logger.warn('Linked-Roles-Werte nicht registriert:', (error as Error).message));
  };
  if (client.isReady()) register();
  else client.once(Events.ClientReady, register);
  // ponytail: one hourly pass over every linked member, skipping unchanged values; queue it if links reach thousands.
  cron.schedule('17 * * * *', async () => {
    try {
      const linked = await requirePool().query<{ user_id: string }>(`SELECT user_id FROM ${T.user_profiles} WHERE settings ? 'linkedRole'`);
      for (const { user_id: userId } of linked.rows) {
        await pushRoleConnection(config, userId).catch((error: unknown) => logger.warn(`Linked Roles für ${userId} nicht aktualisiert:`, (error as Error).message));
        await new Promise((resolve) => { setTimeout(resolve, 300); });
      }
    } catch (error) {
      logger.warn('Linked-Roles-Abgleich fehlgeschlagen:', (error as Error).message);
    }
  }, { timezone: 'Europe/Berlin' });
}
