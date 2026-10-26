// Live previews of the profile card and the level-up card: the shared renderer the bot uses, drawn on a canvas.

import { useContext, useEffect, useRef, useState } from 'react';
import type { BadgeGlyph, CosmeticItem, ProfileCardSubject, ResolvedCosmetics } from '../../../src/shared/cosmetics';
import {
  ITEM_PREVIEW_HEIGHT, ITEM_PREVIEW_WIDTH, LEVELUP_CARD_HEIGHT, LEVELUP_CARD_WIDTH, PROFILE_CARD_HEIGHT, PROFILE_CARD_WIDTH,
  drawGlyph, renderItemPreview, renderLevelUpCard, renderProfileCard,
} from '../../../src/shared/profileCard';
import { UserContext } from '../api';
import { loadCardFonts } from '../modules/welcome/cardFonts';

const avatarCache = new Map<string, Promise<HTMLImageElement | null>>();

function tryLoad(url: string, crossOrigin: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** CORS first (keeps the canvas readable), plain load as fallback for hosts without CORS headers. */
function loadAvatar(url: string): Promise<HTMLImageElement | null> {
  let promise = avatarCache.get(url);
  if (!promise) {
    promise = tryLoad(url, true).then((image) => image ?? tryLoad(url, false));
    avatarCache.set(url, promise);
  }
  return promise;
}

type Draw = (ctx: CanvasRenderingContext2D, avatar: HTMLImageElement | null) => void;

/**
 * Canvas at the card's native size (×device pixel ratio × `resolution`), scaled by CSS; redraws when `key`, fonts or
 * avatar change. Thumbnails use resolution 0.5, so a shop full of card previews stays light.
 */
function useCardCanvas(width: number, height: number, avatarUrl: string | null, key: string, draw: Draw, resolution = 1) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [avatar, setAvatar] = useState<HTMLImageElement | null>(null);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadCardFonts().then(() => { if (alive) setFontsReady(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setAvatar(null);
    if (avatarUrl) loadAvatar(avatarUrl).then((image) => { if (alive) setAvatar(image); });
    return () => { alive = false; };
  }, [avatarUrl]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1)) * resolution;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, width, height);
    draw(ctx, avatar);
  }, [key, avatar, fontsReady, resolution]); // `key` stands for the drawn props (draw is a fresh closure every render).

  return ref;
}

export function ProfileCardPreview({ subject, cosmetics, className = '', resolution = 1, hideSticker = false }: {
  subject: ProfileCardSubject; cosmetics: ResolvedCosmetics; className?: string; resolution?: number;
  /** Leave the sticker out (StickerPlacement draws it as a draggable overlay). */
  hideSticker?: boolean;
}) {
  const ref = useCardCanvas(PROFILE_CARD_WIDTH, PROFILE_CARD_HEIGHT, subject.avatarUrl, JSON.stringify([subject, cosmetics, hideSticker]),
    (ctx, avatar) => renderProfileCard(ctx, subject, cosmetics, { avatar }, { drawSticker: !hideSticker }), resolution);
  return (
    <canvas ref={ref} width={PROFILE_CARD_WIDTH} height={PROFILE_CARD_HEIGHT} role="img"
      aria-label={`Profilkarte von ${subject.name}, Level ${subject.level}`}
      className={`block h-auto w-full ${className}`} style={{ aspectRatio: `${PROFILE_CARD_WIDTH} / ${PROFILE_CARD_HEIGHT}` }} />
  );
}

export function LevelUpPreview({ subject, cosmetics, level, reward, className = '' }: {
  subject: ProfileCardSubject; cosmetics: ResolvedCosmetics; level: number; reward: number; className?: string;
}) {
  const ref = useCardCanvas(LEVELUP_CARD_WIDTH, LEVELUP_CARD_HEIGHT, subject.avatarUrl, JSON.stringify([subject, cosmetics, level, reward]),
    (ctx, avatar) => renderLevelUpCard(ctx, subject, cosmetics, level, reward, { avatar }));
  return (
    <canvas ref={ref} width={LEVELUP_CARD_WIDTH} height={LEVELUP_CARD_HEIGHT} role="img"
      aria-label={`Level-up-Karte: ${subject.name} erreicht Level ${level}`}
      className={`block h-auto w-full ${className}`} style={{ aspectRatio: `${LEVELUP_CARD_WIDTH} / ${LEVELUP_CARD_HEIGHT}` }} />
  );
}

/** One item painted by the card renderer itself (shop tiles, inventory), around the viewer's own avatar. */
export function ItemPreviewCanvas({ item, own = null, className = '' }: { item: CosmeticItem; own?: ResolvedCosmetics | null; className?: string }) {
  const user = useContext(UserContext);
  const subject = { name: user?.globalName ?? user?.username ?? 'Du', username: user?.username ?? '' };
  const ref = useCardCanvas(ITEM_PREVIEW_WIDTH, ITEM_PREVIEW_HEIGHT, user?.avatarUrl ?? null, JSON.stringify([item.id, item.data, subject, own]),
    (ctx, avatar) => { renderItemPreview(ctx, item, subject, { avatar }, undefined, undefined, own); });
  return (
    <canvas ref={ref} width={ITEM_PREVIEW_WIDTH} height={ITEM_PREVIEW_HEIGHT} aria-hidden="true"
      className={`absolute inset-0 h-full w-full ${item.slot === 'background' ? 'object-cover' : 'object-contain'} ${className}`} />
  );
}

/** A badge/sticker symbol exactly as the card draws it, in the element's text colour (for pickers). */
export function CardGlyph({ glyph, size = 18 }: { glyph: BadgeGlyph; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    canvas.width = size * scale;
    canvas.height = size * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawGlyph(ctx, glyph, size / 2, size / 2, size, getComputedStyle(canvas).color);
  });
  return <canvas ref={ref} aria-hidden="true" style={{ width: size, height: size }} />;
}
