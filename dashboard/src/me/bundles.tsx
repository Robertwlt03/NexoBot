// Bundles (Discord/Steam style): matching items sold together. You pay the summed current prices of the items you do
// not own yet; the detail shows your card wearing the whole set.
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { RARITIES, SLOT_LABELS } from '../../../src/shared/cosmetics';
import type { CosmeticItem } from '../../../src/shared/cosmetics';
import type { PurchaseResult, ShopBundle, ShopEvent, ShopListing } from '../../../src/web/dto/profile';
import { useConfirm } from '../components/ConfirmDialog';
import { Notice } from '../components/ui';
import { equipItem, isEquipped, useEquip, useMe, useMutation, useWalletUpdate } from './api';
import { Celebration } from './Celebration';
import { ProductDialog } from './ProductDialog';
import { ProductStage, TryOnPreview } from './ProductStage';
import { Bernis, Glyph, StruckBernis, ItemVisual, Price, RARITY_TILE, RarityLabel } from './visuals';

/** The bundle's colour: its rarest item. */
const tintOf = (items: CosmeticItem[]) =>
  RARITY_TILE[items.reduce((best, item) => (RARITIES.indexOf(item.rarity) > RARITIES.indexOf(best) ? item.rarity : best), items[0].rarity)];

/** Three items fanned out like cards in a hand: background first, then frame, then the rarest of the rest. */
export function BundleArt({ items, large = false }: { items: CosmeticItem[]; large?: boolean }) {
  const order = ['background', 'frame', 'effect', 'nameStyle', 'badge'];
  const shown = [...items].sort((a, b) => {
    const rank = (item: CosmeticItem) => (order.includes(item.slot) ? order.indexOf(item.slot) : 10) * 10 - RARITIES.indexOf(item.rarity);
    return rank(a) - rank(b);
  }).slice(0, 3);
  const size = large ? 'w-[44%]' : 'w-[38%]';
  const spots = [
    { rotate: -12, x: '-58%', y: '6%', z: 1 },
    { rotate: 0, x: '0%', y: '-4%', z: 3 },
    { rotate: 12, x: '58%', y: '6%', z: 2 },
  ];
  return (
    <div className="relative h-full w-full">
      {shown.map((item, i) => {
        const spot = shown.length === 2 ? spots[i === 0 ? 0 : 2] : spots[i];
        return (
          <div key={item.id} data-mode="dark"
            className={`absolute left-1/2 top-1/2 ${size} aspect-[3/4] overflow-hidden rounded-[14px] bg-[#0d0b0a] shadow-[0_18px_40px_-14px_rgba(0,0,0,.85)] ring-1 ring-white/15 transition-transform duration-500 group-hover:scale-[1.04]`}
            style={{ transform: `translate(-50%, -50%) translate(${spot.x}, ${spot.y}) rotate(${spot.rotate}deg)`, zIndex: spot.z }}>
            <div className="game-tile-field absolute inset-0" style={{ '--tile': RARITY_TILE[item.rarity] } as CSSProperties} />
            <ItemVisual item={item} className="h-full w-full scale-[1.15] rounded-none !bg-transparent" />
          </div>
        );
      })}
    </div>
  );
}

/** Mini thumbnails of everything inside, overlapping like a hand of cards. */
function Contents({ items }: { items: CosmeticItem[] }) {
  const shown = items.slice(0, 5);
  return (
    <span className="flex items-center">
      {shown.map((item, i) => (
        <span key={item.id} className="relative -ml-2 h-9 w-9 overflow-hidden rounded-lg bg-[#0d0b0a] ring-2 ring-[#0d0b0a] first:ml-0" style={{ zIndex: shown.length - i }}>
          <span className="game-tile-field absolute inset-0" style={{ '--tile': RARITY_TILE[item.rarity] } as CSSProperties} />
          <ItemVisual item={item} className="h-full w-full rounded-none !bg-transparent" />
        </span>
      ))}
      {items.length > shown.length && <span className="ml-1.5 text-[12px] font-semibold text-white/70">+{items.length - shown.length}</span>}
    </span>
  );
}

/**
 * Bundles are the special offers of the shop: a holographic frame that slowly circles the tile, game-style tags
 * (bundle and deal), your card wearing the whole set and what is inside right on the tile.
 */
