// Shop events: the built-in calendar (computed per year in Europe/Berlin) plus the owner's custom events, stored in
// shop_events. Auto events are stored only once the owner toggles them (row kind 'auto' = override of `active`).

import { randomBytes } from 'node:crypto';
import { COSMETIC_SLOTS, type CosmeticItem, type CosmeticSlot } from '../../shared/cosmetics.js';
import type { ShopEvent } from '../../web/dto/profile.js';
import { HttpError, badRequest, body, bool, int, str } from '../../web/http.js';
import { T, cosmeticsPool, requirePool } from './db.js';
import { berlinTime } from './time.js';

export const AUTO_EVENT_IDS = ['black-friday', 'summer-sale', 'halloween', 'christmas', 'new-year'] as const;

const auto = (id: string, name: string, description: string, start: Date, end: Date, discount: number): ShopEvent => ({
  id, name, description, startsAt: start.toISOString(), endsAt: end.toISOString(), discount, slots: null, kind: 'auto', active: true,
});

/** Last Friday of November (day of month). */
export function blackFridayDay(year: number): number {
  const weekday = new Date(Date.UTC(year, 10, 30)).getUTCDay();
  return 30 - ((weekday - 5 + 7) % 7);
}

/** Built-in events starting in `year` (Weihnachten runs into January of the next year). */
export function calendarEvents(year: number): ShopEvent[] {
  const bf = blackFridayDay(year);
  return [
    auto('new-year', 'Neujahr', 'Frisch ins neue Jahr: exklusive Neujahrs-Items.', berlinTime(year, 1, 1), berlinTime(year, 1, 8), 0),
    auto('summer-sale', 'Sommer-Sale', '20 % auf den ganzen Shop.', berlinTime(year, 7, 15), berlinTime(year, 8, 16), 20),
    auto('halloween', 'Halloween', '15 % auf den Shop und schaurige Event-Items.', berlinTime(year, 10, 24), berlinTime(year, 11, 1), 15),
    auto('black-friday', 'Black Friday', 'Black Friday bis Cyber Monday: 30 % auf den ganzen Shop.', berlinTime(year, 11, bf), berlinTime(year, 11, bf + 4), 30),
    auto('christmas', 'Weihnachten', '15 % auf den Shop und winterliche Event-Items.', berlinTime(year, 12, 15), berlinTime(year + 1, 1, 3), 15),
  ];
}

const startsBefore = (a: ShopEvent, b: ShopEvent) => Date.parse(a.startsAt) - Date.parse(b.startsAt);

/** Every known event occurrence around `now`: auto events (with the owner's on/off override) and custom events. */
export function eventOccurrences(now: Date, stored: ShopEvent[]): ShopEvent[] {
  const disabled = new Set(stored.filter((event) => event.kind === 'auto' && !event.active).map((event) => event.id));
  const year = Number(now.toISOString().slice(0, 4));
  const autos = [year - 1, year, year + 1].flatMap(calendarEvents).map((event) => ({ ...event, active: !disabled.has(event.id) }));
  return [...autos, ...stored.filter((event) => event.kind === 'custom')].sort(startsBefore);
}

export function isRunning(event: ShopEvent, now: Date): boolean {
  return event.active && Date.parse(event.startsAt) <= now.getTime() && now.getTime() < Date.parse(event.endsAt);
}

export function runningEvents(now: Date, stored: ShopEvent[]): ShopEvent[] {
  return eventOccurrences(now, stored).filter((event) => isRunning(event, now));
}

/** The next few active events that have not started yet (one occurrence per event). */
export function upcomingEvents(now: Date, stored: ShopEvent[], limit = 3): ShopEvent[] {
  const seen = new Set<string>();
  return eventOccurrences(now, stored)
    .filter((event) => event.active && Date.parse(event.startsAt) > now.getTime() && !seen.has(event.id) && seen.add(event.id))
    .slice(0, limit);
}

/** Owner view: the current or next occurrence of every auto event plus all custom events. */
export function ownerEventList(now: Date, stored: ShopEvent[]): ShopEvent[] {
  const seen = new Set<string>();
  return eventOccurrences(now, stored)
    .filter((event) => event.kind === 'custom' || (Date.parse(event.endsAt) > now.getTime() && !seen.has(event.id) && seen.add(event.id)));
}

export interface PriceInfo { finalPrice: number; discount: number; eventId: string | null }

/** Best running discount for a shop or event item; other items keep their price. */
export function priceFor(item: CosmeticItem, running: ShopEvent[]): PriceInfo {
  const ownEvent = item.availability === 'event' ? item.eventId : null;
  if (item.availability !== 'shop' && item.availability !== 'event') return { finalPrice: item.price, discount: 0, eventId: ownEvent };
  let best: ShopEvent | null = null;
  for (const event of running) {
    if (event.discount > 0 && (event.slots === null || event.slots.includes(item.slot)) && (!best || event.discount > best.discount)) best = event;
  }
  if (!best) return { finalPrice: item.price, discount: 0, eventId: ownEvent };
  return { finalPrice: Math.round((item.price * (100 - best.discount)) / 100), discount: best.discount, eventId: best.id };
}

