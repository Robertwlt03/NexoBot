// Nexo profile cosmetics: global (per user, not per server), bought with Bernis — the bot's own currency that
// only Nexo hands out (level-ups, mini games, monthly rankings, achievements, daily bonus). Import-free: shared by
// the bot, the card renderer and the dashboard.

/** `symbol` is for Discord text (no custom graphics there); the dashboard and the cards draw the amber drop from shared/amber.ts. */
export const CURRENCY = { name: 'Bernis', singular: 'Berni', short: 'B', symbol: '🟠' } as const;

export const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const;
export type Rarity = (typeof RARITIES)[number];
export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Gewöhnlich', rare: 'Selten', epic: 'Episch', legendary: 'Legendär', mythic: 'Mythisch',
};
/** Default price band per rarity (owner can set any price per item). mythic = Black-Market exclusives. */
export const PRICE_BANDS: Record<Rarity, [number, number]> = {
  common: [300, 600], rare: [800, 1500], epic: [2000, 3500], legendary: [5000, 9000], mythic: [2500, 12000],
};

/** Where an item can be obtained. */
export type ItemAvailability = 'shop' | 'blackmarket' | 'event' | 'achievement' | 'ranking';

// ---------- Item data per slot ----------

export type PatternKind = 'none' | 'dots' | 'grid' | 'waves' | 'stars' | 'hex' | 'diagonal' | 'circuit';
/** Illustrated backgrounds drawn by the card renderer: game and character genres as original motifs (no franchise art or names). */
export const BACKGROUND_SCENES = ['pixel', 'neon-city', 'moon-ninja', 'dungeon', 'orbital', 'pirate-cove'] as const;
export type BackgroundScene = (typeof BACKGROUND_SCENES)[number];
/** `scene` only with kind 'scene'; `colors` then recolour the scene (sky, landscape, light, details). */
export interface BackgroundData { kind: 'solid' | 'gradient' | 'pattern' | 'aurora' | 'mesh' | 'scene'; colors: string[]; angle: number; pattern: PatternKind; scene?: BackgroundScene }
export interface AccentData { color: string }
export interface NameStyleData { colors: string[]; glow: boolean }
export interface FrameData { style: 'solid' | 'gradient' | 'glow' | 'double' | 'dashed' | 'neon' | 'crown'; colors: string[]; width: number }
/** Badge glyph: one of BADGE_GLYPHS (drawn as vector shapes by the renderer, no emoji fonts needed). */
export interface BadgeData { glyph: BadgeGlyph; color: string }
export interface TitleData { text: string; color: string }
export interface XpBarData { style: 'solid' | 'gradient' | 'striped' | 'segmented' | 'glow'; colors: string[] }
export interface FontData { font: 'inter' | 'unbounded' | 'caveat' }
export interface EffectData { effect: 'sparkles' | 'snow' | 'confetti' | 'aurora' | 'scanlines' | 'stardust' | 'embers' | 'hearts' | 'leaves' }
export interface LevelupData { style: 'classic' | 'minimal' | 'neon' | 'royal' | 'retro'; color: string }
export interface LayoutData { layout: 'classic' | 'compact' | 'centered' | 'split' }
export interface StickerData { glyph: BadgeGlyph; color: string; corner: 'tl' | 'tr' | 'bl' | 'br' }

export const BADGE_GLYPHS = [
  'star', 'crown', 'flame', 'bolt', 'heart', 'diamond', 'shield', 'leaf', 'moon', 'sun', 'snowflake', 'skull',
  'music', 'controller', 'fish', 'pickaxe', 'dice', 'trophy', 'rocket', 'ghost', 'pumpkin', 'gift', 'paw', 'code',
  'acorn', 'mushroom', 'tree',
] as const;
export type BadgeGlyph = (typeof BADGE_GLYPHS)[number];

/** Slot → data shape. */
export interface SlotData {
  background: BackgroundData;
  accent: AccentData;
  nameStyle: NameStyleData;
  frame: FrameData;
  badge: BadgeData;
  title: TitleData;
  xpBar: XpBarData;
  font: FontData;
  effect: EffectData;
  levelup: LevelupData;
  layout: LayoutData;
  sticker: StickerData;
}
export type CosmeticSlot = keyof SlotData;
export const COSMETIC_SLOTS: CosmeticSlot[] = ['background', 'accent', 'nameStyle', 'frame', 'badge', 'title', 'xpBar', 'font', 'effect', 'levelup', 'layout', 'sticker'];
export const SLOT_LABELS: Record<CosmeticSlot, string> = {
  background: 'Hintergrund', accent: 'Akzentfarbe', nameStyle: 'Namensfarbe', frame: 'Avatar-Rahmen', badge: 'Abzeichen',
  title: 'Titel', xpBar: 'XP-Balken', font: 'Schrift', effect: 'Effekt', levelup: 'Level-up-Stil', layout: 'Kartenlayout', sticker: 'Sticker',
};
/** Up to this many badges can be equipped at once; every other slot holds one item. */
export const MAX_EQUIPPED_BADGES = 3;
export const MAX_BIO_LENGTH = 120;

