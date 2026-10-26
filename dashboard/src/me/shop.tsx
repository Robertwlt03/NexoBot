// Shop building blocks shared by the shop and the black market: filters, item grid, detail modal with buy/gift.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { COSMETIC_SLOTS, RARITIES, RARITY_LABELS, SLOT_LABELS, levelUpReward } from '../../../src/shared/cosmetics';
import type { CosmeticItem, CosmeticSlot, Rarity } from '../../../src/shared/cosmetics';
import type { PurchaseResult, ShopBundle, ShopEvent, ShopListing } from '../../../src/web/dto/profile';
import { useUser } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { ProfileCardPreview } from '../components/ProfileCardPreview';
import { ProductStage, TryOnPreview } from './ProductStage';
import { Empty, Field, Notice, Select, Switch, Tabs, TextInput } from '../components/ui';
import {
  cardSubject, countdown, equipItem, formatDate, isEquipped, reducedMotion, resolveCosmetics, startsIn, useEquip, useMe, useMutation, useNow, useWalletUpdate,
} from './api';
import { Glyph, ItemVisual, Bernis, Price, RARITY_TILE, RarityLabel, backgroundStyle } from './visuals';
import { ProductDialog } from './ProductDialog';
import { BundleSection } from './bundles';
import { Celebration } from './Celebration';
import { EventBackdrop, EventIcon, SCENE_ROOM, eventTheme } from './EventScene';
import { Icon } from '../icons';

export type ShopVariant = 'shop' | 'blackmarket';

const NOT_FOR_SALE: Partial<Record<CosmeticItem['availability'], string>> = {
  achievement: 'Gibt es nur über Erfolge',
  ranking: 'Gibt es nur über die Monatsranglisten',
  season: 'Gibt es nur über den Saisonpfad',
};
const forSale = (item: CosmeticItem) => item.price > 0 && !NOT_FOR_SALE[item.availability];

