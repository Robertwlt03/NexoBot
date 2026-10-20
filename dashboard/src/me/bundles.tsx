// Bundles (Discord/Steam style): matching items sold together. You pay the summed current prices of the items you do
// not own yet; the detail shows your card wearing the whole set.
import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { RARITIES, SLOT_LABELS } from '../../../src/shared/cosmetics';
import type { CosmeticItem } from '../../../src/shared/cosmetics';
import type { PurchaseResult, ShopBundle, ShopListing } from '../../../src/web/dto/profile';
import { useConfirm } from '../components/ConfirmDialog';
import { Notice } from '../components/ui';
import { equipItem, isEquipped, useEquip, useMe, useMutation, useWalletUpdate } from './api';
import { Celebration } from './Celebration';
import { ProductDialog } from './ProductDialog';
import { ProductStage } from './ProductStage';
import { Bernis, Glyph, ItemVisual, Price, RARITY_TILE, RarityLabel } from './visuals';

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

function BundleTile({ bundle, items, onOpen }: { bundle: ShopBundle; items: CosmeticItem[]; onOpen: () => void }) {
  const tint = tintOf(items);
  return (
    <button type="button" onClick={onOpen} data-mode="dark" style={{ '--tile': tint } as CSSProperties}
      className="js-item game-tile group relative flex cursor-pointer flex-col overflow-hidden rounded-[18px] border-0 bg-[#0d0b0a] p-0 text-left font-[inherit] ring-1 ring-white/[.08] transition duration-300 hover:-translate-y-1 hover:ring-[color-mix(in_srgb,var(--tile)_70%,transparent)] hover:shadow-[0_22px_44px_-18px_color-mix(in_srgb,var(--tile)_55%,transparent)]">
      <div className="game-tile-field relative aspect-[16/10] w-full overflow-hidden">
        <BundleArt items={items} />
        <span className="absolute left-2.5 top-2.5 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[.08em] text-white backdrop-blur">Paket · {items.length} St.</span>
        {bundle.owned > 0 && <span className="absolute right-2.5 top-2.5 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-[#86efac] backdrop-blur">{bundle.owned} im Besitz</span>}
      </div>
      <div className="relative w-full px-4 pb-4 pt-3">
        <h3 className="truncate text-[16px] font-bold uppercase tracking-[.02em] text-white">{bundle.name}</h3>
        <p className="mt-0.5 line-clamp-1 text-[12.5px] text-white/60">{bundle.description}</p>
        <div className="mt-2.5 flex items-center gap-2 text-[16px] font-bold text-white">
          {bundle.price > 0 ? <Price price={bundle.fullPrice} finalPrice={bundle.price} /> : <span className="text-[13px] font-semibold text-[#86efac]">Alles im Besitz</span>}
        </div>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: tint }} />
    </button>
  );
}

function BundleDetail({ bundle, parts, onClose }: { bundle: ShopBundle; parts: ShopListing[]; onClose: () => void }) {
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
            <p className="text-[11px] font-bold uppercase tracking-[.16em]" style={{ color: tint }}>Paket · {items.length} Artikel</p>
            <h2 className="mt-1.5 text-[26px] font-bold leading-tight tracking-tight">{bundle.name}</h2>
            <p className="mt-2 text-[14px] text-body">{bundle.description}</p>
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
                    <Bernis amount={bundle.price} large />
                    {bundle.price < bundle.fullPrice && <span className="text-[15px] font-medium text-faint line-through"><Bernis amount={bundle.fullPrice} /></span>}
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
export function BundleSection({ bundles, listings }: { bundles: ShopBundle[]; listings: ShopListing[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(listings.map((entry) => [entry.item.id, entry])), [listings]);
  const partsOf = (bundle: ShopBundle) => bundle.itemIds.flatMap((id) => byId.get(id) ?? []);
  const shown = bundles.filter((bundle) => partsOf(bundle).length >= 2);
  const open = shown.find((bundle) => bundle.id === openId);
  if (!shown.length) return null;
  return (
    <section className="mt-10">
      <div className="mb-3.5">
        <h2 className="text-[19px] font-semibold tracking-tight">Pakete</h2>
        <p className="mt-0.5 text-[13px] text-mute">Komplette Looks, die zusammenpassen – mit einem Klick, und was du schon hast, zahlst du nicht.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((bundle) => <BundleTile key={bundle.id} bundle={bundle} items={partsOf(bundle).map((part) => part.item)} onOpen={() => setOpenId(bundle.id)} />)}
      </div>
      {open && <BundleDetail bundle={open} parts={partsOf(open)} onClose={() => setOpenId(null)} />}
    </section>
  );
}