/** A catalog item. `data` matches SlotData[slot]. */
export type CosmeticItem = {
  [S in CosmeticSlot]: {
    id: string;
    slot: S;
    name: string;
    description: string;
    rarity: Rarity;
    /** Base price in Bernis (before event discounts). 0 for items that cannot be bought. */
    price: number;
    availability: ItemAvailability;
    /** Event id for event-only items (only buyable while that event runs). */
    eventId: string | null;
    /** Achievement id for achievement rewards. */
    achievementId: string | null;
    active: boolean;
    data: SlotData[S];
  }
}[CosmeticSlot];

/** What a user has equipped (item ids). null = Nexo default look. */
export interface EquippedCosmetics {
  background: string | null;
  accent: string | null;
  nameStyle: string | null;
  frame: string | null;
  badges: string[];
  title: string | null;
  xpBar: string | null;
  font: string | null;
  effect: string | null;
  levelup: string | null;
  layout: string | null;
  sticker: string | null;
}

export interface UserProfileSettings {
  equipped: EquippedCosmetics;
  bio: string;
  /** Show this user's frame/colours on welcome cards of servers that allow member styles. */
  showOnWelcome: boolean;
}

export function emptyEquipped(): EquippedCosmetics {
  return { background: null, accent: null, nameStyle: null, frame: null, badges: [], title: null, xpBar: null, font: null, effect: null, levelup: null, layout: null, sticker: null };
}

export function defaultProfileSettings(): UserProfileSettings {
  return { equipped: emptyEquipped(), bio: '', showOnWelcome: true };
}

/** Equipped items resolved to their data, ready for rendering (missing = Nexo default look). */
export interface ResolvedCosmetics {
  background: BackgroundData | null;
  accent: AccentData | null;
  nameStyle: NameStyleData | null;
  frame: FrameData | null;
  badges: BadgeData[];
  title: TitleData | null;
  xpBar: XpBarData | null;
  font: FontData | null;
  effect: EffectData | null;
  levelup: LevelupData | null;
  layout: LayoutData | null;
  sticker: StickerData | null;
}

/** Everything the profile card needs besides the cosmetics. */
export interface ProfileCardSubject {
  name: string;
  username: string;
  avatarUrl: string | null;
  bio: string;
  level: number;
  /** XP inside the current level and needed for the next one. */
  xp: number;
  xpNeeded: number;
  rank: number | null;
  serverName: string | null;
  balance: number;
}

// ---------- Earning (defaults; the economy service may read overrides from the owner config) ----------

/** Bernis for reaching `level` (milestones every 10 levels pay 1.5×). */
export function levelUpReward(level: number): number {
  const base = Math.round(20 + level * 6);
  return level % 10 === 0 ? Math.round(base * 1.5) : base;
}
/** Combined daily cap for level-up and mini-game income (monthly rankings, achievements and the daily bonus are not capped). */
export const DAILY_EARN_CAP = 400;
/** Monthly ranking payouts for places 1–5, per server and per ranking kind. */
export const MONTHLY_RANK_REWARDS = [500, 300, 200, 120, 80] as const;
/** Ranking rewards only on servers with at least this many human members, and from at most this many servers per user per month. */
export const MONTHLY_MIN_HUMANS = 15;
export const MONTHLY_MAX_SERVERS = 3;
export const RANKING_KINDS = ['minigames', 'activity'] as const;
export type RankingKind = (typeof RANKING_KINDS)[number];
export const RANKING_LABELS: Record<RankingKind, string> = { minigames: 'Minispiele', activity: 'Aktivität' };
/** Daily bonus: base plus streak bonus per consecutive day (capped). */
export const DAILY_BONUS = { base: 25, perStreakDay: 5, maxStreakBonus: 50 } as const;
/** Black market: number of items per weekly rotation (rotates Monday 00:00 Europe/Berlin). */
export const BLACK_MARKET_SIZE = 6;
