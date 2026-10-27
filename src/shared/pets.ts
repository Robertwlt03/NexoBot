// Companions ("Begleiter") for the profile card: small animals that sit at the lower left of the avatar and evolve when
// their owner looks after them. Drawn on canvas in a 100×100 design box centred on (0, 0) with the ground at y = 50,
// scaled to the requested size. Shared by the bot and the dashboard.
//
// Care, after the CS2 chickens: food comes only from finishing all three daily quests (never bought), at most
// PET_FOOD_MAX portions in stock, and each pet eats once per Berlin day. Every feeding is a care day; the care days
// decide the form, and rarer pets need far more of them (PET_STAGE_CARE). Miss a day and the pet is sad: it never
// leaves and keeps its form, but the way to the next form starts over.

import type { Rarity } from './cosmetics.js';

// ---------- Care ----------

export type PetStage = 1 | 2 | 3 | 4;
export const PET_STAGE_NAMES = ['Babyform', 'Jugendform', 'Erwachsenenform', 'Kronenform'] as const;
/** Care days from which each form starts, by rarity: rarer pets take far longer. */
export const PET_STAGE_CARE: Record<Rarity, readonly [number, number, number, number]> = {
  common: [0, 10, 30, 70],
  rare: [0, 14, 45, 100],
  epic: [0, 21, 60, 140],
  legendary: [0, 30, 90, 200],
  mythic: [0, 40, 120, 250],
};
/** Food portions a member can keep in stock. */
export const PET_FOOD_MAX = 3;
/** Days without food after which a pet is hungry. */
export const PET_HUNGRY_AFTER = 2;

/** Form from the care days (feedings) of a pet of `rarity`. */
export function petStage(care: number, rarity: Rarity = 'rare'): PetStage {
  return (PET_STAGE_CARE[rarity].filter((from) => care >= from).length as PetStage);
}
/** Care days the next form needs, or null at the last one. */
export function nextStageAt(care: number, rarity: Rarity = 'rare'): number | null {
  return PET_STAGE_CARE[rarity].find((from) => from > care) ?? null;
}

/** Whole days from Berlin day `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface PetCare {
  itemId: string;
  /** Care days that count: after a missed day only the start of the current form. */
  care: number;
  stage: PetStage;
  /** Care days the current form started at. */
  stageFrom: number;
  /** Care days the next stage starts at (null at "Kronenform"). */
  nextAt: number | null;
  /** Berlin day of the last feeding (YYYY-MM-DD). */
  lastFed: string;
  fedToday: boolean;
  hungry: boolean;
}

/** A pet's state from its care days and the day it last ate (`today` as YYYY-MM-DD in Berlin). */
export function petCare(itemId: string, rarity: Rarity, care: number, lastFed: string, today: string): PetCare {
  const since = daysBetween(lastFed, today);
  const hungry = since >= PET_HUNGRY_AFTER;
  const stage = petStage(care, rarity);
  const stageFrom = PET_STAGE_CARE[rarity][stage - 1];
  // Sad: the form stays, the way to the next one starts over.
  const counted = hungry ? stageFrom : care;
  return { itemId, care: counted, stage, stageFrom, nextAt: nextStageAt(counted, rarity), lastFed, fedToday: since <= 0, hungry };
}

/** Size factor of the avatar radius per stage (the crown form keeps the adult size and gets its aura and crown instead). */
const STAGE_SIZE = [0.34, 0.42, 0.5, 0.5];

/** Where the companion sits: on the lower left rim of the avatar. */
export function petPoint(avatar: { cx: number; cy: number; r: number }, stage: number): { x: number; y: number; size: number } {
  const size = avatar.r * STAGE_SIZE[Math.min(4, Math.max(1, stage)) - 1];
  return { x: avatar.cx - avatar.r * 0.78, y: avatar.cy + avatar.r * 0.86 - size, size };
}

export { drawPet, PET_FORM_NAMES, type PetCtx } from './petArt.js';
