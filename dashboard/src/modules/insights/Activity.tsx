// Aktivität: messages and voice per day, weekday × hour heatmap, top channels and the most active members.
import type { ActivityResponse, MemberActivity } from '../../../../src/web/dto/insightsDetail';
import { Chart, Heatmap, HorizontalBars } from '../../components/charts';
import { Card, Notice, Stats } from '../../components/ui';
import { RankList } from '../rankingKit';
import { dayLabels, GRID, hours, number, STACK, TrackingOff, utcDate, WEEKDAYS } from './shared';

const HOURS = Array.from({ length: 24 }, (_, h) => String(h));
const slot = (weekday: number, hour: number) => `${WEEKDAYS[weekday]} ${hour}–${hour + 1} Uhr`;

function busiest(heatmap: number[][]): string {
  let best: [number, number, number] = [0, 0, 0];
  heatmap.forEach((row, d) => row.forEach((v, h) => { if (v > best[2]) best = [d, h, v]; }));
  return best[2] > 0 ? slot(best[0], best[1]) : '–';
}

function MemberRanks({ title, description, members, value, detail, tracking, onSelect }: {
  title: string; description: string; members: MemberActivity[]; tracking: boolean; onSelect: (userId: string) => void;
  value: (m: MemberActivity) => string; detail: (m: MemberActivity) => string;
}) {
  return (
    <Card title={title} description={description}>
      {tracking ? (
        <RankList rows={members.map((m, i) => ({ rank: i + 1, userId: m.userId, name: m.name, avatarUrl: m.avatarUrl, value: value(m), meta: detail(m) }))}
          loading={false} error={null} emptyTitle="Noch keine Daten" emptyText="Im Zeitraum wurde noch nichts aufgezeichnet."
          onSelect={onSelect} selectLabel="Filtern" />
      ) : <TrackingOff />}
    </Card>
  );
}

/** Server-wide activity, or one member's when `memberName` is set (then the member rankings are left out). */
export function Activity({ data, tracking, memberName, onSelect }: {
  data: ActivityResponse; tracking: boolean; memberName: string | null; onSelect: (userId: string) => void;
}) {
  if (memberName && !tracking) return <Card><TrackingOff /></Card>;
  const { labels, longLabels } = dayLabels(data.days);
  const whose = memberName ? ` von ${memberName}` : '';

  return (
    <div className={STACK}>
      {!data.trackingSince ? (
        <Notice>Noch keine Detaildaten – die Auswertung füllt sich ab jetzt stündlich.</Notice>
      ) : data.trackingSince > data.days[0]?.day && (
        <Notice>Detaildaten gibt es seit {utcDate(data.trackingSince)}.</Notice>
      )}
      <Stats items={[
        { label: 'Nachrichten', value: number.format(data.totals.messages) },
        { label: 'Sprachstunden', value: hours.format(data.totals.voiceMinutes / 60) },
        { label: 'Aktive Tage', value: number.format(data.totals.activeDays), hint: `von ${number.format(data.days.length)} Tagen` },
        { label: 'Stärkste Stunde', value: busiest(data.heatmap) },
      ]} />
      <div className={GRID}>
        <Chart title={`Nachrichten pro Tag${whose}`} kind="bars" labels={labels} longLabels={longLabels}
          series={[{ name: 'Nachrichten', values: data.days.map((d) => d.messages) }]} />
        <Chart title={`Sprachminuten pro Tag${whose}`} description="Ohne AFK-Kanal" kind="bars" labels={labels} longLabels={longLabels}
          series={[{ name: 'Sprachminuten', values: data.days.map((d) => d.voiceMinutes) }]} />
      </div>
      <Heatmap title={`Wann wird geschrieben?${memberName ? ` (${memberName})` : ''}`} description="Nachrichten nach Wochentag und Uhrzeit (deutsche Zeit)"
        rows={WEEKDAYS} cols={HOURS} values={data.heatmap} cellLabel={slot} unit="Nachrichten" />
      {/* Channels are recorded per server only, not per member. */}
      {!memberName && (
        <HorizontalBars title="Top-Kanäle" description="Nach Nachrichten im Zeitraum" unit="Nachrichten"
          items={data.topChannels.map((c) => ({ key: c.channelId, label: c.name.startsWith('#') ? c.name : `#${c.name}`, value: c.messages }))} />
      )}
      {!memberName && (
        <div className={GRID}>
          <MemberRanks title="Top-Schreiber" description="Nach Nachrichten im Zeitraum" members={data.topMembers} tracking={tracking} onSelect={onSelect}
            value={(m) => number.format(m.messages)} detail={(m) => `${hours.format(m.voiceMinutes / 60)} Std. Sprache`} />
          <MemberRanks title="Am meisten im Sprachkanal" description="Nach Stunden im Sprachkanal" members={data.topVoice} tracking={tracking} onSelect={onSelect}
            value={(m) => `${hours.format(m.voiceMinutes / 60)} Std.`} detail={(m) => `${number.format(m.messages)} Nachrichten`} />
        </div>
      )}
    </div>
  );
}
