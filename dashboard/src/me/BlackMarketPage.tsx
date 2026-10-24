// Black Market in the style of a game "night market" (Valorant): every week a mix of discounted shop items and mythic
// exclusives lies face down as cards in their rarity colour; the member flips them one by one (or all at once).
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { ShopListing } from '../../../src/web/dto/profile';
import { CoinIcon } from '../components/CoinIcon';
import { PageHeader, Spinner } from '../components/ui';
import { countdown, formatDate, useMe, useNow } from './api';
import { ItemDetail, StoreCard } from './shop';
import { RARITY_TILE } from './visuals';

// Which cards this viewer already turned over this week (a per-browser convenience; buying never depends on it).
const storageKey = (weekStart: string) => `nexo.blackmarket.revealed.${weekStart}`;
function loadRevealed(weekStart: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(weekStart)) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
function saveRevealed(weekStart: string, ids: string[]) {
  try { localStorage.setItem(storageKey(weekStart), JSON.stringify(ids)); } catch { /* private mode: cards just start face down again */ }
}

function RevealCard({ listing, revealed, owned, onReveal, onOpen }: {
  listing: ShopListing; revealed: boolean; owned: boolean; onReveal: () => void; onOpen: () => void;
}) {
  const tint = RARITY_TILE[listing.item.rarity];
  return (
    <div className="aspect-[3/4] [perspective:1400px]">
      <div className={`relative h-full w-full [transform-style:preserve-3d] motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-[cubic-bezier(.2,.8,.2,1)] ${revealed ? '[transform:rotateY(180deg)]' : ''}`}>
        {/* Back: rarity glow, amber emblem, "aufdecken". */}
        <button type="button" onClick={onReveal} aria-label="Karte aufdecken" tabIndex={revealed ? -1 : 0}
          className={`group absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-[18px] border-0 bg-[#0b090b] p-0 font-[inherit] ring-1 ring-[color-mix(in_srgb,var(--tile)_45%,transparent)] [backface-visibility:hidden] hover:shadow-[0_0_40px_-6px_var(--tile)] ${revealed ? 'invisible opacity-0' : ''}`}
          // Browsers ignore backface-visibility for children on their own layer (the hovering emblem), so the back side
          // also switches off exactly when the card is edge-on (half of the 700 ms turn).
          style={{ '--tile': tint, transition: revealed ? 'opacity 0s linear 350ms, visibility 0s linear 350ms, box-shadow .2s' : 'box-shadow .2s' } as CSSProperties}>
          <span className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_45%,color-mix(in_srgb,var(--tile)_35%,transparent),transparent_70%),repeating-linear-gradient(135deg,rgb(255_255_255/.035)_0_2px,transparent_2px_12px)]" />
          <span className="absolute inset-3 rounded-[12px] border border-[color-mix(in_srgb,var(--tile)_40%,transparent)]" />
          <span className="relative transition-transform duration-500 [backface-visibility:hidden] group-hover:scale-110 group-hover:-rotate-6">
            <CoinIcon tier="gold" size={72} />
          </span>
          <span className="relative text-[11px] font-bold uppercase tracking-[.24em]" style={{ color: tint }}>Aufdecken</span>
        </button>
        {/* Front: the regular game tile. */}
        <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <StoreCard listing={listing} owned={owned} variant="blackmarket" onOpen={onOpen} className="h-full w-full !aspect-auto" />
        </div>
      </div>
    </div>
  );
}

export default function BlackMarketPage() {
  const { blackMarket, me } = useMe();
  const now = useNow();
  const [revealed, setRevealed] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const owned = useMemo(() => new Set(me.inventory.map((o) => o.itemId)), [me.inventory]);
  const weekStart = blackMarket?.weekStart;

  useEffect(() => { if (weekStart) setRevealed(loadRevealed(weekStart)); }, [weekStart]);

  if (!blackMarket) return <><PageHeader kicker="Mein Profil" title="Black Market" description="" /><Spinner /></>;
  const listings = blackMarket.listings;
  const isRevealed = (id: string) => revealed.includes(id) || owned.has(id);
  const reveal = (id: string) => setRevealed((prev) => {
    const next = prev.includes(id) ? prev : [...prev, id];
    saveRevealed(blackMarket.weekStart, next);
    return next;
  });
  const hidden = listings.filter((l) => !isRevealed(l.item.id));
  const exclusives = listings.filter((l) => l.item.availability === 'blackmarket').length;
  // Turn the rest over one after another, like dealing cards.
  const revealAll = () => hidden.forEach((l, i) => window.setTimeout(() => reveal(l.item.id), i * 140));
  const open = listings.find((l) => l.item.id === openId);

  return (
    <>
      <PageHeader kicker="Mein Profil" title="Black Market" description="Jede Woche neue Karten: Artikel aus dem Shop zum Sonderpreis und mythische Exklusive, die es nur hier gibt. Montags um Mitternacht wird neu gemischt." />
      {/* The black market stays dark in both modes. */}
      <div data-mode="dark">
        <section className="relative mb-6 overflow-hidden rounded-[20px] border border-rose-500/20 bg-[#070608] p-6 md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.028)_0_1px,transparent_1px_3px)]" />
          <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full bg-rose-600/20 blur-[110px]" />
          <div className="pointer-events-none absolute -bottom-40 left-10 h-72 w-72 rounded-full bg-amber-800/15 blur-[110px]" />
          <div className="relative flex flex-wrap items-end gap-6">
            <div className="min-w-0 flex-[1_1_300px]">
              <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.24em] text-rose-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400 shadow-[0_0_10px_#fb7185]" /> Nur diese Woche
              </p>
              <h2 className="mt-2 text-[28px] font-bold uppercase tracking-[.02em] text-white">{listings.length} Angebote der Woche</h2>
              <p className="mt-2 max-w-[520px] text-[14px] text-mute">Seit {formatDate(blackMarket.weekStart)} im Angebot. Deck die Karten auf: bis zu 40 % Rabatt{exclusives > 0 ? `, dazu ${exclusives} mythische${exclusives === 1 ? 'r' : ''} Exklusiv-Artikel` : ''}.</p>
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-faint">Neue Ware in</p>
              <p className="mt-1.5 inline-block rounded-xl border border-white/10 bg-black/40 px-4 py-2 font-mono text-[28px] font-semibold leading-none tracking-tight text-white tabular-nums">{countdown(blackMarket.endsAt, now)}</p>
            </div>
          </div>
        </section>

        <div className="mb-4 flex items-center gap-3">
          <p className="min-w-0 flex-1 text-[13.5px] text-mute">{hidden.length ? `${listings.length - hidden.length} von ${listings.length} aufgedeckt` : 'Alle Karten aufgedeckt'}</p>
          {hidden.length > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={revealAll}>Alle aufdecken</button>}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
          {listings.map((l) => (
            <RevealCard key={l.item.id} listing={l} revealed={isRevealed(l.item.id)} owned={owned.has(l.item.id)}
              onReveal={() => reveal(l.item.id)} onOpen={() => setOpenId(l.item.id)} />
          ))}
        </div>
      </div>
      {open && <ItemDetail listing={open} owned={owned.has(open.item.id)} onClose={() => setOpenId(null)} />}
    </>
  );
}
