// Member area ("Mein Profil") and owner area: shared state, hooks and helpers.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { MAX_EQUIPPED_BADGES, withSpot } from '../../../src/shared/cosmetics';
import type {
  CosmeticItem, CosmeticSlot, EquippedCosmetics, ProfileCardSubject, ResolvedCosmetics, SlotData, StickerSpot,
} from '../../../src/shared/cosmetics';
import type { ApiUser } from '../../../src/web/apiTypes';
import type { BlackMarketResponse, MeProfileResponse, OwnedItem, ShopResponse, WalletSummary } from '../../../src/web/dto/profile';
import { api, DirtyContext, useToast } from '../api';

gsap.registerPlugin(useGSAP);

export const num = (value: number) => value.toLocaleString('de-DE');
export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Context (provided by MeLayout) ----------

export interface MeContextValue {
  me: MeProfileResponse;
  setMe: (update: (prev: MeProfileResponse) => MeProfileResponse) => void;
  shop: ShopResponse | null;
  blackMarket: BlackMarketResponse | null;
  /** GET /me/items by id: all active items plus inactive ones the member owns. */
  items: Map<string, CosmeticItem>;
  reloadShop: () => void;
}
export const MeContext = createContext<MeContextValue | null>(null);

export function useMe(): MeContextValue {
  const value = useContext(MeContext);
  if (!value) throw new Error('useMe outside of the member area');
  return value;
}

/** Applies a purchase/claim result to the shared state (wallet pill, inventory). */
export function useWalletUpdate() {
  const { setMe } = useMe();
  return useCallback((wallet: WalletSummary, inventory?: OwnedItem[]) => {
    setMe((prev) => ({ ...prev, wallet, inventory: inventory ?? prev.inventory }));
  }, [setMe]);
}

// ---------- Cosmetics ----------

function pick<S extends CosmeticSlot>(items: Map<string, CosmeticItem>, id: string | null, slot: S): SlotData[S] | null {
  const item = id ? items.get(id) : undefined;
  return item?.slot === slot ? (item.data as SlotData[S]) : null;
}

/** Equipped ids → data for the card renderer (unknown ids fall back to the Nexo default look). */
export function resolveCosmetics(equipped: EquippedCosmetics, items: Map<string, CosmeticItem>, stickerSpot: StickerSpot | null = null): ResolvedCosmetics {
  return {
    background: pick(items, equipped.background, 'background'),
    accent: pick(items, equipped.accent, 'accent'),
    nameStyle: pick(items, equipped.nameStyle, 'nameStyle'),
    frame: pick(items, equipped.frame, 'frame'),
    badges: equipped.badges.flatMap((id) => pick(items, id, 'badge') ?? []),
    title: pick(items, equipped.title, 'title'),
    xpBar: pick(items, equipped.xpBar, 'xpBar'),
    font: pick(items, equipped.font, 'font'),
    effect: pick(items, equipped.effect, 'effect'),
    levelup: pick(items, equipped.levelup, 'levelup'),
    layout: pick(items, equipped.layout, 'layout'),
    sticker: withSpot(pick(items, equipped.sticker, 'sticker'), stickerSpot),
    pet: pick(items, equipped.pet, 'pet'),
  };
}

/** Puts an item on (badges are added, keeping at most three). */
export function equipItem(equipped: EquippedCosmetics, item: CosmeticItem): EquippedCosmetics {
  if (item.slot === 'badge') {
    return equipped.badges.includes(item.id) ? equipped : { ...equipped, badges: [...equipped.badges, item.id].slice(-MAX_EQUIPPED_BADGES) };
  }
  return { ...equipped, [item.slot]: item.id };
}

export function unequipItem(equipped: EquippedCosmetics, item: CosmeticItem): EquippedCosmetics {
  if (item.slot === 'badge') return { ...equipped, badges: equipped.badges.filter((id) => id !== item.id) };
  return { ...equipped, [item.slot]: null };
}

export function isEquipped(equipped: EquippedCosmetics, item: CosmeticItem): boolean {
  return item.slot === 'badge' ? equipped.badges.includes(item.id) : equipped[item.slot] === item.id;
}

