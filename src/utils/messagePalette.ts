// Paints a finished message payload in a member's colour scheme: every card's accent and banner, and embeds that
// stayed embeds, take the scheme's colour for the same role (shared/theme.ts messagePalette). Pure, for tests.

import { ComponentType } from 'discord.js';
import type { MessagePalette } from '../shared/theme.js';
import { bannerName, isBannerUrl, recolorBanner } from './cardBanner.js';

type Json = { type?: number; accent_color?: number | null; color?: number; components?: Json[]; items?: { media: { url: string } }[] } & Record<string, unknown>;

const json = (part: unknown): Json => (typeof (part as { toJSON?: () => unknown })?.toJSON === 'function' ? (part as { toJSON(): Json }).toJSON() : part as Json);
const paletteColor = (palette: MessagePalette, color: number) => Number.parseInt(palette[bannerName(color)].slice(1), 16);

function paintCard(card: Json, palette: MessagePalette): Json {
  const accent = paletteColor(palette, card.accent_color ?? 0x8FB36B);
  return {
    ...card,
    accent_color: accent,
    components: (card.components ?? []).map((child) => (child.type === ComponentType.MediaGallery && isBannerUrl(child.items?.[0]?.media.url)
      ? { ...child, items: child.items!.map((item) => ({ ...item, media: { ...item.media, url: recolorBanner(item.media.url, accent) } })) }
      : child)),
  };
}

export function paintPayload<T>(payload: T, palette: MessagePalette): T {
  if (!payload || typeof payload !== 'object') return payload;
  const { components, embeds } = payload as { components?: unknown[]; embeds?: unknown[] };
  if (!components?.length && !embeds?.length) return payload;
  return {
    ...payload,
    ...(components ? { components: components.map((part) => (json(part).type === ComponentType.Container ? paintCard(json(part), palette) : part)) } : {}),
    ...(embeds ? { embeds: embeds.map((embed) => { const data = json(embed); return data.color == null ? embed : { ...data, color: paletteColor(palette, data.color) }; }) } : {}),
  };
}
