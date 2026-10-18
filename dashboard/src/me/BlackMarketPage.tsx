import { PageHeader, Spinner } from '../components/ui';
import { countdown, formatDate, useMe, useNow } from './api';
import { ItemBrowser } from './shop';

export default function BlackMarketPage() {
  const { blackMarket } = useMe();
  const now = useNow();
  return (
    <>
      <PageHeader kicker="Mein Profil" title="Black Market" description="Jede Woche eine Handvoll mythischer Artikel, die es sonst nirgends gibt. Montags um Mitternacht ist alles wieder weg." />
      {!blackMarket ? <Spinner /> : (
        <>
          <section className="relative mb-8 overflow-hidden rounded-[20px] border border-rose-500/15 bg-[#060608] p-6 md:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,.028)_0_1px,transparent_1px_3px)]" />
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[.09] mix-blend-overlay" aria-hidden="true">
              <filter id="bm-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} stitchTiles="stitch" /></filter>
              <rect width="100%" height="100%" filter="url(#bm-grain)" />
            </svg>
            <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-rose-600/15 blur-[100px]" />
            <div className="relative flex flex-wrap items-end gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium uppercase tracking-[.2em] text-rose-300/80">Nur diese Woche</p>
                <h2 className="mt-2 text-[26px] font-semibold tracking-tight">{blackMarket.listings.length} mythische Artikel</h2>
                <p className="mt-2 max-w-[520px] text-[14px] text-mute">Seit {formatDate(blackMarket.weekStart)} im Angebot. Keine Rabatte, keine zweite Chance – was du jetzt nicht holst, taucht vielleicht nie wieder auf.</p>
              </div>
              <div className="sm:text-right">
                <p className="text-[12.5px] text-faint">Neue Ware in</p>
                <p className="mt-1 font-mono text-[34px] font-light leading-none tracking-tight text-ink tabular-nums">{countdown(blackMarket.endsAt, now)}</p>
              </div>
            </div>
          </section>
          <ItemBrowser listings={blackMarket.listings} variant="blackmarket" filters={false} />
        </>
      )}
    </>
  );
}
