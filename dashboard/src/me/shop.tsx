// Shop building blocks shared by the shop and the black market: filters, item grid, detail modal with buy/gift.
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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
import { ItemVisual, Kristalle, Price, RARITY_CLASS, RarityLabel, backgroundStyle } from './visuals';
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

/** Soft light behind the item art, per rarity (same tints as RARITY_CLASS). */
const RARITY_GLOW: Record<Rarity, string> = {
  common: 'rgba(255,255,255,.08)', rare: 'rgba(56,189,248,.22)', epic: 'rgba(167,139,250,.26)', legendary: 'rgba(252,211,77,.22)', mythic: 'rgba(244,63,94,.24)',
};

/** Big product tile: large artwork, name, slot and the price front and centre. */
function StoreCard({ listing, owned, variant, onOpen, className = '' }: { listing: ShopListing; owned: boolean; variant: ShopVariant; onOpen: () => void; className?: string }) {
  const { item } = listing;
  const dark = variant === 'blackmarket';
  return (
    <button type="button" onClick={onOpen}
      className={`js-item group flex cursor-pointer flex-col overflow-hidden rounded-[20px] border p-0 text-left font-[inherit] text-body transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,.8)] ${RARITY_CLASS[item.rarity].border} ${dark ? 'bg-[#0c0c10] hover:bg-[#121217]' : 'bg-surface hover:bg-raised'} ${className}`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0d0d12]">
        <ItemVisual item={item} className="h-full w-full scale-[1.3] rounded-none bg-transparent transition-transform duration-500 group-hover:scale-[1.42]" />
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(70% 60% at 50% 110%, ${RARITY_GLOW[item.rarity]}, transparent 70%)` }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
        {listing.discount > 0 && <span className="absolute left-3 top-3 rounded-full bg-pos/90 px-2 py-0.5 text-[12px] font-semibold text-[#06140d]">−{listing.discount} %</span>}
        {dark && <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-rose-200/90 backdrop-blur">Nur diese Woche</span>}
        {owned && <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[11.5px] font-medium text-pos backdrop-blur">Im Besitz</span>}
      </div>
      <div className="flex w-full flex-1 flex-col px-4 pb-4 pt-3">
        <h3 className="truncate text-[15px] font-semibold tracking-tight text-ink">{item.name}</h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-faint">{SLOT_LABELS[item.slot]} · <RarityLabel rarity={item.rarity} /></div>
        <div className="mt-auto flex min-h-7 items-center justify-between gap-2 pt-3 text-[16px] font-semibold text-ink">
          {owned
            ? <span className="text-[13px] font-medium text-mute">Anlegen →</span>
            : forSale(item) ? <Price price={item.price} finalPrice={listing.finalPrice} /> : <span className="text-[12.5px] font-normal text-faint">Nicht käuflich</span>}
        </div>
      </div>
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
          <StoreCard key={l.item.id} listing={l} owned={owned.has(l.item.id)} variant="shop" onOpen={() => onOpen(l.item.id)} className="w-[220px] shrink-0 snap-start md:w-[236px]" />
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
      <section data-mode="dark" className="relative overflow-hidden rounded-[24px] border border-white/[.07]">
        <div className="absolute inset-0" style={heroBackground?.slot === 'background' ? backgroundStyle(heroBackground.data) : { background: 'var(--hero-glow), var(--brand-gradient)' }} />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,12,.94)_0%,rgba(9,9,12,.7)_45%,rgba(9,9,12,.15)_100%)]" />
        <div className="relative grid items-center gap-6 p-6 pb-24 md:grid-cols-[1fr_minmax(0,420px)] md:p-9 md:pb-28">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-body">
              {event
                ? <><span className="h-1.5 w-1.5 rounded-full bg-pos shadow-[0_0_8px_var(--pos)]" /> Event läuft · endet in <span className="tabular-nums text-ink">{countdown(event.endsAt, now)}</span></>
                : <><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Empfohlen für dich</>}
            </div>
            <h2 className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-tight text-ink md:text-[40px]">{event ? event.name : 'Hol dir den Look'}</h2>
            <p className="mt-3 max-w-[480px] text-[14.5px] text-body">{event ? event.description : 'Die besten Stücke, die dir noch fehlen – rechts schon auf deiner Karte angelegt.'}</p>
            {event && (
              <div className="mt-5 inline-flex items-baseline gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2 backdrop-blur">
                <span className="whitespace-nowrap text-[28px] font-light leading-none tracking-tight text-ink">−{event.discount} %</span>
                <span className="text-[12.5px] text-mute">auf {event.slots ? event.slots.map((sl) => SLOT_LABELS[sl]).join(', ') : 'alles'} · bis {formatDate(event.endsAt)}</span>
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <ProfileCardPreview subject={cardSubject(user, me, null, me.profile.bio)} cosmetics={look} className="w-full rounded-2xl shadow-[0_30px_60px_-20px_rgba(0,0,0,.8)] ring-1 ring-white/10" />
          </div>
        </div>
      </section>
      <div className="relative z-10 -mt-20 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:px-6">
        {featured.slice(0, 4).map((l) => (
          <StoreCard key={l.item.id} listing={l} owned={owned.has(l.item.id)} variant="shop" onOpen={() => setOpenId(l.item.id)}
            className="w-[220px] shrink-0 snap-start md:w-auto md:min-w-0 md:flex-1" />
        ))}
      </div>

      <Shelf title={event ? `Mehr aus „${event.name}“` : 'Weitere Empfehlungen'} listings={featured.slice(4)} owned={owned} onOpen={setOpenId} />
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

function ItemDetail({ listing, owned, onClose }: { listing: ShopListing; owned: boolean; onClose: () => void }) {
  const { item } = listing;
  const { me } = useMe();
  const updateWallet = useWalletUpdate();
  const { run, busy } = useMutation();
  const equip = useEquip();
  const { confirm, dialog } = useConfirm();
  const [giftMode, setGiftMode] = useState(false);
  const [toUserId, setToUserId] = useState('');
  const [message, setMessage] = useState('');

  const balance = me.wallet.balance;
  const after = balance - listing.finalPrice;
  const buyable = forSale(item);
  const equipped = isEquipped(me.profile.equipped, item);

  const buy = () => confirm({
    title: 'Kauf bestätigen',
    text: <>„{item.name}“ für <Kristalle amount={listing.finalPrice} /> kaufen? Danach hast du noch <Kristalle amount={after} />.</>,
    confirmLabel: 'Kaufen', danger: false,
    onConfirm: async () => {
      const result = await run<PurchaseResult>('/me/shop/buy', 'POST', { itemId: item.id }, `„${item.name}“ gehört jetzt dir.`);
      if (result) updateWallet(result.wallet, result.inventory);
    },
  });
  const gift = () => confirm({
    title: 'Geschenk senden',
    text: <>„{item.name}“ für <Kristalle amount={listing.finalPrice} /> an <code>{toUserId}</code> verschenken? Danach hast du noch <Kristalle amount={after} />.</>,
    confirmLabel: 'Verschenken', danger: false,
    onConfirm: async () => {
      const result = await run<PurchaseResult>('/me/shop/gift', 'POST', { itemId: item.id, toUserId, ...(message.trim() ? { message: message.trim() } : {}) }, 'Geschenk ist unterwegs.');
      if (result) { updateWallet(result.wallet, result.inventory); setGiftMode(false); setToUserId(''); setMessage(''); }
    },
  });

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