/** "−20 % Herbst-Special auf 3 von 6 Artikeln": how much of a bundle the running event discounts; null when none. */
function eventDeal(parts: ShopListing[], event?: ShopEvent): string | null {
  if (!event || event.discount === 0) return null;
  const hit = parts.filter((part) => part.eventId === event.id && part.discount > 0);
  if (!hit.length) return null;
  return `−${event.discount} % ${event.name} auf ${hit.length === parts.length ? 'alle Artikel' : `${hit.length} von ${parts.length} Artikeln`}`;
}

function BundleTile({ bundle, items, deal, onOpen }: { bundle: ShopBundle; items: CosmeticItem[]; deal: string | null; onOpen: () => void }) {
  const tint = tintOf(items);
  const saving = bundle.owned === 0 ? bundle.fullPrice - bundle.price : 0;
  const percent = saving > 0 ? Math.round((saving / bundle.fullPrice) * 100) : 0;
  return (
    <button type="button" onClick={onOpen} data-mode="dark" style={{ '--tile': tint } as CSSProperties}
      className="js-item bundle-tile group cursor-pointer border-0 p-[1.5px] text-left font-[inherit] transition duration-300 hover:-translate-y-1">
      <span className="game-tile relative flex h-full flex-col overflow-hidden rounded-[19px] bg-[#0d0b0a]">
        <span className="game-tile-field relative block aspect-[16/9] w-full overflow-hidden">
          {/* Your own card already wearing the whole bundle, slightly tilted with room on every side. */}
          {items.some((item) => item.slot !== 'levelup') ? (
            <span className="absolute inset-0 flex items-center justify-center px-[12%] pt-[6%]">
              <span className="block w-full -rotate-[4deg] overflow-hidden rounded-xl shadow-[0_24px_50px_-16px_rgba(0,0,0,.9)] ring-1 ring-white/15 transition-transform duration-500 group-hover:-rotate-[2deg] group-hover:scale-[1.03]">
                <TryOnPreview items={items.filter((item) => item.slot !== 'levelup')} resolution={0.5} />
              </span>
            </span>
          ) : <BundleArt items={items} />}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0d0b0a] to-transparent" />
          {/* Shop-tile tags as in games: slanted labels bleeding off the edge – what it is on the left, the deal on the right. */}
          <span className="absolute left-0 top-4 z-10 flex drop-shadow-[0_6px_10px_rgba(0,0,0,.6)]">
            <span className="-ml-2 -skew-x-12 py-1 pl-5 pr-3" style={{ background: 'color-mix(in srgb, var(--tile) 45%, #000)' }}>
              <span className="block skew-x-12 text-[12.5px] font-black uppercase italic tracking-[.12em] text-white">Paket</span>
            </span>
            <span className="-skew-x-12 bg-[#0d0b0a]/85 px-2.5 py-1">
              <span className="block skew-x-12 text-[11px] font-bold uppercase tracking-[.08em] text-white/85">{items.length} Artikel</span>
            </span>
          </span>
          {percent > 0 && (
            <span className="absolute right-0 top-4 z-10 -mr-2 -skew-x-12 bg-[#facc15] py-1 pl-3 pr-5 drop-shadow-[0_6px_10px_rgba(0,0,0,.6)]">
              <span className="block skew-x-12 text-[13px] font-black italic tabular-nums text-[#1a1405]">−{percent} %</span>
            </span>
          )}
        </span>
        <span className="relative flex w-full flex-1 flex-col px-5 pb-5 pt-1">
          <span className="block truncate text-[19px] font-extrabold uppercase tracking-[.02em] text-white">{bundle.name}</span>
          <span className="mt-0.5 line-clamp-1 block text-[13px] text-white/60">{bundle.description}</span>
          {deal && <span className="mt-2 inline-flex self-start rounded-md bg-[#facc15]/15 px-2 py-0.5 text-[12px] font-semibold text-[#facc15]">{deal}</span>}
          <span className="mt-3.5 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
            <Contents items={items} />
            <span className="ml-auto shrink-0 text-right">
              <span className="flex items-center justify-end gap-2 text-[18px] font-bold text-white">
                {bundle.price > 0 ? <Price price={bundle.fullPrice} finalPrice={bundle.price} /> : <span className="text-[13px] font-semibold text-[#86efac]">Alles im Besitz</span>}
              </span>
              {saving > 0 && <span className="mt-0.5 block text-[12px] font-semibold text-[#86efac]">Du sparst <Bernis amount={saving} /></span>}
              {bundle.owned > 0 && bundle.price > 0 && <span className="mt-0.5 block text-[12px] font-medium text-white/60">{bundle.owned} schon im Besitz</span>}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}