/** Event-only items can be bought while their event runs. */
export function eventFor(item: CosmeticItem, running: ShopEvent[]): ShopEvent | null {
  return item.availability === 'event' ? running.find((event) => event.id === item.eventId) ?? null : null;
}

// ---------- Storage ----------

interface EventRow { id: string; kind: string; name: string; description: string; starts_at: Date; ends_at: Date; discount: number; slots: CosmeticSlot[] | null; active: boolean }

const toEvent = (row: EventRow): ShopEvent => ({
  id: row.id, name: row.name, description: row.description, startsAt: row.starts_at.toISOString(), endsAt: row.ends_at.toISOString(),
  discount: row.discount, slots: row.slots, kind: row.kind === 'auto' ? 'auto' : 'custom', active: row.active,
});

export async function loadStoredEvents(): Promise<ShopEvent[]> {
  const pool = cosmeticsPool();
  if (!pool) return [];
  const result = await pool.query<EventRow>(`SELECT * FROM ${T.shop_events}`);
  return result.rows.map(toEvent);
}

function parseDate(value: unknown, field: string): Date {
  const date = typeof value === 'string' ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw badRequest(`${field}: gültiges Datum erwartet.`);
  return date;
}

function parseSlots(value: unknown): CosmeticSlot[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.length === 0) throw badRequest('Bereiche: Liste von Slots oder null erwartet.');
  return [...new Set(value.map((slot) => {
    if (!COSMETIC_SLOTS.includes(slot as CosmeticSlot)) throw badRequest(`Unbekannter Slot: ${String(slot)}`);
    return slot as CosmeticSlot;
  }))];
}

function parseCustomEvent(input: unknown, current: ShopEvent | null): Omit<ShopEvent, 'id' | 'kind'> {
  const raw: Record<string, unknown> = { ...current, ...body(input) };
  const startsAt = parseDate(raw.startsAt, 'Start');
  const endsAt = parseDate(raw.endsAt, 'Ende');
  if (endsAt <= startsAt) throw badRequest('Das Ende muss nach dem Start liegen.');
  if (endsAt.getTime() - startsAt.getTime() > 366 * 86_400_000) throw badRequest('Ein Event darf höchstens ein Jahr dauern.');
  return {
    name: str(raw.name, 'Name', { min: 1, max: 60 }),
    description: str(raw.description ?? '', 'Beschreibung', { max: 200 }),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    discount: int(raw.discount, 'Rabatt', 0, 90),
    slots: parseSlots(raw.slots),
    active: raw.active === undefined ? true : bool(raw.active, 'Aktiv'),
  };
}

async function saveEvent(event: ShopEvent): Promise<ShopEvent> {
  await requirePool().query(
    `INSERT INTO ${T.shop_events} (id, kind, name, description, starts_at, ends_at, discount, slots, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
     ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, name = EXCLUDED.name, description = EXCLUDED.description,
       starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, discount = EXCLUDED.discount, slots = EXCLUDED.slots, active = EXCLUDED.active`,
    [event.id, event.kind, event.name, event.description, event.startsAt, event.endsAt, event.discount, JSON.stringify(event.slots), event.active],
  );
  return event;
}

export async function createCustomEvent(input: unknown): Promise<ShopEvent> {
  return saveEvent({ id: `custom-${randomBytes(4).toString('hex')}`, kind: 'custom', ...parseCustomEvent(input, null) });
}

/** Custom events: full update. Auto events: only `active` can change. */
export async function updateEvent(id: string, input: unknown): Promise<ShopEvent> {
  const stored = await loadStoredEvents();
  if ((AUTO_EVENT_IDS as readonly string[]).includes(id)) {
    const active = bool(body(input).active, 'Aktiv');
    const occurrence = ownerEventList(new Date(), stored).find((event) => event.id === id);
    if (!occurrence) throw new HttpError(404, 'Event nicht gefunden.');
    return saveEvent({ ...occurrence, active });
  }
  const current = stored.find((event) => event.id === id && event.kind === 'custom');
  if (!current) throw new HttpError(404, 'Event nicht gefunden.');
  return saveEvent({ id, kind: 'custom', ...parseCustomEvent(input, current) });
}

export async function deleteEvent(id: string): Promise<void> {
  if ((AUTO_EVENT_IDS as readonly string[]).includes(id)) throw badRequest('Kalender-Events kannst du nur deaktivieren.');
  const result = await requirePool().query(`DELETE FROM ${T.shop_events} WHERE id = $1 AND kind = 'custom'`, [id]);
  if (!result.rowCount) throw new HttpError(404, 'Event nicht gefunden.');
}
