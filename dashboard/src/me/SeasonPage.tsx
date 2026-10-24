import type { SeasonResponse } from '../../../src/web/dto/profile';
import { SEASON_POINTS } from '../../../src/shared/season';
import { useApi } from '../api';
import { Card, Notice, PageHeader, Spinner } from '../components/ui';
import { countdown, num, useMe, useNow } from './api';
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

export default function SeasonPage() {
  const { items } = useMe();
  const now = useNow(60_000);
  const { data, error, loading } = useApi<SeasonResponse>('/me/season');
  const next = data?.tiers[data.tier];
  const previous = data && data.tier > 0 ? data.tiers[data.tier - 1].points : 0;

  return (
    <>
      <PageHeader kicker="Mein Profil" title={data ? `Saison ${data.name}` : 'Saison'}
        description="Jeden Monat ein neuer Pfad: Saisonpunkte sammelst du ganz nebenbei. Jede Stufe zahlt sich sofort aus – auf Stufe 5 und 10 warten Stücke, die es nur in dieser Saison gibt." />
      {loading && !data && <Spinner />}
      {error && <Notice tone="danger">{error}</Notice>}
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
