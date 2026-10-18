import { useState } from 'react';
import type { GiveawayCreate, GiveawayItem, GiveawayList, GiveawayStatus } from '../../../src/web/dto/giveaways';
import { useAction, useApi, useGuild } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { Badge, Card, ChannelSelect, Empty, Field, Modal, Notice, NumberInput, PageHeader, Spinner, TextInput } from '../components/ui';
import { Icon } from '../icons';

const formatDate = (ms: number | null) => ms ? new Date(ms).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '–';

function CreateModal({ list, onClose, onCreated }: { list: GiveawayList; onClose: () => void; onCreated: () => void }) {
  const { guild } = useGuild();
  const { run, busy } = useAction();
  const [draft, setDraft] = useState<GiveawayCreate>({ channelId: null, prize: '', duration: '1d', winnerCount: 1 });
  const set = (patch: Partial<GiveawayCreate>) => setDraft((prev) => ({ ...prev, ...patch }));

  const submit = async () => {
    const result = await run(`/guilds/${guild.id}/giveaways`, draft, 'Giveaway gestartet. 🎉');
    if (result) onCreated();
  };

  return (
    <Modal
      title="Giveaway starten"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy !== null || !draft.channelId || !draft.prize.trim()}>
            {busy ? 'Wird gestartet …' : 'Giveaway starten'}
          </button>
        </>
      )}
    >
      <div className="stack">
        <Field label="Kanal"><ChannelSelect value={draft.channelId} onChange={(channelId) => set({ channelId })} /></Field>
        <Field label="Preis"><TextInput value={draft.prize} onChange={(prize) => set({ prize })} maxLength={256} placeholder="z. B. Nitro Classic" /></Field>
        <div className="grid-2">
          <Field label="Dauer" hint="z. B. 30m, 2h, 7d – mindestens 10s, höchstens 30d.">
            <TextInput value={draft.duration} onChange={(duration) => set({ duration })} maxLength={10} placeholder="1d" />
          </Field>
          <Field label="Gewinner">
            <NumberInput value={draft.winnerCount} min={list.minWinners} max={list.maxWinners} onChange={(winnerCount) => set({ winnerCount })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export default function GiveawaysPage() {
  const { guild } = useGuild();
  const [status, setStatus] = useState<GiveawayStatus>('active');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useApi<GiveawayList>(`/guilds/${guild.id}/giveaways?status=${status}&page=${page}`);
  const { run, busy } = useAction();
  const { confirm, dialog } = useConfirm();
  const base = `/guilds/${guild.id}/giveaways`;
  const channelName = (id: string | null) => guild.channels.find((channel) => channel.id === id)?.name ?? 'gelöschter Kanal';
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const act = async (giveaway: GiveawayItem, action: 'end' | 'reroll' | 'delete', success: string) => {
    if (await run(`${base}/${giveaway.messageId}/${action}`, {}, success)) reload();
  };

  const switchTab = (next: GiveawayStatus) => { setStatus(next); setPage(1); };

  return (
    <>
      <PageHeader
        icon="gift"
        title="Giveaways"
        description="Starte Giveaways, beende sie vorzeitig oder lose neue Gewinner aus."
        actions={data && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} />Giveaway starten</button>}
      />
      {loading && !data && <Spinner />}
      {error && !data && <Notice tone="danger">{error}</Notice>}
      {data && (
        <Card
          right={(
            <div className="row">
              <button type="button" className={`btn btn-sm ${status === 'active' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => switchTab('active')}>Aktiv ({data.activeCount})</button>
              <button type="button" className={`btn btn-sm ${status === 'ended' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => switchTab('ended')}>Beendet ({data.endedCount})</button>
            </div>
          )}
          title={status === 'active' ? 'Laufende Giveaways' : 'Beendete Giveaways'}
        >
          {data.items.length === 0 ? (
            <Empty title={status === 'active' ? 'Gerade läuft kein Giveaway' : 'Noch keine beendeten Giveaways'}>
              {status === 'active' ? 'Starte oben rechts ein neues Giveaway.' : 'Beendete Giveaways erscheinen hier.'}
            </Empty>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr><th>Preis</th><th>Kanal</th><th>{status === 'active' ? 'Endet' : 'Gewinner'}</th><th>Teilnahmen</th><th /></tr>
                </thead>
                <tbody>
                  {data.items.map((giveaway) => (
                    <tr key={giveaway.messageId}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{giveaway.prize}</div>
                        <div className="faint">{giveaway.winnerCount} Gewinner{giveaway.host ? ` · von ${giveaway.host.name}` : ''}</div>
                      </td>
                      <td>
                        {giveaway.messageUrl
                          ? <a href={giveaway.messageUrl} target="_blank" rel="noreferrer"># {channelName(giveaway.channelId)} <Icon name="external" size={12} /></a>
                          : <span className="faint">–</span>}
                      </td>
                      <td>
                        {status === 'active'
                          ? formatDate(giveaway.endsAt)
                          : giveaway.winners.length
                            ? <div className="chips">{giveaway.winners.map((winner) => <span key={winner.id} className="chip" style={{ paddingRight: 10 }}>{winner.name}</span>)}</div>
                            : <Badge on={false}>Keine Gewinner</Badge>}
                      </td>
                      <td>{giveaway.entries}</td>
                      <td>
                        <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          {status === 'active' ? (
                            <button type="button" className="btn btn-sm btn-secondary" disabled={busy !== null}
                              onClick={() => confirm({
                                title: 'Giveaway jetzt beenden?', danger: false, confirmLabel: 'Jetzt beenden',
                                text: <>Für <b>{giveaway.prize}</b> werden sofort {giveaway.winnerCount} Gewinner aus {giveaway.entries} Teilnahmen gezogen und im Kanal verkündet.</>,
                                onConfirm: () => act(giveaway, 'end', 'Giveaway beendet.'),
                              })}>Beenden</button>
                          ) : (
                            <button type="button" className="btn btn-sm btn-secondary" disabled={busy !== null}
                              onClick={() => confirm({
                                title: 'Neu auslosen?', danger: false, confirmLabel: 'Neu auslosen',
                                text: <>Für <b>{giveaway.prize}</b> werden neue Gewinner gezogen und im Kanal verkündet.</>,
                                onConfirm: () => act(giveaway, 'reroll', 'Neue Gewinner gezogen.'),
                              })}>Neu auslosen</button>
                          )}
                          <button type="button" className="btn btn-sm btn-danger" aria-label="Löschen" disabled={busy !== null}
                            onClick={() => confirm({
                              title: 'Giveaway löschen?', confirmLabel: 'Löschen',
                              text: <>Die Nachricht zu <b>{giveaway.prize}</b> wird aus Discord gelöscht und das Giveaway entfernt. Das kann nicht rückgängig gemacht werden.</>,
                              onConfirm: () => act(giveaway, 'delete', 'Giveaway gelöscht.'),
                            })}><Icon name="trash" size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages > 1 && (
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Zurück</button>
              <span className="faint">Seite {page} von {pages}</span>
              <button type="button" className="btn btn-sm btn-secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Weiter</button>
            </div>
          )}
        </Card>
      )}
      {creating && data && <CreateModal list={data} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); switchTab('active'); reload(); }} />}
      {dialog}
    </>
  );
}