function BundleDetail({ bundle, parts, deal, onClose }: { bundle: ShopBundle; parts: ShopListing[]; deal: string | null; onClose: () => void }) {
  const { me } = useMe();
  const updateWallet = useWalletUpdate();
  const { run, busy } = useMutation();
  const equip = useEquip();
  const { confirm, dialog } = useConfirm();
  // How many items the purchase added (counted before the inventory updates).
  const [bought, setBought] = useState<number | null>(null);
  const items = parts.map((part) => part.item);
  const owned = new Set(me.inventory.map((entry) => entry.itemId));
  const missing = parts.filter((part) => !owned.has(part.item.id));
  const after = me.wallet.balance - bundle.price;
  const tint = tintOf(items);
  const wearAll = () => equip.apply(items.reduce((equipped, item) => equipItem(equipped, item), me.profile.equipped), `„${bundle.name}“ angelegt.`);
  const allWorn = items.every((item) => isEquipped(me.profile.equipped, item));

  const buy = () => confirm({
    title: 'Paket kaufen',
    text: <>„{bundle.name}“ ({missing.length} Artikel) für <Bernis amount={bundle.price} /> kaufen? Danach hast du noch <Bernis amount={after} />.</>,
    confirmLabel: 'Kaufen', danger: false,
    onConfirm: async () => {
      const result = await run<PurchaseResult>('/me/shop/buy-bundle', 'POST', { bundleId: bundle.id });
      if (result) { const count = missing.length; updateWallet(result.wallet, result.inventory); setBought(count); }
    },
  });

  if (bought !== null) {
    return (
      <Celebration tint={tint} kicker="Paket freigeschaltet" title={bundle.name} text={`${bought} Artikel gehören jetzt dir.`} onClose={onClose}
        tile={<div className="aspect-[3/4] w-full"><BundleArt items={items} large /></div>}
        actions={<>
          <button type="button" className="btn btn-primary" disabled={equip.busy} onClick={async () => { await wearAll(); onClose(); }}>Alles anlegen</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Weiter stöbern</button>
        </>} />
    );
  }

  return (
    <>
      <ProductDialog title={bundle.name} onClose={onClose} stage={<ProductStage items={items} tint={tint} kicker={`Paket · ${items.length} Artikel`} />}>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6 md:p-7">
          {/* The fan floats on a soft glow (no second frame); stacked layouts skip it, the stage above shows the look. */}
          <div className="relative mx-auto aspect-[16/10] w-full max-w-[320px] shrink-0 max-lg:hidden" data-mode="dark"
            style={{ background: `radial-gradient(60% 60% at 50% 50%, color-mix(in srgb, ${tint} 35%, transparent), transparent 72%)` }}>
            <BundleArt items={items} large />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.16em]" style={{ color: `color-mix(in srgb, ${tint} 50%, var(--text-strong))` }}>Paket · {items.length} Artikel</p>
            <h2 className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight">{bundle.name}</h2>
            <p className="mt-2 text-[14px] text-body">{bundle.description}</p>
            {deal && <p className="mt-2 text-[13px] font-semibold text-warn">{deal}, schon im Paketpreis enthalten.</p>}
          </div>
          {/* Exactly what is inside, with what each piece costs (or that you have it already). */}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {parts.map((part) => (
              <li key={part.item.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] p-2">
                <span data-mode="dark" className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#0d0b0a]">
                  <span className="game-tile-field absolute inset-0" style={{ '--tile': RARITY_TILE[part.item.rarity] } as CSSProperties} />
                  <ItemVisual item={part.item} className="h-full w-full rounded-none !bg-transparent" />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[14px] font-medium text-ink">{part.item.name}</span>
                  <span className="flex items-center gap-1.5 text-[12px] text-faint">{SLOT_LABELS[part.item.slot]} · <RarityLabel rarity={part.item.rarity} /></span>
                </span>
                <span className="text-[13.5px] font-semibold text-ink">
                  {owned.has(part.item.id) ? <span className="flex items-center gap-1 text-[12.5px] font-medium text-pos"><Glyph name="check" size={14} /> Im Besitz</span> : <Price price={part.item.price} finalPrice={part.finalPrice} />}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-col gap-3">
            {missing.length > 0 ? (
              <>
                <div>
                  <div className="flex items-baseline gap-2 text-[26px] font-bold text-ink">
                    <Bernis amount={bundle.price} large nowrap />
                    {bundle.price < bundle.fullPrice && <StruckBernis amount={bundle.fullPrice} className="text-[15px] font-medium text-faint" />}
                  </div>
                  <p className="mt-1 text-[12.5px] text-faint">
                    {missing.length < parts.length ? `Du zahlst nur für die ${missing.length} Artikel, die dir noch fehlen. ` : 'Alle Artikel zum Preis von einzeln gekauft, in einem Schritt. '}
                    {after >= 0 ? <>Danach hast du noch <Bernis amount={after} />.</> : <>Dir fehlen <Bernis amount={-after} />.</>}
                  </p>
                </div>
                {after < 0 && <Notice tone="warn">Hol dir den Tagesbonus, spiel Minispiele oder steig im Level auf.</Notice>}
                <button type="button" className="btn btn-primary min-h-12 text-[15px]" disabled={busy || after < 0} onClick={buy}>
                  {after < 0 ? 'Nicht genug Bernis' : <>Paket für <Bernis amount={bundle.price} /> kaufen</>}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary min-h-12 text-[15px]" disabled={equip.busy || allWorn} onClick={wearAll}>{allWorn ? 'Alles angelegt' : 'Alles anlegen'}</button>
            )}
          </div>
        </div>
      </ProductDialog>
      {dialog}
    </>
  );
}

/** "Pakete" section of the shop front. */
export function BundleSection({ bundles, listings, event }: { bundles: ShopBundle[]; listings: ShopListing[]; event?: ShopEvent }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const byId = useMemo(() => new Map(listings.map((entry) => [entry.item.id, entry])), [listings]);
  const partsOf = (bundle: ShopBundle) => bundle.itemIds.flatMap((id) => byId.get(id) ?? []);
  const shown = bundles.filter((bundle) => partsOf(bundle).length >= 2);
  const open = shown.find((bundle) => bundle.id === openId);
  if (!shown.length) return null;
  const visible = expanded ? shown : shown.slice(0, 4);
  return (
    // A showcase of its own in the page's mode (the bundle tiles inside stay dark like the item tiles).
    <>
    <section className="relative mt-12 overflow-hidden rounded-[28px] border border-[var(--border)] bg-surface p-5 shadow-[var(--card-shadow,none)] md:p-7">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#f2a531]/15 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-28 right-0 h-72 w-96 rounded-full bg-[#8fb36b]/12 blur-[100px]" />
      <div className="relative mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-ink">Pakete</h2>
          <p className="mt-1 max-w-[620px] text-[13.5px] text-mute">Alles, was zusammenpasst, in einem Klick. Was du schon besitzt, zahlst du nicht.</p>
        </div>
      </div>
      <div className="relative grid grid-cols-1 gap-5 md:grid-cols-2">
        {visible.map((bundle) => (
          <BundleTile key={bundle.id} bundle={bundle} items={partsOf(bundle).map((part) => part.item)} deal={eventDeal(partsOf(bundle), event)} onOpen={() => setOpenId(bundle.id)} />
        ))}
      </div>
      {shown.length > 4 && (
        <div className="relative mt-5 flex justify-center">
          <button type="button" className="btn btn-secondary" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Weniger anzeigen' : `Alle ${shown.length} Pakete anzeigen`}
          </button>
        </div>
      )}
    </section>
    {/* Outside the dark showcase, so the dialog follows the page mode like the item dialog. */}
    {open && <BundleDetail bundle={open} parts={partsOf(open)} deal={eventDeal(partsOf(open), event)} onClose={() => setOpenId(null)} />}
    </>
  );
}
