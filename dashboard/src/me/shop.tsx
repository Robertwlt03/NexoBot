// Shop building blocks shared by the shop and the black market: filters, item grid, detail modal with buy/gift.
import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { COSMETIC_SLOTS, RARITIES, RARITY_LABELS, SLOT_LABELS, levelUpReward } from '../../../src/shared/cosmetics';
import type { CosmeticItem, CosmeticSlot, Rarity } from '../../../src/shared/cosmetics';
import type { PurchaseResult, ShopEvent, ShopListing } from '../../../src/web/dto/profile';
import { useUser } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { LevelUpPreview, ProfileCardPreview } from '../components/ProfileCardPreview';
import { Empty, Field, Modal, Notice, Select, Switch, Tabs, TextInput } from '../components/ui';
import {
  cardSubject, countdown, equipItem, formatDate, isEquipped, reducedMotion, resolveCosmetics, useEquip, useMe, useMutation, useNow, useWalletUpdate,
} from './api';
import { Glyph, ItemVisual, Kristalle, Price, RarityLabel, backgroundStyle } from './visuals';
import { Celebration } from './Celebration';
import { Icon } from '../icons';

export type ShopVariant = 'shop' | 'blackmarket';

const NOT_FOR_SALE: Partial<Record<CosmeticItem['availability'], string>> = {
  achievement: 'Gibt es nur über Erfolge',
  ranking: 'Gibt es nur über die Monatsranglisten',
};
const forSale = (item: CosmeticItem) => item.price > 0 && !NOT_FOR_SALE[item.availability];

// ---------- Upcoming events strip ----------

