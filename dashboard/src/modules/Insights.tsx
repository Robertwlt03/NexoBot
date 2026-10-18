import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { InsightRange, InsightsResponse, InsightTotals } from '../../../src/web/dto/insights';
import { useApi, useGuild } from '../api';
import { Chart } from '../components/charts';
import { Card, Empty, Notice, PageHeader, Spinner, Stats, Tabs } from '../components/ui';
import { MODULES } from './registry';

const number = new Intl.NumberFormat('de-DE');
const hours = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const RANGES: { id: `${InsightRange}`; label: string }[] = [
  { id: '7', label: '7 Tage' },
  { id: '30', label: '30 Tage' },
  { id: '90', label: '90 Tage' },
];

const utc = (day: string) => new Date(`${day}T00:00:00Z`);
const shortDay = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.`;
const longDay = (day: string) => utc(day).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const fullDate = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${number.format(Math.abs(n))}`;

/** "+12 % zum Vorzeitraum", or nothing when the period before was not recorded. */
function change(previous: InsightTotals | null, pick: (t: InsightTotals) => number, current: InsightTotals): string | undefined {
  if (!previous || pick(previous) === 0) return undefined;
  return `${signed(Math.round(((pick(current) - pick(previous)) / pick(previous)) * 100))} % zum Vorzeitraum`;
}