// ---------- Store card & storefront ----------


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
        {item.slot === 'background' ? (
          // Backgrounds: your own card as it is now, only with this background, tilted like a store preview.
          <div className={`absolute origin-top-left overflow-hidden rounded-lg shadow-[0_20px_44px_-14px_rgba(0,0,0,.9)] ring-1 ring-white/15 transition-transform duration-500 ${large ? 'left-[8%] top-[24%] w-[118%] -rotate-[7deg] group-hover:-rotate-[5deg] group-hover:scale-[1.03]' : 'left-[5%] top-[30%] w-[122%] -rotate-[9deg] group-hover:-rotate-[7deg] group-hover:scale-[1.04]'}`}>
            <TryOnPreview items={[item]} resolution={0.5} />
          </div>
        ) : (
          <ItemVisual item={item} className={`h-full w-full rounded-none !bg-transparent transition-transform duration-500 ${large ? 'scale-[1.25] group-hover:scale-[1.32]' : 'scale-[1.3] group-hover:scale-[1.42]'}`} />
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {listing.discount > 0 && <span className="rounded-md bg-[#facc15] px-1.5 py-0.5 text-[11.5px] font-bold text-[#1a1405]">−{listing.discount} %</span>}
          {listing.availableUntil && variant === 'shop' && <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur">Begrenzt</span>}
        </div>
        {owned && <span className="absolute right-2.5 top-2.5 flex h-6 items-center gap-1 rounded-md bg-black/55 px-1.5 text-[11px] font-semibold text-[#86efac] backdrop-blur"><Glyph name="check" size={13} /> Im Besitz</span>}
      </div>
      <div className="relative w-full px-3.5 pb-4 pt-2.5">
        <div className="text-[10.5px] font-bold uppercase tracking-[.14em]" style={{ color: tint }}>{RARITY_LABELS[item.rarity]} · {SLOT_LABELS[item.slot]}</div>
        <h3 className={`mt-1 truncate font-sans font-bold uppercase leading-tight tracking-[.02em] text-white ${large ? 'text-[22px]' : 'text-[14.5px]'}`}>{item.name}</h3>
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

/** One line under the banner: the next event and its discount; the full list lives on the season page. */
function NextEvent({ events }: { events: ShopEvent[] }) {
  const now = useNow(60_000);
  const next = events[0];
  if (!next) return null;
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[13.5px] text-mute">
      <EventIcon event={next} />
      Nächstes Event: <span className="text-ink">{next.name}</span>
      <span>{startsIn(next.startsAt, now)}{next.discount > 0 ? `, −${next.discount} %` : ''}</span>
      <Link to="/me/saison" className="ml-auto text-accent-text">Alle Events</Link>
    </p>
  );
}

export function Storefront({ listings, bundles, events, upcoming }: { listings: ShopListing[]; bundles: ShopBundle[]; events: ShopEvent[]; upcoming: ShopEvent[] }) {
  const { me, items } = useMe();
  const user = useUser();
  const now = useNow();
  const [openId, setOpenId] = useState<string | null>(null);
  const owned = useMemo(() => new Set(me.inventory.map((o) => o.itemId)), [me.inventory]);
  const event = events[0];
  const theme = event ? eventTheme(event) : null;

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

  const open = listings.find((l) => l.item.id === openId);

  return (
    <>
      {/* Showcase banner: dark in both modes, like a lit shop window. */}
      <section data-mode="dark" className="@container relative overflow-hidden rounded-[24px] border border-white/[.07]">
        <div className="absolute inset-0" style={heroBackground?.slot === 'background' ? backgroundStyle(heroBackground.data) : { background: 'var(--hero-glow), var(--brand-gradient)' }} />
        {/* With an event scene the right side stays dark too, so the scene reads against a calm ground. */}
        <div className={`absolute inset-0 ${theme ? 'bg-[linear-gradient(90deg,rgba(9,9,12,.94)_0%,rgba(9,9,12,.72)_50%,rgba(9,9,12,.5)_100%)]' : 'bg-[linear-gradient(90deg,rgba(9,9,12,.94)_0%,rgba(9,9,12,.7)_45%,rgba(9,9,12,.15)_100%)]'}`} />
        {theme && event && <EventBackdrop theme={theme} discount={event.discount} />}
        {/* Two columns only when the banner itself is wide enough (container query), so the text never gets squeezed. */}
        <div className={`relative grid items-center gap-6 p-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] @3xl:p-9 ${theme ? SCENE_ROOM : ''}`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-body">
              {event
                ? <><span className="h-1.5 w-1.5 rounded-full bg-pos shadow-[0_0_8px_var(--pos)]" /> Event läuft · endet in <span className="tabular-nums text-ink">{countdown(event.endsAt, now)}</span></>
                : <><span className="h-1.5 w-1.5 rounded-full bg-accent" /> Empfohlen für dich</>}
            </div>
            <h2 className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-tight text-ink @3xl:text-[40px]">{event ? event.name : 'Hol dir den Look'}</h2>
            <p className="mt-3 max-w-[480px] text-[14.5px] text-body">{event ? event.description : 'Die besten Stücke, die dir noch fehlen – rechts schon auf deiner Karte angelegt.'}</p>
            {event && event.discount === 0 && <p className="mt-5 text-[13px] text-mute">Läuft bis {formatDate(event.endsAt)}</p>}
            {event && event.discount > 0 && (
              <div className="mt-5 flex max-w-[480px] items-center gap-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur">
                <span className="shrink-0 whitespace-nowrap text-[24px] font-light leading-none tracking-tight text-ink @md:text-[30px]">−{event.discount} %</span>
                <span className="min-w-0 text-[12.5px] leading-snug text-mute">auf {event.slots ? event.slots.map((sl) => SLOT_LABELS[sl]).join(', ') : 'alles'}<br />bis {formatDate(event.endsAt)}</span>
              </div>
            )}
          </div>
          <div className="hidden max-w-[440px] @xl:block">
            <ProfileCardPreview subject={cardSubject(user, me, null, me.profile.bio)} cosmetics={look} className="w-full rounded-2xl shadow-[0_30px_60px_-20px_rgba(0,0,0,.8)] ring-1 ring-white/10" />
          </div>
        </div>
      </section>
      <NextEvent events={upcoming} />
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

      <BundleSection bundles={bundles} listings={listings} />

      {/* The whole catalogue: kinds as tabs, "new" as the default order, deals as a switch (on while an event discounts). */}
      <section className="mt-12">
        <h2 className="mb-3 text-[19px] font-semibold tracking-tight">Alle Artikel</h2>
        <ItemBrowser listings={listings} variant="shop" dealsFirst={!!event && event.discount > 0 && listings.some((l) => l.discount > 0)} />
      </section>
      {open && <ItemDetail listing={open} owned={owned.has(open.item.id)} onClose={() => setOpenId(null)} />}
    </>
  );
}

type Sort = 'new' | 'price-asc' | 'price-desc';

/** Filterable item grid; `filters` adds slot tabs, rarity, sort, "nur leistbar", "nur im Angebot" and search. */
export function ItemBrowser({ listings, variant, filters = true, dealsFirst = false }: {
  listings: ShopListing[]; variant: ShopVariant; filters?: boolean; dealsFirst?: boolean;
}) {
  const { me } = useMe();
  const [slot, setSlot] = useState<CosmeticSlot | 'all'>('all');
  const [deals, setDeals] = useState(dealsFirst);
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
      && (!deals || l.discount > 0)
      && (!q || `${l.item.name} ${l.item.description}`.toLowerCase().includes(q)));
    // The API lists items in catalog order, so "Neueste" is the reversed order.
    return sort === 'new' ? [...list].reverse() : [...list].sort((a, b) => (sort === 'price-asc' ? 1 : -1) * (a.finalPrice - b.finalPrice));
  }, [listings, slot, rarity, affordable, deals, query, sort, owned, me.wallet.balance]);

  useGSAP(() => {
    if (reducedMotion()) return;
    gsap.fromTo('.js-item', { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.025, ease: 'power3.out', clearProps: 'transform' });
  }, { scope: root, dependencies: [slot, rarity, sort, affordable, deals, listings.length], revertOnUpdate: true });

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
          <div className="mb-5 grid grid-cols-2 items-center gap-3 md:grid-cols-[1fr_170px_170px_auto_auto]">
            <div className="col-span-2 md:col-span-1"><TextInput value={query} onChange={setQuery} placeholder="Artikel suchen …" /></div>
            <Select value={rarity} onChange={setRarity} options={[{ value: 'all', label: 'Alle Seltenheiten' }, ...RARITIES.map((r) => ({ value: r, label: RARITY_LABELS[r] }))]} />
            <Select value={sort} onChange={setSort} options={[{ value: 'new', label: 'Neueste zuerst' }, { value: 'price-asc', label: 'Preis aufsteigend' }, { value: 'price-desc', label: 'Preis absteigend' }]} />
            <label className="col-span-2 flex cursor-pointer items-center gap-2.5 text-[13.5px] text-body md:col-span-1">
              <Switch checked={affordable} onChange={setAffordable} label="Nur leistbar" /> Nur leistbar
            </label>
            <label className="col-span-2 flex cursor-pointer items-center gap-2.5 text-[13.5px] text-body md:col-span-1">
              <Switch checked={deals} onChange={setDeals} label="Nur im Angebot" /> Nur im Angebot
            </label>
          </div>
        </>
      )}
      {shown.length === 0
        ? <Empty title="Nichts gefunden">{deals && !listings.some((l) => l.discount > 0) ? 'Gerade ist nichts reduziert.' : <>Probier andere Filter{affordable ? ' oder hol dir erst den Tagesbonus' : ''}.</>}</Empty>
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
    text: <>„{item.name}“ für <Bernis amount={listing.finalPrice} /> kaufen? Danach hast du noch <Bernis amount={after} />.</>,
    confirmLabel: 'Kaufen', danger: false,
    onConfirm: async () => {
      const result = await run<PurchaseResult>('/me/shop/buy', 'POST', { itemId: item.id });
      if (result) { updateWallet(result.wallet, result.inventory); setDone({ kind: 'buy' }); }
    },
  });
  const gift = () => confirm({
    title: 'Geschenk senden',
    text: <>„{item.name}“ für <Bernis amount={listing.finalPrice} /> an <code>{toUserId}</code> verschenken? Danach hast du noch <Bernis amount={after} />.</>,
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

  const tint = RARITY_TILE[item.rarity];
  const putOn = () => equip.apply(equipItem(me.profile.equipped, item), `„${item.name}“ angelegt.`);
  const where = WHERE_IT_SHOWS[item.slot];

  return (
    <>
      <ProductDialog title={item.name} onClose={onClose}
        stage={<ProductStage items={[item]} tint={tint} kicker={`${RARITY_LABELS[item.rarity]} · ${SLOT_LABELS[item.slot]}`} />}>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6 md:p-7">
          {/* The item itself, big, on its rarity light (stacked layouts skip it: the stage above shows it; the gift form needs the room). */}
          <div className={`game-tile-field relative mx-auto aspect-square w-full max-w-[260px] shrink-0 overflow-hidden rounded-[20px] ring-1 ring-white/10 max-lg:hidden ${giftMode ? 'hidden' : ''}`} style={{ '--tile': tint } as CSSProperties} data-mode="dark">
            <ItemVisual item={item} className="h-full w-full scale-[1.25] rounded-none !bg-transparent" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em]" style={{ color: tint }}>{RARITY_LABELS[item.rarity]} · {SLOT_LABELS[item.slot]}</p>
            <h2 className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight">{item.name}</h2>
            <p className="mt-2 text-[14px] text-body">{item.description}</p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] text-mute">
            <li className="flex items-center gap-2"><Glyph name="check" size={15} /> Zu sehen auf: {where}</li>
            {listing.availableUntil && <li className="flex items-center gap-2"><Glyph name="clock" size={15} /> Nur bis {formatDate(listing.availableUntil)}</li>}
            {owned && <li className="flex items-center gap-2 text-pos"><Glyph name="box" size={15} /> Schon in deinem Inventar</li>}
          </ul>

          <div className="mt-auto flex flex-col gap-3">
            {!owned && buyable && (
              <div>
                <div className="flex items-baseline gap-2 text-[26px] font-bold text-ink">
                  <Bernis amount={listing.finalPrice} large />
                  {listing.discount > 0 && <><span className="text-[15px] font-medium text-faint line-through"><Bernis amount={item.price} /></span><span className="text-[15px] font-semibold text-pos">−{listing.discount} %</span></>}
                </div>
                <p className="mt-1 text-[12.5px] text-faint">{after >= 0 ? <>Danach hast du noch <Bernis amount={after} />.</> : <>Dir fehlen <Bernis amount={-after} />.</>}</p>
              </div>
            )}
            {!buyable && !owned && <p className="text-[13.5px] text-faint">{NOT_FOR_SALE[item.availability] ?? 'Nicht käuflich'}</p>}
            {buyable && after < 0 && !owned && (
              <Notice tone="warn">Hol dir den <Link to="/me">Tagesbonus</Link>, spiel Minispiele oder steig im Level auf.</Notice>
            )}

            {giftMode ? (
              <div className="stack rounded-2xl border border-white/[.08] p-4">
                <Field label="Discord-Nutzer-ID" hint="Rechtsklick auf das Profil → „Nutzer-ID kopieren“ (Entwicklermodus)." error={toUserId && !SNOWFLAKE.test(toUserId) ? 'Eine Nutzer-ID hat 17–20 Ziffern.' : null}>
                  <TextInput value={toUserId} onChange={(v) => setToUserId(v.trim())} placeholder="z. B. 401234567890123456" maxLength={20} />
                </Field>
                <Field label="Nachricht (optional)" hint={`${message.length}/100`}>
                  <TextInput value={message} onChange={setMessage} placeholder="Viel Spaß damit!" maxLength={100} />
                </Field>
                <p className="faint">Kostet dich <Bernis amount={listing.finalPrice} /> – auch wenn du den Artikel selbst schon hast.</p>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setGiftMode(false)}>Zurück</button>
                  <button type="button" className="btn btn-primary flex-1" disabled={busy || after < 0 || !SNOWFLAKE.test(toUserId)} onClick={gift}>Geschenk senden</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {owned
                  ? <button type="button" className="btn btn-primary min-h-12 flex-1 text-[15px]" disabled={equip.busy || equipped} onClick={putOn}>{equipped ? 'Angelegt' : 'Jetzt anlegen'}</button>
                  : buyable && (
                    <button type="button" className="btn btn-primary min-h-12 flex-1 text-[15px]" disabled={busy || after < 0} onClick={buy}>
                      {after < 0 ? 'Nicht genug Bernis' : <>Für <Bernis amount={listing.finalPrice} /> kaufen</>}
                    </button>
                  )}
                {buyable && (
                  <button type="button" className="btn btn-secondary min-h-12 w-12 px-0" title="Verschenken" aria-label="Verschenken" disabled={busy || after < 0} onClick={() => setGiftMode(true)}>
                    <Glyph name="gift" size={20} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </ProductDialog>
      {dialog}
    </>
  );
}

/** Where a slot shows up, for the "you get" list. */
const WHERE_IT_SHOWS: Record<CosmeticSlot, string> = {
  background: 'deiner Profilkarte (/profil)', accent: 'deiner Profilkarte und Willkommenskarten', nameStyle: 'deiner Profilkarte (/profil)',
  frame: 'deiner Profilkarte und Willkommenskarten', badge: 'deiner Profilkarte (bis zu 3 Abzeichen)', title: 'deiner Profilkarte (/profil)',
  xpBar: 'deiner Profilkarte (/profil)', font: 'deiner Profilkarte (/profil)', effect: 'deiner Profilkarte (/profil)',
  levelup: 'deinen Level-up-Nachrichten', layout: 'deiner Profilkarte (/profil)', sticker: 'deiner Profilkarte (/profil)',
  pet: 'deiner Profilkarte – er sitzt an deinem Avatar und wächst mit deinen Chat-Tagen',
};