export function UpcomingEvents({ events }: { events: ShopEvent[] }) {
  const now = useNow(60_000);
  if (!events.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[13px] font-medium text-mute">Demnächst</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <div key={event.id} className="flex items-center gap-3.5 rounded-2xl border border-white/[.06] bg-surface p-4">
            <span className="icon-tile"><span className="text-[13px] font-semibold">−{event.discount}%</span></span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-[14.5px] font-medium">{event.name}</h3>
              <p className="truncate text-[12.5px] text-mute">{formatDate(event.startsAt)} – {formatDate(event.endsAt)} · in {countdown(event.startsAt, now)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Store card, shelves & storefront ----------

/** Rarity identity of a tile (game-shop convention: grey, blue, purple, gold, red). Only used inside item tiles. */
export const RARITY_TILE: Record<Rarity, string> = {
  common: '#8a8f99', rare: '#3b8cf6', epic: '#a35cf5', legendary: '#f2a516', mythic: '#f2415f',
};

/**
 * Game-shop tile: the item art on a glowing field in its rarity colour, light rays behind it, name in caps,
 * the price front and centre and a rarity bar along the bottom (as in Fortnite, Apex, Rocket League).
 * Always dark, in both modes. `large` = the 2×2 feature tile of the bento grid.
 */
export function StoreCard({ listing, owned, variant, onOpen, className = '', large = false }: {
  listing: ShopListing; owned: boolean; variant: ShopVariant; onOpen: () => void; className?: string; large?: boolean;
}) {
  const { item } = listing;
  const tint = RARITY_TILE[item.rarity];
  const style = { '--tile': tint } as CSSProperties;
  return (
    <button type="button" onClick={onOpen} data-mode="dark" style={style}
      className={`js-item game-tile group relative flex cursor-pointer flex-col overflow-hidden rounded-[18px] border-0 bg-[#0d0b0a] p-0 text-left font-[inherit] ring-1 ring-white/[.08] transition duration-300 hover:-translate-y-1 hover:ring-[color-mix(in_srgb,var(--tile)_70%,transparent)] hover:shadow-[0_22px_44px_-18px_color-mix(in_srgb,var(--tile)_55%,transparent)] ${large ? '' : 'aspect-[3/4]'} ${className}`}>
      <div className="game-tile-field relative min-h-0 w-full flex-1 overflow-hidden">
        <ItemVisual item={item} className={`h-full w-full rounded-none !bg-transparent transition-transform duration-500 ${large ? 'scale-[1.25] group-hover:scale-[1.32]' : 'scale-[1.3] group-hover:scale-[1.42]'}`} />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {listing.discount > 0 && <span className="rounded-md bg-[#facc15] px-1.5 py-0.5 text-[11.5px] font-bold text-[#1a1405]">−{listing.discount} %</span>}
          {listing.availableUntil && variant === 'shop' && <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur">Begrenzt</span>}
        </div>
        {owned && <span className="absolute right-2.5 top-2.5 flex h-6 items-center gap-1 rounded-md bg-black/55 px-1.5 text-[11px] font-semibold text-[#86efac] backdrop-blur"><Glyph name="check" size={13} /> Im Besitz</span>}
      </div>
      <div className="relative w-full px-3.5 pb-4 pt-2.5">
        <div className="text-[10.5px] font-bold uppercase tracking-[.14em]" style={{ color: tint }}>{RARITY_LABELS[item.rarity]} · {SLOT_LABELS[item.slot]}</div>
        <h3 className={`mt-1 truncate font-bold uppercase leading-tight tracking-[.02em] text-white ${large ? 'text-[22px]' : 'text-[14.5px]'}`}>{item.name}</h3>
        <div className="mt-2 flex min-h-6 items-center gap-2 text-[15px] font-bold text-white">
          {owned
            ? <span className="text-[12.5px] font-semibold text-white/60">Anlegen →</span>
            : forSale(item) ? <Price price={item.price} finalPrice={listing.finalPrice} /> : <span className="text-[12px] font-medium text-white/55">{NOT_FOR_SALE[item.availability] ?? 'Nicht käuflich'}</span>}
        </div>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: tint }} />
    </button>
  );
}

/** One horizontal shelf of big cards (scrolls sideways; arrows on wide screens). */
function Shelf({ title, hint, listings, owned, onOpen, onAll }: {
  title: string; hint?: string; listings: ShopListing[]; owned: Set<string>; onOpen: (id: string) => void; onAll?: () => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: reducedMotion() ? 'auto' : 'smooth' });
  if (!listings.length) return null;
  return (
    <section className="mt-10">
      <div className="mb-3.5 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] text-mute">{hint}</p>}
        </div>
        {onAll && <button type="button" className="btn btn-ghost btn-sm" onClick={onAll}>Alle anzeigen</button>}
        <div className="hidden gap-1.5 md:flex">
          <button type="button" className="icon-btn" aria-label="Zurück blättern" onClick={() => scroll(-1)}><Icon name="arrowLeft" size={18} /></button>
          <button type="button" className="icon-btn" aria-label="Weiter blättern" onClick={() => scroll(1)}><Icon name="arrowRight" size={18} /></button>
        </div>
      </div>
      <div ref={track} className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:-mx-2 md:scroll-px-2 md:px-2">
        {listings.map((l) => (
          <StoreCard key={l.item.id} listing={l} owned={owned.has(l.item.id)} variant="shop" onOpen={() => onOpen(l.item.id)} className="w-[200px] shrink-0 snap-start md:w-[220px]" />
        ))}
      </div>
    </section>
  );
}