/** Card subject for the member's own preview (level of the chosen server). */
export function cardSubject(user: ApiUser | null, me: MeProfileResponse, guildId: string | null, bio: string): ProfileCardSubject {
  const level = me.levels.find((l) => l.guildId === guildId) ?? me.levels[0];
  return {
    name: user?.globalName ?? user?.username ?? 'Du',
    username: user?.username ?? '',
    avatarUrl: user?.avatarUrl ?? null,
    bio,
    level: level?.level ?? 1,
    xp: level?.xp ?? 0,
    xpNeeded: level?.xpNeeded ?? 100,
    rank: level?.rank ?? null,
    serverName: level?.guildName ?? null,
    balance: me.wallet.balance,
    petStage: me.petStage,
  };
}

// ---------- Forms ----------

/**
 * Draft of a server value with the shared save bar: `draft` follows `source` until edited, `dirty` blocks navigation.
 * `persist` saves and must update `source` (which resets the draft).
 */
export function useDraft<T>(source: T | null, persist: (draft: T) => Promise<void>) {
  const toast = useToast();
  const { setGuard } = useContext(DirtyContext);
  const [draft, setDraft] = useState<T | null>(source);
  const [saving, setSaving] = useState(false);
  const original = useMemo(() => JSON.stringify(source), [source]);

  useEffect(() => { if (source !== null) setDraft(structuredClone(source)); }, [source]);
  const dirty = draft !== null && JSON.stringify(draft) !== original;
  useEffect(() => { setGuard(dirty); return () => setGuard(false); }, [dirty, setGuard]);

  const save = useCallback(async () => {
    if (draft === null) return;
    setSaving(true);
    try {
      await persist(draft);
      toast('Änderungen gespeichert.');
    } catch (err) {
      toast(errorText(err), true);
    } finally {
      setSaving(false);
    }
  }, [draft, persist, toast]);
  const reset = useCallback(() => { if (source !== null) setDraft(structuredClone(source)); }, [source]);

  return { draft, setDraft, dirty, save, reset, saving };
}

/** POST/PUT/DELETE with toast feedback; returns null on failure. */
export function useMutation() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <R,>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown, success?: string): Promise<R | null> => {
    setBusy(true);
    try {
      const result = await api<R>(path, { method, body: body ?? {} });
      if (success) toast(success);
      return result;
    } catch (err) {
      toast(errorText(err), true);
      return null;
    } finally {
      setBusy(false);
    }
  }, [toast]);
  return { run, busy };
}

/** Saves a new set of equipped items right away (inventory and shop shortcuts). */
export function useEquip() {
  const { me, setMe } = useMe();
  const { run, busy } = useMutation();
  const apply = useCallback(async (equipped: EquippedCosmetics, success: string) => {
    const result = await run<MeProfileResponse>('/me/profile', 'PUT', { ...me.profile, equipped }, success);
    if (result) setMe(() => result);
  }, [me.profile, run, setMe]);
  return { apply, busy };
}

// ---------- Time & motion ----------

/** Current time, ticking every `ms` (for countdowns). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

/** "3 T 4 Std" for long spans, "04:12:09" below a day. */
/** "in 3 Tagen", or the countdown when it is less than a day away. */
export function startsIn(start: string, now: number): string {
  const days = Math.floor((Date.parse(start) - now) / 86_400_000);
  return days >= 1 ? `in ${days} ${days === 1 ? 'Tag' : 'Tagen'}` : `in ${countdown(start, now)}`;
}

export function countdown(target: string, now: number): string {
  const diff = Math.max(0, Date.parse(target) - now);
  const s = Math.floor(diff / 1000);
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3600);
  if (days > 0) return `${days} T ${hours} Std`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

/** Counts the shown number to `value` whenever it changes (balance after buying, daily bonus …). */
export function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  const state = useRef({ n: value });
  useGSAP(() => {
    if (state.current.n === value) return;
    if (reducedMotion()) { state.current.n = value; setShown(value); return; }
    gsap.to(state.current, {
      n: value, duration: 1.1, ease: 'power3.out', overwrite: true,
      onUpdate: () => setShown(Math.round(state.current.n)),
    });
  }, { dependencies: [value] });
  return shown;
}
