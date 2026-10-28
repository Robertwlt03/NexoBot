import { useState } from 'react';
import type { TransactionPage } from '../../../src/web/dto/profile';
import { useApi } from '../api';
import { Card, Empty, Notice, PageHeader, Pager, Spinner, Stats, TableWrap } from '../components/ui';
import { formatDateTime, useMe } from './api';
import { Bernis } from './visuals';

export default function HistoryPage() {
  const { me } = useMe();
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<TransactionPage>(`/me/transactions?page=${page}`);
  return (
    <>
      <PageHeader kicker="Mein Profil" title="Verlauf" description="Jede Bewegung auf deinem Berni-Konto: Einnahmen, Käufe und Geschenke. Bernis zählen in Münzen: 100 Bronze sind 1 Silber, 100 Silber 1 Gold, 100 Gold 1 Platin." />
      <Stats items={[
        { label: 'Kontostand', value: <Bernis amount={me.wallet.balance} /> },
        { label: 'Insgesamt verdient', value: <Bernis amount={me.wallet.lifetimeEarned} /> },
        {
          label: 'Heute verdient', value: <Bernis amount={me.wallet.todayEarned} />,
          hint: <>aus Level & Minispielen, höchstens <Bernis amount={me.wallet.dailyCap} nowrap /> am Tag</>,
        },
      ]} />
      <Card>
        {error && <Notice tone="danger" onRetry={reload}>{error}</Notice>}
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
                  <td className={`whitespace-nowrap text-right font-medium tabular-nums ${tx.amount >= 0 ? 'text-pos' : 'text-neg'}`}><span className="whitespace-nowrap">{tx.amount >= 0 ? '+' : '−'} <Bernis amount={Math.abs(tx.amount)} nowrap /></span></td>
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
