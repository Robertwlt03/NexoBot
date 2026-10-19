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
import { ItemVisual, Kristalle, Price, RARITY_CLASS, RarityLabel } from './visuals';

export type ShopVariant = 'shop' | 'blackmarket';

const NOT_FOR_SALE: Partial<Record<CosmeticItem['availability'], string>> = {
  achievement: 'Gibt es nur über Erfolge',
  ranking: 'Gibt es nur über die Monatsranglisten',
};
const forSale = (item: CosmeticItem) => item.price > 0 && !NOT_FOR_SALE[item.availability];

// ---------- Event banner & upcoming strip ----------

export function EventHero({ event }: { event: ShopEvent }) {
  const now = useNow();
  return (
    <section className="card card-hero relative overflow-hidden">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-accent-text">
            <span className="h-1.5 w-1.5 rounded-full bg-pos shadow-[0_0_8px_var(--pos)]" /> Event läuft · endet in <span className="tabular-nums text-ink">{countdown(event.endsAt, now)}</span>
          </div>
          <h2 className="mt-3 text-[26px] font-semibold tracking-tight">{event.name}</h2>
          <p className="mt-2 max-w-[560px] text-[14px] text-[#cbc4f0]">{event.description}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
            {(event.slots ?? ['Alle Artikel']).map((slot) => (
              <span key={slot} className="rounded-full border border-white/10 bg-white/[.05] px-3 py-1 text-body">{slot in SLOT_LABELS ? SLOT_LABELS[slot as CosmeticSlot] : slot}</span>
            ))}
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-[56px] font-extralight leading-none tracking-[-0.04em] text-ink">−{event.discount} %</div>
          <div className="mt-1 text-[12.5px] text-[var(--accent-text-muted)]">bis {formatDate(event.endsAt)}</div>
        </div>
      </div>
    </section>
  );
}

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

// ---------- Item card & grid ----------

function ItemCard({ listing, owned, variant, onOpen }: { listing: ShopListing; owned: boolean; variant: ShopVariant; onOpen: () => void }) {
  const { item } = listing;
  const dark = variant === 'blackmarket';
  return (
    <button type="button" onClick={onOpen}
      className={`js-item group flex cursor-pointer flex-col rounded-2xl border p-2.5 text-left font-[inherit] text-body transition duration-300 hover:-translate-y-0.5 ${RARITY_CLASS[item.rarity].border} ${dark ? 'bg-[#0c0c10] hover:bg-[#121217]' : 'bg-surface hover:bg-raised'}`}>
      <div className="relative w-full">
        <ItemVisual item={item} />
        {listing.discount > 0 && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11.5px] font-medium text-ink backdrop-blur">−{listing.discount} %</span>}
        {dark && <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-rose-200/90 backdrop-blur">Nur diese Woche</span>}
      </div>
      <div className="w-full px-1.5 pb-1 pt-3">
        <h3 className="truncate text-[14px] font-medium">{item.name}</h3>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-faint">{SLOT_LABELS[item.slot]} · <RarityLabel rarity={item.rarity} /></div>
        <div className="mt-2.5 flex min-h-6 items-center justify-between gap-2 text-[13.5px]">
          {owned
            ? <span className="text-[12.5px] text-pos">Im Besitz</span>
            : forSale(item) ? <Price price={item.price} finalPrice={listing.finalPrice} /> : <span className="text-[12.5px] text-faint">Nicht käuflich</span>}
          {listing.availableUntil && !dark && <span className="text-[11.5px] text-faint">bis {formatDate(listing.availableUntil)}</span>}
        </div>
      </div>
    </button>
  );
}

type Sort = 'new' | 'price-asc' | 'price-desc';

/** Filterable item grid; `filters` adds slot tabs, rarity, sort, "nur leistbar" and search. */
export function ItemBrowser({ listings, variant, filters = true }: { listings: ShopListing[]; variant: ShopVariant; filters?: boolean }) {
  const { me } = useMe();
  const [slot, setSlot] = useState<CosmeticSlot | 'all'>('all');
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
            {shown.map((l) => <ItemCard key={l.item.id} listing={l} owned={owned.has(l.item.id)} variant={variant} onOpen={() => setOpenId(l.item.id)} />)}
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
