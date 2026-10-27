// Pet care (rules in shared/pets.ts), kept in user_stats next to the other counters, so no table changes:
// `pet_food` is the food in stock, `pet_care:<item>` the care days of a pet and `pet_fed:<item>` the Berlin day it last
// ate (as YYYYMMDD). Pets bought before care existed start in the form the old chat-days rule gave them.

import type { PetOverview } from '../../web/dto/profile.js';
import { HttpError } from '../../web/http.js';
import type { Rarity } from '../../shared/cosmetics.js';
import { PET_FOOD_MAX, PET_STAGE_CARE, petCare, type PetCare } from '../../shared/pets.js';
import { loadCatalog } from './catalog.js';
import { T, cosmeticsPool, requirePool, withTx, type Queryable } from './db.js';
import { readProfileSettings } from './profile.js';
import { berlinDay } from './time.js';

const FOOD = 'pet_food';
const careStat = (itemId: string) => `pet_care:${itemId}`;
const fedStat = (itemId: string) => `pet_fed:${itemId}`;

/** The day care started; pets owned before it are not hungry from day one. */
export const PET_CARE_START = '2026-10-28';

const dayNumber = (day: string) => Number(day.replaceAll('-', ''));
const dayString = (value: number) => {
  const text = String(value);
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
};

/** Care days of a pet from before care existed: the start of the form the old rule gave it (7 and 30 chat days). */
export const legacyCare = (chatDays: number, rarity: Rarity) => PET_STAGE_CARE[rarity][chatDays >= 30 ? 2 : chatDays >= 7 ? 1 : 0];

export interface OwnedPet { itemId: string; rarity: Rarity; acquired: string }

/** Each owned pet's state from the member's pet rows (`stats`: stat → value). Pure, for tests. */
export function petStates(owned: OwnedPet[], stats: Map<string, number>, today: string): PetCare[] {
  const chatDays = stats.get('chat_days') ?? 0;
  return owned.map(({ itemId, rarity, acquired }) => {
    const care = stats.get(careStat(itemId)) ?? (acquired < PET_CARE_START ? legacyCare(chatDays, rarity) : 0);
    const fed = stats.get(fedStat(itemId));
    return petCare(itemId, rarity, care, fed ? dayString(fed) : (acquired > PET_CARE_START ? acquired : PET_CARE_START), today);
  });
}

async function readPets(q: Queryable, userId: string): Promise<{ owned: OwnedPet[]; stats: Map<string, number> }> {
  const [catalog, inventory, stats] = await Promise.all([
    loadCatalog(),
    q.query<{ item_id: string; acquired_at: Date }>(`SELECT item_id, acquired_at FROM ${T.user_inventory} WHERE user_id = $1`, [userId]),
    q.query<{ stat: string; value: string }>(
      `SELECT stat, value FROM ${T.user_stats} WHERE user_id = $1 AND (stat LIKE 'pet\\_%' OR stat = 'chat_days')`, [userId],
    ),
  ]);
  return {
    owned: inventory.rows.filter((row) => catalog.get(row.item_id)?.slot === 'pet')
      .map((row) => ({ itemId: row.item_id, rarity: catalog.get(row.item_id)!.rarity, acquired: berlinDay(row.acquired_at) })),
    stats: new Map(stats.rows.map((row) => [row.stat, Number(row.value)])),
  };
}

/** Food in stock and the state of every pet the member owns. */
export async function getPetOverview(userId: string, now = new Date(), q: Queryable = requirePool()): Promise<PetOverview> {
  const { owned, stats } = await readPets(q, userId);
  return { food: stats.get(FOOD) ?? 0, foodMax: PET_FOOD_MAX, pets: petStates(owned, stats, berlinDay(now)) };
}

/** Stage and mood of the equipped pet for the profile card (stage 1, not hungry without a database or pet). */
export async function getEquippedPetLook(userId: string): Promise<{ stage: number; hungry: boolean }> {
  const fallback = { stage: 1, hungry: false };
  if (!cosmeticsPool()) return fallback;
  try {
    const [settings, overview] = await Promise.all([readProfileSettings(userId), getPetOverview(userId)]);
    const pet = overview.pets.find((entry) => entry.itemId === settings.equipped.pet);
    return pet ? { stage: pet.stage, hungry: pet.hungry } : fallback;
  } catch {
    return fallback;
  }
}

/** One portion of food for finishing all daily quests, up to the stock limit (inside the quest payout). */
export async function grantPetFood(client: Queryable, userId: string): Promise<void> {
  await client.query(
    `INSERT INTO ${T.user_stats} AS s (user_id, stat, value) VALUES ($1, '${FOOD}', 1)
     ON CONFLICT (user_id, stat) DO UPDATE SET value = LEAST(s.value + 1, $2)`, [userId, PET_FOOD_MAX],
  );
}

/** Feeds one of the member's pets: one portion, once per Berlin day; counts a care day (after a sad spell from the start of its form). */
export async function feedPet(userId: string, itemId: string, now = new Date()): Promise<PetOverview> {
  const today = berlinDay(now);
  await withTx(async (client) => {
    const { owned, stats } = await readPets(client, userId);
    const pet = petStates(owned, stats, today).find((entry) => entry.itemId === itemId);
    if (!pet) throw new HttpError(404, 'Dieses Tier gehört dir nicht.');
    // Marking the day first locks the row, so two feedings at once cannot both pass.
    const marked = await client.query(
      `INSERT INTO ${T.user_stats} AS s (user_id, stat, value) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, stat) DO UPDATE SET value = EXCLUDED.value WHERE s.value < EXCLUDED.value`,
      [userId, fedStat(itemId), dayNumber(today)],
    );
    if (!marked.rowCount) throw new HttpError(409, 'Dein Tier hat heute schon gefressen. Morgen wieder!');
    const ate = await client.query(`UPDATE ${T.user_stats} SET value = value - 1 WHERE user_id = $1 AND stat = '${FOOD}' AND value > 0`, [userId]);
    if (!ate.rowCount) throw new HttpError(409, 'Kein Futter mehr. Schaff alle drei Tagesaufgaben, dann gibt es eine neue Portion.');
    // Absolute value: `pet.care` already dropped to the start of its form after a sad spell.
    await client.query(
      `INSERT INTO ${T.user_stats} AS s (user_id, stat, value) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, stat) DO UPDATE SET value = EXCLUDED.value`, [userId, careStat(itemId), pet.care + 1],
    );
    await client.query(
      `INSERT INTO ${T.user_stats} AS s (user_id, stat, value) VALUES ($1, 'pet_feeds', 1)
       ON CONFLICT (user_id, stat) DO UPDATE SET value = s.value + 1`, [userId],
    );
  });
  return getPetOverview(userId, now);
}