/** Shop front page: hero with the featured look, shelves per topic, then the full searchable catalog. */
export function Storefront({ listings, events, upcoming }: { listings: ShopListing[]; events: ShopEvent[]; upcoming: ShopEvent[] }) {
  const { me, items } = useMe();
  const user = useUser();
  const now = useNow();
  const [openId, setOpenId] = useState<string | null>(null);
  const [slot, setSlot] = useState<CosmeticSlot | 'all'>('all');
  const catalogRef = useRef<HTMLDivElement>(null);
  const owned = useMemo(() => new Set(me.inventory.map((o) => o.itemId)), [me.inventory]);
  const event = events[0];

  // Featured: the running event's own items and deals first, otherwise the most precious items you don't own yet.
  const featured = useMemo(() => {
    const inEvent = (l: ShopListing) => !!event && (l.item.eventId === event.id || l.eventId === event.id);
    const pool = listings.filter((l) => (event ? inEvent(l) : forSale(l.item)));
    const score = (l: ShopListing) => (l.item.eventId && l.item.eventId === event?.id ? 2 : 0) + (owned.has(l.item.id) ? 0 : 1);
    return [...(pool.length ? pool : listings)].sort((a, b) => score(b) - score(a) || b.finalPrice - a.finalPrice).slice(0, 8);
  }, [listings, event, owned]);
  const heroBackground = featured.filter((l) => l.item.slot === 'background').sort((a, b) => b.item.price - a.item.price)[0]?.item;
  const look = useMemo(() => {
    const catalog = new Map(items);
    let equipped = me.profile.equipped;
    // One item per slot, so the look shows the collection rather than the last badge.
    const seen = new Set<CosmeticSlot>();
    for (const { item } of featured) {
      if (seen.has(item.slot)) continue;
      seen.add(item.slot);
      catalog.set(item.id, item);
      equipped = equipItem(equipped, item);
    }
    return resolveCosmetics(equipped, catalog);
  }, [featured, items, me.profile.equipped]);

  const deals = listings.filter((l) => l.discount > 0 && !featured.includes(l));
  const fresh = [...listings].reverse().filter((l) => !featured.includes(l)).slice(0, 10);
  const bySlot = COSMETIC_SLOTS.map((s) => ({ slot: s, list: listings.filter((l) => l.item.slot === s) })).filter((g) => g.list.length >= 3)
    .sort((a, b) => b.list.length - a.list.length);
  const showAll = (next: CosmeticSlot) => {
    setSlot(next);
    catalogRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  const open = listings.find((l) => l.item.id === openId);

  return (
    <>
      {/* Showcase banner: dark in both modes, like a lit shop window. */}
      <section data-mode="dark" className="@container relative overflow-hidden rounded-[24px] border border-white/[.07]">
        <div className="absolute inset-0" style={heroBackground?.slot === 'background' ? backgroundStyle(heroBackground.data) : { background: 'var(--hero-glow), var(--brand-gradient)' }} />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,12,.94)_0%,rgba(9,9,12,.7)_45%,rgba(9,9,12,.15)_100%)]" />
        {/* Two columns only when the banner itself is wide enough (container query), so the text never gets squeezed. */}
        <div className="relative grid items-center gap-6 p-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] @3xl:p-9">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-body">
              {event
                ? <><span className="h-1.5 w-1.5 rounded-full bg-pos shadow-[0_0_8px_var(--pos)]" /> Event läuft · endet in <span className="tabular-nums text-ink">{countdown(event.endsAt, now)}</span></>
                : <><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Empfohlen für dich</>}
            </div>
            <h2 className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-tight text-ink @3xl:text-[40px]">{event ? event.name : 'Hol dir den Look'}</h2>
            <p className="mt-3 max-w-[480px] text-[14.5px] text-body">{event ? event.description : 'Die besten Stücke, die dir noch fehlen – rechts schon auf deiner Karte angelegt.'}</p>
            {event && (
              <div className="mt-5 flex max-w-[480px] items-center gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur">
                <span className="shrink-0 whitespace-nowrap text-[30px] font-light leading-none tracking-tight text-ink">−{event.discount} %</span>
                <span className="min-w-0 text-[12.5px] leading-snug text-mute">auf {event.slots ? event.slots.map((sl) => SLOT_LABELS[sl]).join(', ') : 'alles'}<br />bis {formatDate(event.endsAt)}</span>
              </div>
            )}
          </div>
          <div className="hidden max-w-[440px] @xl:block">
            <ProfileCardPreview subject={cardSubject(user, me, null, me.profile.bio)} cosmetics={look} className="w-full rounded-2xl shadow-[0_30px_60px_-20px_rgba(0,0,0,.8)] ring-1 ring-white/10" />
          </div>
        </div>
      </section>
      <section className="mt-8">
        <h2 className="mb-3.5 text-[19px] font-semibold tracking-tight">{event ? `Highlights aus „${event.name}“` : 'Empfohlen'}</h2>
        {/* Bento: one 2×2 feature tile, four regular ones. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {featured.slice(0, 5).map((l, i) => (
            <StoreCard key={l.item.id} listing={l} owned={owned.has(l.item.id)} variant="shop" onOpen={() => setOpenId(l.item.id)}
              large={i === 0} className={i === 0 ? 'col-span-2 row-span-2 aspect-[4/3] md:aspect-auto' : ''} />
          ))}
        </div>
      </section>

      <Shelf title={event ? `Mehr aus „${event.name}“` : 'Weitere Empfehlungen'} listings={featured.slice(5)} owned={owned} onOpen={setOpenId} />
      <Shelf title="Im Angebot" hint="Reduziert, solange das Event läuft." listings={deals} owned={owned} onOpen={setOpenId} />
      <Shelf title="Neu im Shop" listings={fresh} owned={owned} onOpen={setOpenId} />
      {bySlot.map((g) => (
        <Shelf key={g.slot} title={SLOT_PLURAL[g.slot]} listings={g.list} owned={owned} onOpen={setOpenId} onAll={() => showAll(g.slot)} />
      ))}
      <UpcomingEvents events={upcoming} />

      <section ref={catalogRef} className="mt-12 scroll-mt-6">
        <h2 className="mb-3 text-[19px] font-semibold tracking-tight">Alle Artikel</h2>
        <ItemBrowser listings={listings} variant="shop" slot={slot} onSlotChange={setSlot} />
      </section>
      {open && <ItemDetail listing={open} owned={owned.has(open.item.id)} onClose={() => setOpenId(null)} />}
    </>
  );
}

const SLOT_PLURAL: Record<CosmeticSlot, string> = {
  background: 'Hintergründe', accent: 'Akzentfarben', nameStyle: 'Namensfarben', frame: 'Avatar-Rahmen', badge: 'Abzeichen', title: 'Titel',
  xpBar: 'XP-Balken', font: 'Schriften', effect: 'Effekte', levelup: 'Level-up-Stile', layout: 'Kartenlayouts', sticker: 'Sticker',
};

type Sort = 'new' | 'price-asc' | 'price-desc';

/** Filterable item grid; `filters` adds slot tabs, rarity, sort, "nur leistbar" and search. */
export function ItemBrowser({ listings, variant, filters = true, slot: slotProp, onSlotChange }: {
  listings: ShopListing[]; variant: ShopVariant; filters?: boolean; slot?: CosmeticSlot | 'all'; onSlotChange?: (slot: CosmeticSlot | 'all') => void;
}) {
  const { me } = useMe();
  const [ownSlot, setOwnSlot] = useState<CosmeticSlot | 'all'>('all');
  const slot = slotProp ?? ownSlot;
  const setSlot = onSlotChange ?? setOwnSlot;
  const [rarity, setRarity] = useState<Rarity | 'all'>('all');
  const [sort, setSort] = useState<Sort>('new');
  const [affordable, setAffordable] = useState(false);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const owned = useMemo(() => new Set(me.inventory.map((o) => o.itemId)), [me.inventory]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = listings.filter((l) => (slot === 'all' || l.item.slot === slot)
      && (rarity === 'all' || l.item.rarity === rarity)
      && (!affordable || (forSale(l.item) && !owned.has(l.item.id) && l.finalPrice <= me.wallet.balance))
      && (!q || `${l.item.name} ${l.item.description}`.toLowerCase().includes(q)));
    // The API lists items in catalog order, so "Neueste" is the reversed order.
    return sort === 'new' ? [...list].reverse() : [...list].sort((a, b) => (sort === 'price-asc' ? 1 : -1) * (a.finalPrice - b.finalPrice));
  }, [listings, slot, rarity, affordable, query, sort, owned, me.wallet.balance]);

  useGSAP(() => {
    if (reducedMotion()) return;
    gsap.fromTo('.js-item', { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.025, ease: 'power3.out', clearProps: 'transform' });
  }, { scope: root, dependencies: [slot, rarity, sort, affordable, listings.length], revertOnUpdate: true });

  const counts = useMemo(() => new Map(COSMETIC_SLOTS.map((s) => [s, listings.filter((l) => l.item.slot === s).length])), [listings]);
  const open = listings.find((l) => l.item.id === openId);

  return (
    <div ref={root}>
      {filters && (
        <>
          <Tabs value={slot} onChange={setSlot} items={[
            { id: 'all', label: 'Alle', count: listings.length },
            ...COSMETIC_SLOTS.filter((s) => counts.get(s)).map((s) => ({ id: s, label: SLOT_LABELS[s], count: counts.get(s) })),
          ]} />
          <div className="mb-5 grid grid-cols-2 items-center gap-3 md:grid-cols-[1fr_170px_170px_auto]">
            <div className="col-span-2 md:col-span-1"><TextInput value={query} onChange={setQuery} placeholder="Artikel suchen …" /></div>
            <Select value={rarity} onChange={setRarity} options={[{ value: 'all', label: 'Alle Seltenheiten' }, ...RARITIES.map((r) => ({ value: r, label: RARITY_LABELS[r] }))]} />
            <Select value={sort} onChange={setSort} options={[{ value: 'new', label: 'Neueste zuerst' }, { value: 'price-asc', label: 'Preis aufsteigend' }, { value: 'price-desc', label: 'Preis absteigend' }]} />
            <label className="col-span-2 flex cursor-pointer items-center gap-2.5 text-[13.5px] text-body md:col-span-1">
              <Switch checked={affordable} onChange={setAffordable} label="Nur leistbar" /> Nur leistbar
            </label>
          </div>
        </>
      )}
      {shown.length === 0
        ? <Empty title="Nichts gefunden">Probier andere Filter{affordable ? ' oder hol dir erst den Tagesbonus' : ''}.</Empty>
        : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((l) => <StoreCard key={l.item.id} listing={l} owned={owned.has(l.item.id)} variant={variant} onOpen={() => setOpenId(l.item.id)} />)}
          </div>
        )}
      {open && <ItemDetail listing={open} owned={owned.has(open.item.id)} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ---------- Detail modal ----------

/** The member's card with `item` put on (temporarily), or the level-up message for level-up styles. */
export function TryOnPreview({ item }: { item: CosmeticItem }) {
  const { me, items } = useMe();
  const user = useUser();
  const catalog = useMemo(() => new Map(items).set(item.id, item), [items, item]);
  const subject = cardSubject(user, me, null, me.profile.bio);
  const cosmetics = resolveCosmetics(equipItem(me.profile.equipped, item), catalog);
  return item.slot === 'levelup'
    ? <LevelUpPreview subject={subject} cosmetics={cosmetics} level={subject.level + 1} reward={levelUpReward(subject.level + 1)} />
    : <ProfileCardPreview subject={subject} cosmetics={cosmetics} className="w-full" />;
}

const SNOWFLAKE = /^\d{17,20}$/;

export function ItemDetail({ listing, owned, onClose }: { listing: ShopListing; owned: boolean; onClose: () => void }) {
  const { item } = listing;
  const { me } = useMe();
  const updateWallet = useWalletUpdate();
  const { run, busy } = useMutation();
  const equip = useEquip();
  const { confirm, dialog } = useConfirm();
  const [giftMode, setGiftMode] = useState(false);
  const [toUserId, setToUserId] = useState('');
  const [message, setMessage] = useState('');
  // Set after a successful purchase/gift: the detail turns into the "unlocked" moment.
  const [done, setDone] = useState<{ kind: 'buy' } | { kind: 'gift'; to: string } | null>(null);

  const balance = me.wallet.balance;
  const after = balance - listing.finalPrice;
  const buyable = forSale(item);
  const equipped = isEquipped(me.profile.equipped, item);

  const buy = () => confirm({
    title: 'Kauf bestätigen',
    text: <>„{item.name}“ für <Kristalle amount={listing.finalPrice} /> kaufen? Danach hast du noch <Kristalle amount={after} />.</>,
    confirmLabel: 'Kaufen', danger: false,
    onConfirm: async () => {
      const result = await run<PurchaseResult>('/me/shop/buy', 'POST', { itemId: item.id });
      if (result) { updateWallet(result.wallet, result.inventory); setDone({ kind: 'buy' }); }
    },
  });
  const gift = () => confirm({
    title: 'Geschenk senden',
    text: <>„{item.name}“ für <Kristalle amount={listing.finalPrice} /> an <code>{toUserId}</code> verschenken? Danach hast du noch <Kristalle amount={after} />.</>,
    confirmLabel: 'Verschenken', danger: false,
    onConfirm: async () => {
      const result = await run<PurchaseResult>('/me/shop/gift', 'POST', { itemId: item.id, toUserId, ...(message.trim() ? { message: message.trim() } : {}) });
      if (result) { updateWallet(result.wallet, result.inventory); setGiftMode(false); setDone({ kind: 'gift', to: toUserId }); setToUserId(''); setMessage(''); }
    },
  });

  if (done) {
    const tile = <StoreCard listing={listing} owned={done.kind === 'buy'} variant="shop" onOpen={() => undefined} className="pointer-events-none w-full" />;
    return done.kind === 'buy' ? (
      <Celebration tint={RARITY_TILE[item.rarity]} kicker="Neu freigeschaltet" title={item.name} text="gehört jetzt dir." tile={tile} onClose={onClose}
        actions={<>
          {!equipped && <button type="button" className="btn btn-primary" disabled={equip.busy}
            onClick={async () => { await equip.apply(equipItem(me.profile.equipped, item), `„${item.name}“ angelegt.`); onClose(); }}>Jetzt anlegen</button>}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Weiter stöbern</button>
        </>} />
    ) : (
      <Celebration tint={RARITY_TILE[item.rarity]} kicker="Geschenk verschickt" title={item.name} text={<>ist unterwegs zu <code>{done.to}</code>.</>} tile={tile} onClose={onClose}
        actions={<button type="button" className="btn btn-primary" onClick={onClose}>Fertig</button>} />
    );
  }

  let footer: ReactNode;
  if (giftMode) {
    footer = (
      <>
        <button type="button" className="btn btn-secondary" onClick={() => setGiftMode(false)}>Zurück</button>
        <button type="button" className="btn btn-primary" disabled={busy || after < 0 || !SNOWFLAKE.test(toUserId)} onClick={gift}>Geschenk senden</button>
      </>
    );
  } else {
    footer = (
      <>
        <button type="button" className="btn btn-ghost mr-auto" onClick={onClose}>Schließen</button>
        {buyable && <button type="button" className="btn btn-secondary" disabled={busy || after < 0} onClick={() => setGiftMode(true)}>Verschenken</button>}
        {owned
          ? <button type="button" className="btn btn-primary" disabled={equip.busy || equipped} onClick={() => equip.apply(equipItem(me.profile.equipped, item), `„${item.name}“ angelegt.`)}>{equipped ? 'Angelegt' : 'Jetzt anlegen'}</button>
          : buyable && <button type="button" className="btn btn-primary" disabled={busy || after < 0} onClick={buy}>{after < 0 ? 'Nicht genug Kristalle' : 'Kaufen'}</button>}
      </>
    );
  }

  return (
    <>
      <Modal title={item.name} onClose={onClose} footer={footer}>
        <div className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-mute">
          {SLOT_LABELS[item.slot]} · <RarityLabel rarity={item.rarity} />
          {listing.availableUntil && <span className="badge badge-warn">bis {formatDate(listing.availableUntil)}</span>}
        </div>
        <div className="max-h-[62vh] space-y-4 overflow-y-auto">
          <div>
            <p className="mb-2 text-[12.5px] font-medium text-mute">Vorschau auf deiner Karte</p>
            <TryOnPreview item={item} />
          </div>
          <div className="flex gap-4">
            <ItemVisual item={item} className="w-28 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-body">{item.description}</p>
              <div className="mt-3 text-[15px]">
                {owned ? <span className="text-pos">Im Besitz</span>
                  : buyable ? <Price price={item.price} finalPrice={listing.finalPrice} /> : <span className="text-faint">{NOT_FOR_SALE[item.availability] ?? 'Nicht käuflich'}</span>}
              </div>
              {buyable && !owned && after >= 0 && <p className="mt-1 text-[12.5px] text-faint">Danach: <Kristalle amount={after} /></p>}
            </div>
          </div>
          {buyable && after < 0 && (
            <Notice tone="warn">Dir fehlen <Kristalle amount={-after} />. Hol dir den <Link to="/me">Tagesbonus</Link>, spiel Minispiele oder steig im Level auf.</Notice>
          )}
          {giftMode && (
            <div className="stack rounded-2xl border border-white/[.06] p-4">
              <Field label="Discord-Nutzer-ID" hint="Rechtsklick auf das Profil → „Nutzer-ID kopieren“ (Entwicklermodus)." error={toUserId && !SNOWFLAKE.test(toUserId) ? 'Eine Nutzer-ID hat 17–20 Ziffern.' : null}>
                <TextInput value={toUserId} onChange={(v) => setToUserId(v.trim())} placeholder="z. B. 401234567890123456" maxLength={20} />
              </Field>
              <Field label="Nachricht (optional)" hint={`${message.length}/100`}>
                <TextInput value={message} onChange={setMessage} placeholder="Viel Spaß damit!" maxLength={100} />
              </Field>
              <p className="faint">Kostet dich <Kristalle amount={listing.finalPrice} /> – auch wenn du den Artikel selbst schon hast.</p>
            </div>
          )}
        </div>
      </Modal>
      {dialog}
    </>
  );
}
