import { useState } from 'react';
import type { TransactionPage } from '../../../src/web/dto/profile';
import { useApi } from '../api';
import { Card, Empty, Notice, PageHeader, Pager, Spinner, Stats, TableWrap } from '../components/ui';
import { formatDateTime, num, useMe } from './api';
import { Bernis } from './visuals';

export default function HistoryPage() {
  const { me } = useMe();
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi<TransactionPage>(`/me/transactions?page=${page}`);
  return (
    <>
      <PageHeader kicker="Mein Profil" title="Verlauf" description="Jede Bewegung auf deinem Berni-Konto: Einnahmen aus Level-ups, Minispielen und Ranglisten, Käufe und Geschenke." />
      <Stats items={[
        { label: 'Kontostand', value: <Bernis amount={me.wallet.balance} /> },
        { label: 'Insgesamt verdient', value: <Bernis amount={me.wallet.lifetimeEarned} /> },
        { label: 'Heute (Level & Minispiele)', value: <span className="inline-flex flex-wrap items-center gap-x-2"><Bernis amount={me.wallet.todayEarned} /> <span className="text-mute">/</span> <Bernis amount={me.wallet.dailyCap} /></span>, hint: 'Tageslimit; Ranglisten, Erfolge und Tagesbonus zählen nicht mit.' },
      ]} />
      <Card>
        {error && <Notice tone="danger">{error}</Notice>}
        {!data && loading && <Spinner />}
        {data && data.items.length === 0 && <Empty title="Noch keine Buchungen">Sobald du Bernis verdienst oder ausgibst, steht es hier.</Empty>}
        {data && data.items.length > 0 && (
          <TableWrap>
            <thead><tr><th>Buchung</th><th className="text-right">Betrag</th></tr></thead>
            <tbody>
              {data.items.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    <div className="text-ink">{tx.label}</div>
                    <div className="faint tabular-nums">{formatDateTime(tx.createdAt)}{tx.guildName && ` · ${tx.guildName}`}</div>
                  </td>
                  <td className={`whitespace-nowrap text-right font-medium tabular-nums ${tx.amount >= 0 ? 'text-pos' : 'text-neg'}`}><span className="inline-flex items-center justify-end gap-1">{tx.amount >= 0 ? '+' : '−'}<Bernis amount={Math.abs(tx.amount)} /></span></td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
        {data && <Pager page={data.page} pages={data.pages} onPage={setPage} busy={loading} />}
      </Card>
    </>
  );
}
