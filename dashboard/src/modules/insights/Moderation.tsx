// Moderation: cases per day, by moderator, by action and the most moderated members.
import type { InsightsResponse } from '../../../../src/web/dto/insights';
import type { ModerationInsights } from '../../../../src/web/dto/insightsDetail';
import { Chart, HorizontalBars } from '../../components/charts';
import { Card, Empty, Stats } from '../../components/ui';
import { dayLabels, GRID, number, STACK } from './shared';

export function Moderation({ overview, data, onSelect }: { overview: InsightsResponse; data: ModerationInsights; onSelect: (userId: string) => void }) {
  const { days } = overview.history;
  const { labels, longLabels } = dayLabels(days);
  const { moderation } = overview;
  const select = (userId: string | null) => (userId ? () => onSelect(userId) : undefined);
  return (
    <div className={STACK}>
      <Stats items={[
        { label: 'Fälle im Zeitraum', value: number.format(moderation.total) },
        { label: 'Aktive Moderatoren', value: number.format(data.byModerator.length) },
        { label: 'Verwarnungen gesamt', value: number.format(moderation.warnings) },
      ]} />
      {moderation.series.length > 0 ? (
        <Chart title="Moderation pro Tag" description={`${number.format(moderation.total)} Fälle im Zeitraum`} kind="stacked" labels={labels} longLabels={longLabels}
          series={moderation.series.map((name, i) => ({ name, values: days.map((d) => d.moderation[i] ?? 0) }))} />
      ) : (
        <Card title="Moderation pro Tag"><Empty title="Keine Fälle im Zeitraum">Hier erscheinen Bans, Kicks, Timeouts und Verwarnungen.</Empty></Card>
      )}
      <div className={GRID}>
        <HorizontalBars title="Nach Moderator" unit="Fälle" emptyTitle="Keine Fälle im Zeitraum"
          items={data.byModerator.map((m) => ({ key: m.moderatorId ?? m.name, label: m.name, value: m.count, onSelect: select(m.moderatorId) }))} />
        <HorizontalBars title="Nach Aktion" unit="Fälle" emptyTitle="Keine Fälle im Zeitraum"
          items={data.byAction.map((a) => ({ key: a.action, label: a.label, value: a.count }))} />
      </div>
      <HorizontalBars title="Am häufigsten moderiert" description="Mitglieder mit den meisten Fällen im Zeitraum" unit="Fälle" emptyTitle="Keine Fälle im Zeitraum"
        items={data.topTargets.map((t, i) => ({ key: t.userId ?? `${t.name}-${i}`, label: t.name, value: t.count, onSelect: select(t.userId) }))} />
    </div>
  );
}
