import { Link } from 'react-router';
import type { OwnerOverview } from '../../../src/web/dto/profile';
import { useApi } from '../api';
import { HorizontalBars } from '../components/charts';
import { Badge, Card, Notice, PageHeader, Spinner, Stats } from '../components/ui';
import { countdown, formatDate, num, useNow } from '../me/api';
import { Bernis } from '../me/visuals';

export default function OwnerOverviewPage() {
  const { data, error, loading, reload } = useApi<OwnerOverview>('/owner/overview');
  const now = useNow(60_000);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <Notice tone="danger" onRetry={reload}>{error ?? 'Keine Daten.'}</Notice>;
  const { stats, events, blackMarket } = data;
  const running = events.filter((e) => e.active && Date.parse(e.startsAt) <= now && Date.parse(e.endsAt) > now);
  const next = events.filter((e) => e.active && Date.parse(e.startsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  return (
    <>
      <PageHeader kicker="Owner" title="Berni-Wirtschaft" description="Wie viele Bernis im Umlauf sind, was sich verkauft und wer am meisten hat." />
      <Stats items={[
        { label: 'Im Umlauf', value: <Bernis amount={stats.supply} /> },
        { label: 'Konten', value: num(stats.wallets) },
        { label: 'Heute verdient', value: <Bernis amount={stats.earnedToday} /> },
        { label: 'Heute ausgegeben', value: <Bernis amount={stats.spentToday} />, hint: stats.earnedToday ? `${Math.round((stats.spentToday / stats.earnedToday) * 100)} % der Einnahmen` : undefined },
      ]} />
      <div className="grid-2 [&>*]:mt-0 [&>*]:min-w-0">
        <HorizontalBars title="Bestseller" description="Meistverkaufte Artikel" unit="Verkäufe"
          items={stats.bestsellers.map((b) => ({ key: b.itemId, label: b.name, value: b.sold }))} />
        <Card title="Größte Kontostände">
          <ol className="list p-0">
            {stats.topHolders.map((h, i) => (
              <li key={h.userId} className="list-item !py-2">
                <span className="w-5 text-center text-[13px] text-faint tabular-nums">{i + 1}</span>
                <span className="grow title text-[14px]">{h.name}</span>
                <Bernis amount={h.balance} className="text-[13px] text-mute" />
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <div className="grid-2 mt-4 [&>*]:mt-0 [&>*]:min-w-0">
        <Card title="Events" right={<Link to="/owner/events" className="text-[13px]">Verwalten</Link>}>
          <div className="stack gap-2 text-[13.5px]">
            {running.map((e) => <div key={e.id}><Badge tone="pos">Läuft</Badge> <b className="font-medium text-ink">{e.name}</b>{e.discount > 0 && ` · −${e.discount} %`} · endet in {countdown(e.endsAt, now)}</div>)}
            {!running.length && <span className="muted">Gerade läuft kein Event.</span>}
            {next && <div className="muted">Als Nächstes: <b className="font-medium text-ink">{next.name}</b> am {formatDate(next.startsAt)}</div>}
          </div>
        </Card>
        <Card title="Black Market" right={<Link to="/owner/blackmarket" className="text-[13px]">Verwalten</Link>}>
          <p className="text-[13.5px] text-body">{blackMarket.listings.length} Artikel diese Woche · neue Rotation in {countdown(blackMarket.endsAt, now)}</p>
          <p className="faint mt-1">{blackMarket.listings.map((l) => l.item.name).join(' · ')}</p>
        </Card>
      </div>
    </>
  );
}