function ModuleCard({ id, children }: { id: string; children: ReactNode }) {
  const module = MODULES.find((m) => m.id === id);
  return (
    <Card title={module?.label ?? id} icon={module?.icon} right={<Link className="btn btn-ghost btn-sm" to={`../${id}`}>Öffnen</Link>}>
      {children}
    </Card>
  );
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="stack gap-2">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3">
          <dt className="muted">{label}</dt>
          <dd className="m-0 font-semibold tabular-nums text-[#f2f3f5]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const unavailable = <p className="faint">Gerade nicht verfügbar.</p>;

export default function Insights() {
  const { guild } = useGuild();
  const [range, setRange] = useState<`${InsightRange}`>('30');
  const { data, error, loading } = useApi<InsightsResponse>(`/guilds/${guild.id}/insights?range=${range}`);

  const header = <PageHeader icon="stats" title="Statistiken" description="Wachstum, Aktivität und Zahlen aus allen Modulen." />;
  const filters = <div className="mb-4"><Tabs value={range} onChange={setRange} items={RANGES} /></div>;
  if (!data) return <>{header}{filters}{error ? <Notice tone="danger">{error}</Notice> : <Spinner />}</>;

  const { live, history, moderation } = data;
  const { totals, previous, days, trackingSince } = history;
  const labels = days.map((d) => shortDay(d.day));
  const longLabels = days.map((d) => longDay(d.day));
  const isNew = !trackingSince || trackingSince > days[0].day;

  return (
    <>
      {header}
      {filters}
      <div className={`transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
        {error && <Notice tone="danger">{error}</Notice>}
        {isNew && (
          <Notice>
            {trackingSince
              ? `Nexo zeichnet seit ${utc(trackingSince).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })} auf – Verläufe füllen sich ab jetzt täglich.`
              : 'Nexo zeichnet ab jetzt auf – Verläufe füllen sich ab jetzt täglich.'}
          </Notice>
        )}
        <Stats items={[
          { label: 'Mitglieder', value: number.format(live.members), hint: `${signed(totals.joins - totals.leaves)} im Zeitraum` },
          { label: 'Online', value: live.online === null ? '–' : number.format(live.online), hint: `${number.format(live.humans)} Menschen · ${number.format(live.bots)} Bots` },
          { label: 'Nachrichten', value: number.format(totals.messages), hint: change(previous, (t) => t.messages, totals) },
          { label: 'Aktive Mitglieder', value: number.format(totals.activeAvg), hint: 'Ø pro Tag' },
          { label: 'Sprachstunden', value: hours.format(totals.voiceMinutes / 60), hint: change(previous, (t) => t.voiceMinutes, totals) },
          { label: 'Boosts', value: number.format(live.boosts), hint: `Stufe ${live.boostTier}` },
        ]} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:mt-0">
          <Chart title="Mitgliederentwicklung" description="Mitglieder am Ende jedes Tages" kind="line" labels={labels} longLabels={longLabels}
            series={[{ name: 'Mitglieder', values: days.map((d) => d.memberCount) }]} />
          <Chart title="Beitritte vs. Austritte" kind="bars" labels={labels} longLabels={longLabels}
            series={[{ name: 'Beitritte', values: days.map((d) => d.joins) }, { name: 'Austritte', values: days.map((d) => d.leaves) }]} />
          <Chart title="Nachrichten pro Tag" kind="bars" labels={labels} longLabels={longLabels}
            series={[{ name: 'Nachrichten', values: days.map((d) => d.messages) }]} />
          <Chart title="Sprachminuten pro Tag" description="Ohne AFK-Kanal" kind="bars" labels={labels} longLabels={longLabels}
            series={[{ name: 'Sprachminuten', values: days.map((d) => d.voiceMinutes) }]} />
          {moderation.series.length > 0 ? (
            <Chart title="Moderation pro Tag" description={`${number.format(moderation.total)} Fälle im Zeitraum`} kind="stacked" labels={labels} longLabels={longLabels}
              series={moderation.series.map((name, i) => ({ name, values: days.map((d) => d.moderation[i] ?? 0) }))} />
          ) : (
            <Card title="Moderation pro Tag"><Empty title="Keine Fälle im Zeitraum">Hier erscheinen Bans, Kicks, Timeouts und Verwarnungen.</Empty></Card>
          )}
          <Card title="Server" description={`Erstellt am ${fullDate(live.createdAt)}`}>
            <Facts items={[
              ['Menschen / Bots', `${number.format(live.humans)} / ${number.format(live.bots)}`],
              ['Text- / Sprachkanäle', `${number.format(live.textChannels)} / ${number.format(live.voiceChannels)}`],
              ['Rollen', number.format(live.roles)],
              ['Emojis / Sticker', `${number.format(live.emojis)} / ${number.format(live.stickers)}`],
              ['Verwarnungen gesamt', number.format(moderation.warnings)],
            ]} />
          </Card>
        </div>

        <h2 className="mb-3 mt-9 font-sans text-[11.5px] font-bold uppercase tracking-[.14em] text-dc-muted">Module</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 [&>*]:mt-0">
          <ModuleCard id="tickets">
            {data.tickets ? <Facts items={[
              ['Offen', number.format(data.tickets.open)],
              ['Geschlossen', number.format(data.tickets.closed)],
              ['Ø Bearbeitungszeit', data.tickets.avgCloseTimeMs === null ? '–' : `${hours.format(data.tickets.avgCloseTimeMs / 3_600_000)} h`],
              ['Ø Bewertung', data.tickets.avgRating === null ? '–' : `${hours.format(data.tickets.avgRating)} / 5`],
            ]} /> : unavailable}
          </ModuleCard>
          <ModuleCard id="leveling">
            {!data.leveling ? unavailable : data.leveling.top.length === 0 ? <p className="faint">Noch niemand hat XP gesammelt.</p> : (
              <>
                <ol className="stack m-0 list-none gap-2 p-0">
                  {data.leveling.top.map((entry, i) => (
                    <li key={entry.userId} className="flex items-baseline gap-3">
                      <span className="faint w-5 tabular-nums">{i + 1}.</span>
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                      <span className="font-semibold tabular-nums text-[#f2f3f5]">Level {entry.level}</span>
                    </li>
                  ))}
                </ol>
                <p className="faint mt-3">{number.format(data.leveling.rankedMembers)} Mitglieder in der Rangliste</p>
              </>
            )}
          </ModuleCard>
          <ModuleCard id="economy">
            {data.economy ? <Facts items={[
              ['Konten', number.format(data.economy.accounts)],
              ['Geld im Umlauf', number.format(data.economy.inCirculation)],
            ]} /> : unavailable}
          </ModuleCard>
          <ModuleCard id="giveaways">
            {data.giveaways ? <Facts items={[['Aktive Giveaways', number.format(data.giveaways.active)]]} /> : unavailable}
          </ModuleCard>
          <ModuleCard id="birthdays">
            {!data.birthdays ? unavailable : data.birthdays.upcoming.length === 0 ? <p className="faint">Noch keine Geburtstage eingetragen.</p> : (
              <Facts items={data.birthdays.upcoming.map((b) => [
                b.name,
                `${String(b.day).padStart(2, '0')}.${String(b.month).padStart(2, '0')}. · ${b.daysUntil === 0 ? 'heute' : b.daysUntil === 1 ? 'morgen' : `in ${b.daysUntil} Tagen`}`,
              ])} />
            )}
          </ModuleCard>
          <ModuleCard id="applications">
            {data.applications ? <Facts items={[['Offene Bewerbungen', number.format(data.applications.pending)]]} /> : unavailable}
          </ModuleCard>
          <ModuleCard id="counting">
            {data.counting ? <Facts items={[
              ['Status', data.counting.enabled ? 'Aktiv' : 'Aus'],
              ['Aktuelle Serie', number.format(data.counting.currentStreak)],
              ['Beste Serie', number.format(data.counting.bestStreak)],
            ]} /> : unavailable}
          </ModuleCard>
        </div>
      </div>
    </>
  );
}
