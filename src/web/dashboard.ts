// Web dashboard: Discord login, guild access checks, JSON API and the static frontend (built to dist/dashboard).

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOTIFS, renderBanner, type BannerMotif } from '../services/bannerArt.js';
import express from 'express';
import type { NextFunction, Request, Response, Router } from 'express';
import { PermissionFlagsBits } from 'discord.js';
import type { Guild, GuildMember } from 'discord.js';
import type { NexoClient } from '../types/index.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  authorizeUrl, exchangeCode, exchangeCodeForTokens, fetchUser, fetchUserGuilds, guildIconUrl, linkedRoleAuthorizeUrl, revokeToken, userAvatarUrl,
  type OAuthConfig,
} from './discordOAuth.js';
import { completeLink, type LinkedRolesConfig } from '../services/cosmetics/linkedRoles.js';
import {
  SESSION_COOKIE, SESSION_TTL_SECONDS, STATE_COOKIE, deleteSession, loadSession, randomToken,
  readSignedCookie, saveSession, setCookie, setSignedCookie, type DashboardSession,
} from './session.js';
import type { ApiGuildDetail, ApiGuildSummary, ApiUser } from './apiTypes.js';
import { dashboardModules } from './modules/index.js';
import { meRouter } from './modules/me.js';
import { ownerRouter } from './modules/owner.js';
import { HttpError, isHiddenChannel } from './http.js';
import { ErrorTypes, NexoBotError } from '../utils/errorHandler.js';
import type { ErrorType } from '../utils/errorHandler.js';
import { publicProfileRouter } from './publicProfile.js';
import { isSnowflake } from '../utils/validation.js';

const CLIENT_ERRORS: ErrorType[] = [ErrorTypes.VALIDATION, ErrorTypes.USER_INPUT, ErrorTypes.CONFIGURATION, ErrorTypes.PERMISSION, ErrorTypes.RATE_LIMIT];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUILD_REFRESH_MS = 60_000;
export const CSRF_HEADER = 'x-nexo-dashboard';


export interface DashboardLocals {
  session: DashboardSession;
  guild: Guild;
  member: GuildMember;
}

/** Typed access to what the auth middlewares put on res.locals. */
export function locals(res: Response): DashboardLocals {
  return res.locals as DashboardLocals;
}

export function sendError(res: Response, status: number, message: string) {
  res.status(status).json({ error: message });
}

interface DashboardConfig extends OAuthConfig {
  sessionSecret: string;
  baseUrl: string;
  secureCookies: boolean;
}

function readConfig(): DashboardConfig | null {
  const env = getEnv();
  if (!env.CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET) {
    return null;
  }
  const baseUrl = (env.DASHBOARD_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, '');
  return {
    clientId: env.CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    sessionSecret: env.SESSION_SECRET,
    redirectUri: `${baseUrl}/dashboard/auth/callback`,
    baseUrl,
    secureCookies: baseUrl.startsWith('https://'),
  };
}

function frontendDir(): string | null {
  // dist/web -> dist/dashboard (production); src/web -> dist/dashboard (tsx dev after a frontend build)
  const candidates = [path.join(__dirname, '../dashboard'), path.join(__dirname, '../../dist/dashboard')];
  return candidates.find((dir) => existsSync(path.join(dir, 'index.html'))) ?? null;
}


