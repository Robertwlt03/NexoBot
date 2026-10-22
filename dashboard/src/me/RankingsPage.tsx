import { useMemo } from 'react';
import { MONTHLY_MAX_SERVERS, MONTHLY_MIN_HUMANS, RANKING_LABELS } from '../../../src/shared/cosmetics';
import type { GuildRanking, RankingsResponse } from '../../../src/web/dto/profile';
import { useApi, useUser } from '../api';
import { GuildIcon } from '../components/Layout';
import { Card, Empty, Notice, PageHeader, Spinner, TableWrap } from '../components/ui';
import { countdown, num, useNow } from './api';
import { Bernis } from './visuals';

const monthLabel = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

function RankingCard({ ranking }: { ranking: GuildRanking }) {
  const user = useUser();
  return (
    <Card title={RANKING_LABELS[ranking.kind]} description={ranking.kind === 'minigames' ? 'Punkte aus Minispielen' : 'Nachrichten und Sprachzeit'}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[12.5px] text-mute">Dein Platz</div>
          <div className="text-[34px] font-light leading-none tracking-[-0.03em] text-ink">{ranking.me.rank ? `#${ranking.me.rank}` : '–'}</div>
        </div>
        <div className="text-right text-[13px] text-mute">{num(ranking.me.points)} Punkte</div>
      </div>
      <ol className="list mt-4 p-0">
        {ranking.top.map((entry) => (
          <li key={entry.userId} className={`list-item !py-2 ${entry.userId === user?.id ? '!border-accent/40' : ''}`}>
            <span className="w-5 text-center text-[13px] text-faint tabular-nums">{entry.rank}</span>
            {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" className="h-7 w-7 rounded-full" /> : <span className="h-7 w-7 rounded-full bg-raised" />}
            <span className="grow title text-[14px]">{entry.name}{entry.userId === user?.id && <span className="ml-2 text-[12px] font-normal text-mute">(du)</span>}</span>
            <span className="text-[13px] text-mute tabular-nums">{num(entry.points)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-faint">
        {ranking.rewards.map((amount, i) => <span key={i}>Platz {i + 1}: <Bernis amount={amount} className="text-body" /></span>)}
      </div>
    </Card>
  );
}

export default function RankingsPage() {
  const { data, error, loading } = useApi<RankingsResponse>('/me/rankings');
  const now = useNow(60_000);
  const guilds = useMemo(() => {
    const map = new Map<string, GuildRanking[]>();
    for (const r of data?.rankings ?? []) map.set(r.guildId, [...(map.get(r.guildId) ?? []), r]);
    return [...map.values()];
  }, [data]);

  return (
    <>
      <PageHeader kicker="Mein Profil" title="Ranglisten" description="Jeden Monat bekommen die besten fünf pro Server Bernis – getrennt für Minispiele und Aktivität." />
      <Notice>Belohnungen gibt es auf Servern mit mindestens {MONTHLY_MIN_HUMANS} Menschen und von höchstens {MONTHLY_MAX_SERVERS} Servern pro Monat (die mit den höchsten Belohnungen zählen).</Notice>
      {loading && !data && <Spinner />}
      {error && <Notice tone="danger">{error}</Notice>}
      {data && guilds.length === 0 && <Card><Empty title="Noch keine Ranglisten">Sei auf einem Server mit Nexo aktiv, dann tauchst du hier auf.</Empty></Card>}
      {guilds.map((list) => {
        const first = list[0];
        return (
          <section key={first.guildId} className="mt-8">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <GuildIcon guild={{ name: first.guildName, iconUrl: first.guildIconUrl }} className="h-9 w-9 rounded-xl text-[13px] ring-1 ring-white/10" />
              <h2 className="min-w-0 flex-1 truncate text-[16px]">{first.guildName}</h2>
              <span className="basis-full text-[12.5px] text-mute sm:basis-auto">{monthLabel(first.month)} · endet in <span className="text-ink tabular-nums">{countdown(first.endsAt, now)}</span></span>
            </div>
            {!first.eligible && <div className="mb-3"><Notice tone="warn">Dieser Server hat weniger als {MONTHLY_MIN_HUMANS} Menschen – hier gibt es diesen Monat keine Belohnungen.</Notice></div>}
            <div className="grid-2 [&>*]:mt-0 [&>*]:min-w-0">{list.map((r) => <RankingCard key={r.kind} ranking={r} />)}</div>
          </section>
        );
      })}
      {data && data.lastPayouts.length > 0 && (
        <section className="mt-8">
          <Card title="Letzte Auszahlungen">
            <TableWrap>
              <thead><tr><th>Monat</th><th>Server</th><th>Rangliste</th><th>Platz</th><th className="text-right">Bernis</th></tr></thead>
              <tbody>
                {data.lastPayouts.map((p, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{monthLabel(p.month)}</td>
                    <td>{p.guildName}</td>
                    <td>{RANKING_LABELS[p.kind]}</td>
                    <td>#{p.rank}</td>
                    <td className="text-right font-medium text-pos"><span className="inline-flex items-center justify-end gap-1">+<Bernis amount={p.amount} /></span></td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>
        </section>
      )}
    </>
  );
}
