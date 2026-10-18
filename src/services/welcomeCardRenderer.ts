// Renders welcome/goodbye cards to PNG with @napi-rs/canvas, using the shared renderer and the bundled fonts.
// Remote images (avatar, background, image layers) are fetched through an SSRF guard.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { GlobalFonts, createCanvas, loadImage, type Image } from '@napi-rs/canvas';
import type { GuildMember, PartialGuildMember } from 'discord.js';
import {
  CARD_FONTS, CARD_FONT_KEYS, CARD_FONT_WEIGHTS, CARD_HEIGHT, CARD_WIDTH, cardHasAvatar, cardImageUrls, renderCard,
  type CardVars, type WelcomeCard,
} from '../shared/welcomeCard.js';
import type { AccentData, FrameData } from '../shared/cosmetics.js';
import { logger } from '../utils/logger.js';

// src/services and dist/services are both two levels below the project root.
const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
for (const font of CARD_FONT_KEYS) {
  for (const weight of CARD_FONT_WEIGHTS) {
    GlobalFonts.registerFromPath(path.join(FONT_DIR, `${font}-${weight}.woff2`), CARD_FONTS[font].family);
  }
}

// ---------- SSRF guard ----------

// IPv4-mapped IPv6 (::ffff:a.b.c.d) is matched against the IPv4 rules by BlockList itself.
const BLOCKED = new net.BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) BLOCKED.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) BLOCKED.addSubnet(network, prefix, 'ipv6');

/** True for loopback, private, link-local, multicast, reserved and anything that is not an IP. */
export function isBlockedAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, '');
  const family = net.isIP(ip);
  if (family === 0) return true;
  return BLOCKED.check(ip, family === 4 ? 'ipv4' : 'ipv6');
}

/** DNS lookup that refuses blocked addresses; the connection uses exactly the checked address (no rebinding). */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, '', 4);
    if (!addresses.length || addresses.some((entry) => isBlockedAddress(entry.address))) {
      return callback(Object.assign(new Error(`Blocked address for ${hostname}`), { code: 'EBLOCKED' }), '', 4);
    }
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0].address, addresses[0].family);
  });
};

const FETCH_TIMEOUT_MS = 5_000;
const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** Downloads an image (http/https, public addresses only, ≤ 5 MB, raster types, ≤ 3 redirects). */
export function fetchImageBuffer(rawUrl: string, redirects = 3): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return reject(new Error('Invalid URL'));
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return reject(new Error('Protocol not allowed'));
    const host = url.hostname.replace(/^\[|\]$/g, '');
    // IP literals skip the lookup, so check them here.
    if (net.isIP(host) && isBlockedAddress(host)) return reject(new Error('Blocked address'));

    const client = url.protocol === 'https:' ? https : http;
    const request = client.get(url, { lookup: guardedLookup, timeout: FETCH_TIMEOUT_MS, headers: { 'user-agent': 'NexoBot-Card/1.0' } }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        clearTimeout(timer);
        if (redirects <= 0) return reject(new Error('Too many redirects'));
        return fetchImageBuffer(new URL(response.headers.location, url).href, redirects - 1).then(resolve, reject);
      }
      const type = (response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
      if (status !== 200 || !IMAGE_TYPES.includes(type) || Number(response.headers['content-length'] ?? 0) > MAX_BYTES) {
        response.resume();
        clearTimeout(timer);
        return reject(new Error(`Unusable response (${status}, ${type || 'no type'})`));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) request.destroy(new Error('Image too large'));
        else chunks.push(chunk);
      });
      response.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks)); });
      response.on('error', reject);
    });
    // Hard cap for the whole download, not only idle time.
    const timer = setTimeout(() => request.destroy(new Error('Timeout')), FETCH_TIMEOUT_MS);
    request.on('timeout', () => request.destroy(new Error('Timeout')));
    request.on('error', (error) => { clearTimeout(timer); reject(error); });
  });
}

// ponytail: small FIFO cache in memory; per-process only, swap for an LRU if many servers use big images.
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 50;
const imageCache = new Map<string, { image: Image; expires: number }>();

export async function loadRemoteImage(url: string): Promise<Image | null> {
  const cached = imageCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.image;
  try {
    const image = await loadImage(await fetchImageBuffer(url));
    imageCache.set(url, { image, expires: Date.now() + CACHE_TTL_MS });
    if (imageCache.size > CACHE_MAX) imageCache.delete(imageCache.keys().next().value as string);
    return image;
  } catch (error) {
    logger.debug(`Card image failed (${url}):`, error);
    return null;
  }
}

// ---------- Rendering ----------

export interface CardSubject extends CardVars {
  avatarUrl: string | null;
}

export function cardSubjectFromMember(member: GuildMember | PartialGuildMember): CardSubject {
  return {
    avatarUrl: member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }),
    userName: member.displayName,
    username: member.user.username,
    server: member.guild.name,
    memberCount: member.guild.memberCount.toLocaleString('de-DE'),
  };
}

/**
 * "Profil-Stil der Mitglieder": the avatar border takes the member's profile frame colour (or accent) and a frame
 * width scaled to the avatar size. The welcome card only has a plain border, so frame styles map to their main colour.
 */
export function applyMemberStyle(card: WelcomeCard, frame: FrameData | null, accent: AccentData | null): WelcomeCard {
  const color = frame?.colors[0] ?? accent?.color;
  if (!color) return card;
  return {
    ...card,
    layers: card.layers.map((layer) => {
      if (layer.type !== 'avatar') return layer;
      const width = frame ? Math.round((frame.width * layer.size) / 176) : layer.borderWidth || 6;
      return { ...layer, borderColor: color, borderWidth: Math.min(40, Math.max(layer.borderWidth, width, 2)) };
    }),
  };
}

/** Renders the card as PNG. Images that fail to load are left out; throws only if rendering itself fails. */
export async function renderWelcomeCard(card: WelcomeCard, subject: CardSubject): Promise<Buffer> {
  const urls = cardImageUrls(card);
  const [avatar, ...images] = await Promise.all([
    cardHasAvatar(card) && subject.avatarUrl ? loadRemoteImage(subject.avatarUrl) : Promise.resolve(null),
    ...urls.map(loadRemoteImage),
  ]);
  const loaded = new Map<string, Image>();
  urls.forEach((url, index) => { const image = images[index]; if (image) loaded.set(url, image); });

  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  renderCard(canvas.getContext('2d'), card, { avatar, images: loaded }, subject);
  return canvas.encode('png');
}
