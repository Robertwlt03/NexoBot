import type { SeasonResponse, ShopEvent } from '../../../src/web/dto/profile';
import { SEASON_POINTS } from '../../../src/shared/season';
import { useApi } from '../api';
import { Card, Notice, PageHeader, Spinner } from '../components/ui';
import { countdown, formatDate, num, startsIn, useMe, useNow } from './api';
import { CommunityGoals } from './CommunityGoals';
import { EventIcon } from './EventScene';
import { Bernis, CoinStacks, Glyph, ItemVisual } from './visuals';

const EARN: [string, number][] = [
  ['Tagesaufgabe geschafft', SEASON_POINTS.quest],
  ['Alle drei Tagesaufgaben', SEASON_POINTS.allQuests],
  ['Tagesbonus abgeholt', SEASON_POINTS.daily],
  ['Minispiel gewonnen', SEASON_POINTS.minigame],
  ['Level-up', SEASON_POINTS.levelUp],
  ['Gemeinschaftsziel geschafft', SEASON_POINTS.community],
  ['Spiel gegen andere gewonnen', SEASON_POINTS.duelWin],
];

/** Running and coming shop events: name, dates, discount and when it starts or ends. */
function EventList({ running, upcoming }: { running: ShopEvent[]; upcoming: ShopEvent[] }) {
  const now = useNow(60_000);
  const rows = [...running.map((event) => ({ event, live: true })), ...upcoming.map((event) => ({ event, live: false }))];
  if (!rows.length) return null;
  return (
    <Card title="Events" description="Während eines Events gibt es im Shop Rabatte, eigene Artikel und auf jedem Server ein Gemeinschaftsziel.">
      <ul className="m-0 list-none divide-y divide-white/[.06] p-0">
        {rows.map(({ event, live }) => {
          return (
            <li key={event.id} className="flex items-center gap-3 py-2.5 text-[13.5px]">
              <EventIcon event={event} />
              {/* Name and dates on the left, discount and timing on the right; each side wraps on its own on phones. */}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink">{event.name}</span>
                <span className="block text-[12.5px] text-mute">{formatDate(event.startsAt)} – {formatDate(event.endsAt)}</span>
              </span>
              <span className="shrink-0 text-right">
                {event.discount > 0 && <span className="block tabular-nums text-ink">−{event.discount} %</span>}
                <span className="block whitespace-nowrap text-[12.5px] text-mute">{live ? `läuft noch ${countdown(event.endsAt, now)}` : startsIn(event.startsAt, now)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function SeasonPage() {
  const { items, shop } = useMe();
  const now = useNow(60_000);
  const { data, error, loading, reload } = useApi<SeasonResponse>('/me/season');
  const next = data?.tiers[data.tier];
  const previous = data && data.tier > 0 ? data.tiers[data.tier - 1].points : 0;

  return (
    <>
      <PageHeader kicker="Mein Profil" title={data ? `Saison ${data.name}` : 'Saison'}
        description="Jeden Monat ein neuer Pfad: Saisonpunkte sammelst du ganz nebenbei. Jede Stufe zahlt sich sofort aus – auf Stufe 5 und 10 warten Stücke, die es nur in dieser Saison gibt." />
      {loading && !data && <Spinner />}
      {error && <Notice tone="danger" onRetry={reload}>{error}</Notice>}
      {data && (
        <>
          <section className="card card-hero !p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[13px] text-accent-text">Stufe {data.tier} von {data.tiers.length}</span>
              <span className="text-[12.5px] text-[var(--accent-text-muted)]">Endet in <span className="tabular-nums text-ink">{countdown(data.endsAt, now)}</span></span>
            </div>
            <div className="mt-3 text-[36px] font-light leading-none tracking-[-0.03em] text-ink">{num(data.points)} <span className="text-[15px] text-[var(--accent-text-muted)]">Punkte</span></div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[.08]">
              <div className="h-full rounded-full bg-accent" style={{ width: `${next ? ((data.points - previous) / (next.points - previous)) * 100 : 100}%` }} />
            </div>
            <p className="mt-2 text-[12.5px] text-[var(--accent-text-muted)]">
              {next ? <>Noch {num(next.points - data.points)} Punkte bis Stufe {data.tier + 1}</> : 'Saisonpfad komplett – stark!'}
            </p>
          </section>

          <ol className="mt-4 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-5">
            {data.tiers.map((tier, i) => {
              const reached = i < data.tier;
              const isNext = i === data.tier;
              const item = tier.itemId ? items.get(tier.itemId) : undefined;
              return (
                <li key={tier.points}
                  className={`relative flex flex-col rounded-2xl border p-3 ${reached ? 'border-accent/50 bg-accent/[.06]' : isNext ? 'border-white/20 bg-surface' : 'border-white/[.06] bg-white/[.015]'}`}>
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className={reached ? 'font-medium text-ink' : 'text-mute'}>Stufe {i + 1}</span>
                    {reached
                      ? <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-ink"><Glyph name="check" size={12} /></span>
                      : <span className="tabular-nums text-faint">{num(tier.points)}</span>}
                  </div>
                  {item
                    ? <ItemVisual item={item} className={`mt-2 ${reached ? '' : 'opacity-70'}`} />
                    : <div className={`mt-2 grid aspect-[4/3] place-items-center rounded-xl bg-white/[.03] ${reached ? '' : 'opacity-70'}`}><CoinStacks amount={tier.bernis} /></div>}
                  <div className={`mt-2 text-[13px] ${reached ? 'text-ink' : 'text-body'}`}>+<Bernis amount={tier.bernis} nowrap /></div>
                  {item && <div className="mt-0.5 text-[12px] leading-snug text-mute">{item.name}</div>}
                </li>
              );
            })}
          </ol>

          <CommunityGoals />
          <EventList running={shop?.events ?? []} upcoming={shop?.upcoming ?? []} />

          <Card title="So sammelst du Saisonpunkte" description="Alles zählt auf allen Servern mit Nexo. Am Monatsende beginnt die nächste Saison bei null.">
            <ul className="grid list-none grid-cols-1 gap-x-6 gap-y-2 p-0 sm:grid-cols-2">
              {EARN.map(([label, points]) => (
                <li key={label} className="flex items-center justify-between gap-3 border-b border-white/[.05] pb-2 text-[13.5px]">
                  <span className="text-body">{label}</span>
                  <span className="tabular-nums text-ink">+{points}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
