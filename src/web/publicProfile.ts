// Shareable profile links (/dashboard/p/<userId>), opt-in per member. The page is server-rendered so Discord's
// crawler sees it: Open Graph tags plus a component embed (Discord link previews, 2026) that shows the profile card,
// level and season right in the chat when the link is posted. The card PNG is cached for a few minutes.

import express from 'express';
import type { Router } from 'express';
import type { NexoClient } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { T, cosmeticsPool, requirePool } from '../services/cosmetics/db.js';
import { isSnowflake } from '../utils/validation.js';
import { getSeason } from '../services/cosmetics/season.js';
import { loadProfileCardData, renderProfileCardPng } from '../services/profileCardRenderer.js';
import { DEFAULT_ACCENT } from '../shared/profileCard.js';

export async function readShareProfile(userId: string): Promise<boolean> {
  const result = await requirePool().query<{ on: boolean | null }>(`SELECT (settings->>'shareProfile')::boolean AS on FROM ${T.user_profiles} WHERE user_id = $1`, [userId]);
  return result.rows[0]?.on === true;
}

export async function writeShareProfile(userId: string, on: boolean): Promise<boolean> {
  await requirePool().query(
    `INSERT INTO ${T.user_profiles} (user_id, settings, updated_at) VALUES ($1, jsonb_build_object('shareProfile', $2::boolean), NOW())
     ON CONFLICT (user_id) DO UPDATE SET settings = ${T.user_profiles}.settings || jsonb_build_object('shareProfile', $2::boolean), updated_at = NOW()`,
    [userId, on],
  );
  return on;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The member on the server where they have the highest level (their card shows that server's level). */
async function findMember(client: NexoClient, userId: string) {
  const rows = await requirePool().query<{ guild_id: string }>(`SELECT guild_id FROM ${T.user_levels} WHERE user_id = $1 ORDER BY level DESC, total_xp DESC LIMIT 10`, [userId]);
  for (const { guild_id: guildId } of rows.rows) {
    const member = await client.guilds.cache.get(guildId)?.members.fetch(userId).catch(() => null);
    if (member) return member;
  }
  return null;
}

/** Component embed payload (one container) for the link preview. Pure, for tests; must stay below 3000 bytes. */
export function componentEmbed(p: { name: string; lines: string[]; avatarUrl: string | null; cardUrl: string; pageUrl: string; editUrl: string; accent: string }): string {
  const head = { type: 10, content: `## ${p.name}\n${p.lines.join('\n')}` };
  const payload = {
    component: {
      type: 17,
      accent_color: Number.parseInt(p.accent.slice(1), 16),
      components: [
        p.avatarUrl ? { type: 9, components: [head], accessory: { type: 11, media: { url: p.avatarUrl } } } : head,
        { type: 12, items: [{ media: { url: p.cardUrl }, description: `Profilkarte von ${p.name}` }] },
        { type: 1, components: [
          { type: 2, style: 5, url: p.pageUrl, label: 'Profil ansehen' },
          { type: 2, style: 5, url: p.editUrl, label: 'Eigene Karte gestalten' },
        ] },
      ],
    },
  };
  // Inside <script>: no "</" may close it early.
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}

const cards = new Map<string, { png: Buffer; at: number }>();
const CARD_TTL_MS = 10 * 60_000;

export function publicProfileRouter(client: NexoClient, dashboardUrl: string): Router {
  const router = express.Router();

  const load = async (userId: string) => {
    if (!cosmeticsPool() || !isSnowflake(userId) || !(await readShareProfile(userId))) return null;
    const member = await findMember(client, userId);
    return member ? { member, ...(await loadProfileCardData(client, member)) } : null;
  };

  const notFound = (res: express.Response) => res.status(404).type('html').send(
    '<!doctype html><meta charset="utf-8"><title>Nexo</title><body style="font-family:system-ui;background:#16130f;color:#efe8dd;display:grid;place-items:center;height:100vh;margin:0">'
    + '<p>Dieses Profil ist nicht öffentlich.</p></body>',
  );

  router.get('/:userId/card.png', async (req, res) => {
    try {
      const { userId } = req.params;
      const cached = cards.get(userId);
      if (cached && Date.now() - cached.at < CARD_TTL_MS) return void res.type('png').set('Cache-Control', 'public, max-age=600').send(cached.png);
      const data = await load(userId);
      if (!data) return void notFound(res);
      const png = await renderProfileCardPng(data.subject, data.cosmetics);
      cards.set(userId, { png, at: Date.now() });
      if (cards.size > 500) cards.delete(cards.keys().next().value!);
      res.type('png').set('Cache-Control', 'public, max-age=600').send(png);
    } catch (error) {
      logger.warn('Öffentliche Profilkarte fehlgeschlagen:', (error as Error).message);
      res.status(500).end();
    }
  });

  router.get('/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const data = await load(userId);
      if (!data) return void notFound(res);
      const { subject, cosmetics } = data;
      const season = await getSeason(userId);
      const pageUrl = `${dashboardUrl}/p/${userId}`;
      const cardUrl = `${pageUrl}/card.png?v=${Math.floor(Date.now() / CARD_TTL_MS)}`;
      const lines = [
        ...(cosmetics.title ? [`*${cosmetics.title.text}*`] : []),
        `Level **${subject.level}** auf ${subject.serverName ?? 'Nexo'}${subject.rank ? ` · Rang #${subject.rank}` : ''}`,
        `Saison ${season.name} · Stufe ${season.tier} von ${season.tiers.length}`,
      ];
      const title = `${subject.name} auf Nexo`;
      const description = `Level ${subject.level} · Saison-Stufe ${season.tier}${subject.bio ? ` · ${subject.bio}` : ''}`;
      const accent = cosmetics.accent?.color ?? DEFAULT_ACCENT;
      res.type('html').set('Cache-Control', 'public, max-age=300').send(`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(cardUrl)}">
<meta property="og:url" content="${escapeHtml(pageUrl)}">
<meta property="og:type" content="profile">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${escapeHtml(accent)}">
<script id="discord:component-embed" type="application/json">${componentEmbed({ name: subject.name, lines, avatarUrl: subject.avatarUrl, cardUrl, pageUrl, editUrl: `${dashboardUrl}/me`, accent })}</script>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#16130f;color:#efe8dd;font-family:system-ui,sans-serif}main{width:min(92vw,1024px);text-align:center}img{width:100%;border-radius:20px;box-shadow:0 30px 60px -20px #000}h1{font-size:22px;font-weight:600;margin:20px 0 6px}p{color:#b9ad9f;margin:0 0 20px}a{color:${escapeHtml(accent)}}</style>
</head>
<body><main><img src="${escapeHtml(cardUrl)}" alt="Profilkarte von ${escapeHtml(subject.name)}"><h1>${escapeHtml(subject.name)}</h1><p>${escapeHtml(lines.join(' · ').replace(/\*/g, ''))}</p><a href="${escapeHtml(dashboardUrl)}/me">Eigene Profilkarte gestalten</a></main></body>
</html>`);
    } catch (error) {
      logger.warn('Öffentliches Profil fehlgeschlagen:', (error as Error).message);
      res.status(500).end();
    }
  });

  return router;
}
