// Mitglieder: retention of new joiners, top inviters, newest members and account age.
import type { MembersResponse } from '../../../../src/web/dto/insightsDetail';
import { HorizontalBars } from '../../components/charts';
import { Card, Empty } from '../../components/ui';
import { RankList } from '../rankingKit';
import { ago, DEFAULT_AVATAR, fullDate, GRID, number, percent, STACK } from './shared';

export function Members({ data, tracking, onSelect }: { data: MembersResponse; tracking: boolean; onSelect: (userId: string) => void }) {
  const { retention } = data;
  return (
    <div className={STACK}>
      <div className={GRID}>
        <HorizontalBars title="Bindung neuer Mitglieder" description="Neu im Zeitraum: wer noch da ist und wer geschrieben hat"
          unit="Mitglieder" ordinal
          items={retention && tracking ? [
            { key: 'joined', label: 'Beigetreten', value: retention.joined },
            { key: 'stillHere', label: 'Noch auf dem Server', value: retention.stillHere, detail: percent(retention.stillHere, retention.joined) },
            { key: 'active', label: 'Hat geschrieben', value: retention.active, detail: percent(retention.active, retention.joined) },
          ] : []}
          emptyTitle={tracking ? 'Noch keine Daten' : 'Aufzeichnung pro Mitglied ist aus'}
          emptyText={tracking ? 'Im Zeitraum ist noch niemand beigetreten.' : 'Schalte unten „Aufzeichnung pro Mitglied“ ein, um zu sehen, wer bleibt und schreibt.'} />
        <HorizontalBars title="Konto-Alter" description="Alter der Discord-Konten aller Mitglieder" unit="Mitglieder" ordinal
          items={data.accountAge.map((bucket) => ({ key: bucket.label, label: bucket.label, value: bucket.count }))} />
      </div>
      <div className={GRID}>
        <Card title="Top-Einlader" description="Nach Einladungen, die genutzt wurden">
          <RankList rows={data.inviters.map((inviter, i) => ({ rank: i + 1, userId: inviter.userId, name: inviter.name, avatarUrl: null, value: number.format(inviter.uses), detail: inviter.uses === 1 ? 'Einladung' : 'Einladungen' }))}
            loading={false} error={null} emptyTitle="Noch keine Einladungen" emptyText="Sobald jemand über einen Einladungslink beitritt, erscheint er hier."
            onSelect={onSelect} selectLabel="Filtern" />
        </Card>
        <Card title="Neueste Mitglieder">
          {data.newest.length === 0 ? <Empty title="Noch niemand beigetreten" /> : (
            <div className="list">
              {data.newest.map((member) => (
                <div className="list-item" key={member.userId}>
                  <img src={member.avatarUrl ?? DEFAULT_AVATAR} alt="" className="h-8 w-8 rounded-full" />
                  <div className="grow">
                    <button type="button" className="title block w-full cursor-pointer border-0 bg-transparent p-0 text-left [font:inherit] hover:underline"
                      onClick={() => onSelect(member.userId)}>{member.name}</button>
                    <div className="faint" title={fullDate(member.joinedAt)}>beigetreten {ago(member.joinedAt)}</div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm max-sm:hidden" onClick={() => onSelect(member.userId)}>Filtern</button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
