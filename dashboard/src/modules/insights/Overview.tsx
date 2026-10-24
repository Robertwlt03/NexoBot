// Überblick: KPI tiles with trend and change, member growth, joins vs. leaves and the module figures.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { InsightsResponse, InsightTotals } from '../../../../src/web/dto/insights';
import { Chart, Sparkline } from '../../components/charts';
import { Card, Notice, Stats } from '../../components/ui';
import { MODULES } from '../registry';
import { dayLabels, Facts, fullDate, GRID, hours, number, signed, STACK, utcDate } from './shared';

/** "+12 % zum Vorzeitraum", or nothing when the period before was not recorded. */
function change(previous: InsightTotals | null, current: InsightTotals, pick: (t: InsightTotals) => number): string | undefined {
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

const unavailable = <p className="faint">Gerade nicht verfügbar.</p>;

export function Overview({ data }: { data: InsightsResponse }) {
  const { live, history, moderation } = data;
  const { totals, previous, days, trackingSince } = history;
  const { labels, longLabels } = dayLabels(days);
  const isNew = !trackingSince || trackingSince > days[0].day;
  const trend = (hint: string | undefined, values: (number | null)[]) => <><Sparkline values={values} />{hint ?? 'Kein Vorzeitraum'}</>;

  return (
    <div className={STACK}>
      {isNew && (
        <Notice>
          {trackingSince
            ? `Nexo zeichnet seit ${utcDate(trackingSince)} auf – Verläufe füllen sich ab jetzt täglich.`
            : 'Nexo zeichnet ab jetzt auf – Verläufe füllen sich ab jetzt täglich.'}
        </Notice>
      )}
      <Stats items={[
        { label: 'Mitglieder', value: number.format(live.members), hint: trend(`${signed(totals.joins - totals.leaves)} im Zeitraum`, days.map((d) => d.memberCount)) },
        { label: 'Beitritte', value: number.format(totals.joins), hint: trend(change(previous, totals, (t) => t.joins), days.map((d) => d.joins)) },
        { label: 'Nachrichten', value: number.format(totals.messages), hint: trend(change(previous, totals, (t) => t.messages), days.map((d) => d.messages)) },
        { label: 'Ø aktive Mitglieder', value: number.format(totals.activeAvg), hint: trend(change(previous, totals, (t) => t.activeAvg), days.map((d) => d.activeMembers)) },
        { label: 'Sprachstunden', value: hours.format(totals.voiceMinutes / 60), hint: trend(change(previous, totals, (t) => t.voiceMinutes), days.map((d) => d.voiceMinutes)) },
      ]} />

      <div className={GRID}>
        <Chart title="Mitgliederentwicklung" description="Mitglieder am Ende jedes Tages" kind="line" labels={labels} longLabels={longLabels}
          series={[{ name: 'Mitglieder', values: days.map((d) => d.memberCount) }]} />
        <Chart title="Beitritte vs. Austritte" kind="bars" labels={labels} longLabels={longLabels}
          series={[{ name: 'Beitritte', values: days.map((d) => d.joins) }, { name: 'Austritte', values: days.map((d) => d.leaves) }]} />
      </div>

      <h2 className="mt-5! font-sans text-[11.5px] font-bold uppercase tracking-[.14em] text-mute">Server &amp; Module</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 [&>*]:mt-0">
        <Card title="Server" icon="stats" description={`Erstellt am ${fullDate(live.createdAt)}`}>
          <Facts items={[
            ['Gerade online', live.online === null ? '–' : number.format(live.online)],
            ['Menschen / Bots', `${number.format(live.humans)} / ${number.format(live.bots)}`],
            ['Text- / Sprachkanäle', `${number.format(live.textChannels)} / ${number.format(live.voiceChannels)}`],
            ['Rollen', number.format(live.roles)],
            ['Emojis / Sticker', `${number.format(live.emojis)} / ${number.format(live.stickers)}`],
            ['Boosts', `${number.format(live.boosts)} · Stufe ${live.boostTier}`],
            ['Verwarnungen gesamt', number.format(moderation.warnings)],
          ]} />
        </Card>
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
              <Facts items={data.leveling.top.map((entry, i) => [`${i + 1}. ${entry.name}`, `Level ${entry.level}`])} />
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
        <ModuleCard id="birthdays">
          {!data.birthdays ? unavailable : data.birthdays.upcoming.length === 0 ? <p className="faint">Noch keine Geburtstage eingetragen.</p> : (
            <Facts items={data.birthdays.upcoming.map((b) => [
              b.name,
              `${String(b.day).padStart(2, '0')}.${String(b.month).padStart(2, '0')}. · ${b.daysUntil === 0 ? 'heute' : b.daysUntil === 1 ? 'morgen' : `in ${b.daysUntil} Tagen`}`,
            ])} />
          )}
        </ModuleCard>
        <ModuleCard id="counting">
          {data.counting ? <Facts items={[
            ['Status', data.counting.enabled ? 'Aktiv' : 'Aus'],
            ['Aktuelle Serie', number.format(data.counting.currentStreak)],
            ['Beste Serie', number.format(data.counting.bestStreak)],
          ]} /> : unavailable}
        </ModuleCard>
        <ModuleCard id="giveaways">
          {data.giveaways ? <Facts items={[['Aktive Gewinnspiele', number.format(data.giveaways.active)]]} /> : unavailable}
        </ModuleCard>
        <ModuleCard id="applications">
          {data.applications ? <Facts items={[['Offene Bewerbungen', number.format(data.applications.pending)]]} /> : unavailable}
        </ModuleCard>
      </div>
    </div>
  );
}