/** The guild arrives over the gateway shortly after the invite; wait up to ~5 s for it. */
async function waitForGuild(client: NexoClient, guildId: string): Promise<boolean> {
  for (let i = 0; i < 20 && !client.guilds.cache.has(guildId); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return client.guilds.cache.has(guildId);
}

/** OAuth credentials for the linked-roles sync (null when the dashboard is not configured). */
export function linkedRolesConfig(): LinkedRolesConfig | null {
  const config = readConfig();
  return config ? { clientId: config.clientId, clientSecret: config.clientSecret, sessionSecret: config.sessionSecret } : null;
}

/** Small standalone page for the end of the linked-roles flow (it opens from Discord, outside the dashboard app). */
function linkedRolePage(title: string, text: string, ok: boolean): string {
  const color = ok ? '#8FB36B' : '#F59E0B';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nexo · ${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#16130f;color:#efe8dd;font-family:system-ui,sans-serif;padding:16px}
main{max-width:440px;border:1px solid #ffffff14;border-left:4px solid ${color};border-radius:18px;background:#211c17;padding:24px 26px}
h1{font-size:22px;margin:0 0 10px}p{margin:0 0 10px;line-height:1.5;color:#cfc4b6}a{color:${color}}</style></head>
<body><main><h1>${title}</h1><p>${text}</p><p><a href="/dashboard/me">Zu deinem Nexo-Profil</a></p></main></body></html>`;
}

/** Public dashboard address for links in Discord (help, etc.), or null when the dashboard is off. */
export function publicDashboardUrl(): string | null {
  const config = readConfig();
  return config ? `${config.baseUrl}/dashboard` : null;
}

function canManage(guild: { owner: boolean; permissions: string }): boolean {
  const permissions = BigInt(guild.permissions);
  return guild.owner
    || (permissions & PermissionFlagsBits.Administrator) !== 0n
    || (permissions & PermissionFlagsBits.ManageGuild) !== 0n;
}

/** Simple fixed-window limiter per IP for the dashboard (the global API limiter is too strict for an app). */
function rateLimit(maxPerMinute: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    entry.count += 1;
    return entry.count > maxPerMinute ? sendError(res, 429, 'Zu viele Anfragen. Bitte warte kurz.') : next();
  };
}

export function createDashboardRouter(client: NexoClient): Router {
  const router = express.Router();
  const config = readConfig();
  const staticDir = frontendDir();

  if (!config) {
    logger.info('Dashboard disabled (set CLIENT_ID, DISCORD_CLIENT_SECRET and SESSION_SECRET to enable it).');
    router.use((_req, res) => sendError(res, 503, 'Das Dashboard ist auf diesem Bot nicht eingerichtet.'));
    return router;
  }
  logger.info(`Dashboard enabled at ${config.baseUrl}/dashboard`);

  router.use(rateLimit(300));
  router.use(express.json({ limit: '256kb' }));

  // ---------- Auth ----------
  router.get('/auth/login', (_req, res) => {
    const state = randomToken();
    setSignedCookie(res, STATE_COOKIE, state, config.sessionSecret, { maxAgeSeconds: 600, secure: config.secureCookies });
    res.redirect(authorizeUrl(config, state));
  });

  // Invite Nexo and log in at once; `?guild=` preselects the server.
  router.get('/auth/invite', (req, res) => {
    const guildId = isSnowflake(req.query.guild) ? req.query.guild : undefined;
    const state = randomToken();
    setSignedCookie(res, STATE_COOKIE, state, config.sessionSecret, { maxAgeSeconds: 600, secure: config.secureCookies });
    res.redirect(authorizeUrl(config, state, { guildId }));
  });

  // Linked Roles verification URL (set it in the Developer Portal): Discord sends members here from the role settings.
  router.get('/linked-role', (_req, res) => {
    const state = `lr.${randomToken()}`;
    setSignedCookie(res, STATE_COOKIE, state, config.sessionSecret, { maxAgeSeconds: 600, secure: config.secureCookies });
    res.redirect(linkedRoleAuthorizeUrl(config, state));
  });

  router.get('/auth/callback', async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : null;
    const state = typeof req.query.state === 'string' ? req.query.state : null;
    const expectedState = readSignedCookie(req, STATE_COOKIE, config.sessionSecret);
    setCookie(res, STATE_COOKIE, '', { maxAgeSeconds: 0, secure: config.secureCookies });

    // Same redirect URI as the login; the state prefix marks the linked-roles flow.
    if (state?.startsWith('lr.')) {
      if (!code || state !== expectedState) {
        return res.status(400).type('html').send(linkedRolePage('Das hat nicht geklappt', 'Der Link ist abgelaufen. Starte die Verknüpfung in Discord einfach noch einmal.', false));
      }
      try {
        const token = await exchangeCodeForTokens(config, code);
        const user = await fetchUser(token.access_token);
        await completeLink(linkedRolesConfig()!, user.id, token);
        logger.info('Linked role connected', { userId: user.id });
        return res.type('html').send(linkedRolePage('Verknüpft!', 'Deine Nexo-Werte sind jetzt mit Discord verbunden. Schließ dieses Fenster – in Discord bekommst du die passenden Rollen, sobald du die Bedingungen erfüllst. Nexo hält die Werte stündlich aktuell.', true));
      } catch (error) {
        logger.warn('Linked role connection failed:', error);
        return res.status(500).type('html').send(linkedRolePage('Das hat nicht geklappt', 'Discord hat die Verknüpfung nicht bestätigt. Versuch es in ein paar Minuten noch einmal.', false));
      }
    }

    if (!code || !state || state !== expectedState) {
      return res.redirect('/dashboard/?error=login');
    }

    try {
      const accessToken = await exchangeCode(config, code);
      const [user, guilds] = await Promise.all([fetchUser(accessToken), fetchUserGuilds(accessToken)]);
      const session: DashboardSession = {
        id: randomToken(32),
        userId: user.id,
        username: user.username,
        globalName: user.global_name,
        avatar: user.avatar,
        accessToken,
        guilds,
        guildsFetchedAt: Date.now(),
      };
      await saveSession(session);
      setSignedCookie(res, SESSION_COOKIE, session.id, config.sessionSecret, { maxAgeSeconds: SESSION_TTL_SECONDS, secure: config.secureCookies });
      logger.info('Dashboard login', { userId: user.id });
      // After an invite Discord sends the chosen server; open it once the bot has received the guild.
      const invitedGuild = isSnowflake(req.query.guild_id) ? req.query.guild_id : null;
      if (invitedGuild && await waitForGuild(client, invitedGuild)) {
        return res.redirect(`/dashboard/servers/${invitedGuild}`);
      }
      return res.redirect('/dashboard/servers');
    } catch (error) {
      logger.warn('Dashboard login failed:', error);
      return res.redirect('/dashboard/?error=login');
    }
  });

  router.post('/auth/logout', async (req, res) => {
    const sessionId = readSignedCookie(req, SESSION_COOKIE, config.sessionSecret);
    const session = sessionId ? await loadSession(sessionId) : null;
    if (session) {
      await revokeToken(config, session.accessToken);
      await deleteSession(session.id);
    }
    setCookie(res, SESSION_COOKIE, '', { maxAgeSeconds: 0, secure: config.secureCookies });
    res.json({ ok: true });
  });

  // ---------- API ----------
  const api = express.Router();

  api.use(async (req, res, next) => {
    // Custom header: browsers do not send it cross-site without CORS, which blocks CSRF on mutations.
    if (req.method !== 'GET' && req.get(CSRF_HEADER) !== '1') {
      return sendError(res, 403, 'Ungültige Anfrage.');
    }
    const sessionId = readSignedCookie(req, SESSION_COOKIE, config.sessionSecret);
    const session = sessionId ? await loadSession(sessionId) : null;
    if (!session) {
      return sendError(res, 401, 'Bitte melde dich an.');
    }
    res.locals.session = session;
    return next();
  });

  api.get('/me', (_req, res) => {
    const { session } = locals(res);
    const user: ApiUser = {
      id: session.userId,
      username: session.username,
      globalName: session.globalName,
      avatarUrl: userAvatarUrl({ id: session.userId, avatar: session.avatar }),
    };
    res.json(user);
  });

  api.get('/guilds', async (req, res) => {
    const { session } = locals(res);
    if (req.query.refresh === '1' || Date.now() - session.guildsFetchedAt > GUILD_REFRESH_MS * 5) {
      try {
        session.guilds = await fetchUserGuilds(session.accessToken);
        session.guildsFetchedAt = Date.now();
        await saveSession(session);
      } catch (error) {
        logger.warn('Dashboard guild refresh failed:', error);
      }
    }

    const guilds: ApiGuildSummary[] = session.guilds
      .filter(canManage)
      .map((guild) => {
        const botPresent = client.guilds.cache.has(guild.id);
        return {
          id: guild.id,
          name: guild.name,
          iconUrl: guildIconUrl(guild),
          botPresent,
          inviteUrl: botPresent ? null : `/dashboard/auth/invite?guild=${guild.id}`,
        };
      })
      .sort((a, b) => Number(b.botPresent) - Number(a.botPresent) || a.name.localeCompare(b.name));
    res.json(guilds);
  });

  // Guild routes: live permission check through the bot (the OAuth snapshot can be outdated).
  const guildRouter = express.Router({ mergeParams: true });
  guildRouter.use(async (req: Request<{ guildId: string }>, res, next) => {
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) {
      return sendError(res, 404, 'Nexo ist nicht auf diesem Server.');
    }
    const member = await guild.members.fetch(locals(res).session.userId).catch(() => null);
    if (!member || !(guild.ownerId === member.id || member.permissions.has(PermissionFlagsBits.ManageGuild))) {
      return sendError(res, 403, 'Du brauchst die Berechtigung „Server verwalten“ auf diesem Server.');
    }
    res.locals.guild = guild;
    res.locals.member = member;
    return next();
  });

  guildRouter.get('/', async (_req, res) => {
    const { guild } = locals(res);
    const me = guild.members.me ?? await guild.members.fetchMe();
    const detail: ApiGuildDetail = {
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconURL({ size: 128 }),
      memberCount: guild.memberCount,
      channels: [...guild.channels.cache.values()]
        .filter((channel) => !channel.isThread() && !isHiddenChannel(channel))
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          parentId: channel.parentId,
          position: 'rawPosition' in channel ? channel.rawPosition : 0,
        }))
        .sort((a, b) => a.position - b.position),
      roles: [...guild.roles.cache.values()]
        .filter((role) => role.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((role) => ({
          id: role.id,
          name: role.name,
          color: role.hexColor,
          position: role.position,
          managed: role.managed,
          assignable: !role.managed && role.position < me.roles.highest.position,
        })),
    };
    res.json(detail);
  });

  for (const module of dashboardModules) {
    guildRouter.use(`/${module.id}`, module.router(client));
  }

  // Bernis and cosmetics are global per user: no guild permission, owner routes check OWNER_IDS.
  api.use('/me', meRouter(client));
  api.use('/owner', ownerRouter(client));
  api.use('/guilds/:guildId', guildRouter);
  api.use((_req, res) => sendError(res, 404, 'Unbekannter API-Pfad.'));
  router.use('/api', api);
  // Public, opt-in profile pages for link previews in Discord (no login).
  router.use('/p', publicProfileRouter(client, `${config.baseUrl}/dashboard`));

  // Banners on top of Nexo cards, in any scheme colour (fetched by Discord, so public and long-cached).
  router.get('/banners/:file', async (req, res) => {
    const motif = /^([A-Za-z]+)\.png$/.exec(req.params.file)?.[1];
    const color = /^[0-9a-f]{6}$/i.exec(String(req.query.c ?? ''))?.[0];
    if (!motif || !Object.hasOwn(MOTIFS, motif) || !color) return sendError(res, 404, 'Unbekanntes Banner.');
    const png = await renderBanner(motif as BannerMotif, Number.parseInt(color, 16));
    res.type('png').set('Cache-Control', 'public, max-age=31536000, immutable').send(png);
  });

  // ---------- Frontend ----------
  if (staticDir) {
    router.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    router.get('/{*path}', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  } else {
    router.use((_req, res) => sendError(res, 503, 'Das Dashboard-Frontend wurde nicht gebaut (npm run build).'));
  }

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      return sendError(res, error.status, error.message);
    }
    // Bot services throw NexoBotError with a German userMessage; input/permission problems are the client's.
    if (error instanceof NexoBotError && error.userMessage && CLIENT_ERRORS.includes(error.type)) {
      return sendError(res, 400, error.userMessage);
    }
    logger.error('Dashboard request failed:', error);
    if (!res.headersSent) {
      sendError(res, 500, 'Da ist etwas schiefgelaufen. Bitte versuch es erneut.');
    }
  });

  return router;
}
