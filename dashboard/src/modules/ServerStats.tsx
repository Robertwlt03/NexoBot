import { useState } from 'react';
import type { CounterCreate, CounterItem, CounterType, ServerStatsState } from '../../../src/web/dto/serverstats';
import { COUNTER_TYPES } from '../../../src/web/dto/serverstats';
import { useAction, useApi, useGuild, useToast } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { Card, ChannelSelect, Empty, Field, Notice, PageHeader, Select, Spinner } from '../components/ui';
import { Icon } from '../icons';

type Result = ServerStatsState & { nameUpdated?: boolean };
const typeLabel = (type: string) => COUNTER_TYPES.find((entry) => entry.value === type)?.label ?? 'Unbekannt';
const RENAME_LATER = 'Der Kanalname konnte noch nicht gesetzt werden. Er wird beim nächsten Durchlauf (alle 15 Minuten) aktualisiert.';

export default function ServerStatsPage() {
  const { guild, reload: reloadGuild } = useGuild();
  const toast = useToast();
  const { data, setData, error, loading } = useApi<ServerStatsState>(`/guilds/${guild.id}/serverstats`);
  const { run, busy } = useAction();
  const { confirm, dialog } = useConfirm();
  const base = `/guilds/${guild.id}/serverstats`;
  const used = new Set(data?.counters.map((counter) => counter.type));
  const free = COUNTER_TYPES.filter((type) => !used.has(type.value));
  const [draft, setDraft] = useState<CounterCreate>({ type: 'members', channelType: 'voice', categoryId: null });
  const draftType = used.has(draft.type) ? free[0]?.value : draft.type;

  const apply = (result: Result | null) => {
    if (!result) return;
    setData(result);
    reloadGuild();
    if (result.nameUpdated === false) toast(RENAME_LATER, true);
  };

  const create = async () => apply(await run<Result>(base, { ...draft, type: draftType }, 'Zähler erstellt.'));
  const changeType = async (counter: CounterItem, type: CounterType) => apply(await run<Result>(`${base}/${counter.id}`, { type }, 'Zähler aktualisiert.'));

  return (
    <>
      <PageHeader icon="stats" title="Server-Statistiken" description="Kanäle, deren Name die Mitglieder- oder Botzahl anzeigt." />
      {loading && !data && <Spinner />}
      {error && !data && <Notice tone="danger">{error}</Notice>}
      {data && (
        <div className="stack">
          <Card icon="stats" title="Zähler" description="Die Namen werden automatisch alle 15 Minuten aktualisiert. Pro Typ ist ein Zähler möglich.">
            {data.counters.length === 0 ? <Empty title="Noch keine Zähler">Erstelle unten deinen ersten Zähler.</Empty> : (
              <div className="list">
                {data.counters.map((counter) => (
                  <div className="list-item" key={counter.id}>
                    <Icon name={counter.voice ? 'mic' : 'hash'} size={18} />
                    <div className="grow">
                      <div className="title">{counter.channelName ?? 'Gelöschter Kanal'}</div>
                      <div className="faint">{typeLabel(counter.type)} · ID {counter.id}</div>
                    </div>
                    {counter.channelName && (
                      <div style={{ minWidth: 180 }}>
                        <Select<CounterType>
                          value={counter.type as CounterType}
                          onChange={(type) => changeType(counter, type)}
                          options={COUNTER_TYPES.filter((type) => type.value === counter.type || !used.has(type.value))}
                        />
                      </div>
                    )}
                    <button type="button" className="btn btn-sm btn-ghost" aria-label="Zähler löschen" disabled={busy !== null}
                      onClick={() => confirm({
                        title: 'Zähler & Kanal löschen?', confirmLabel: 'Löschen',
                        text: <>Der Zähler <b>{typeLabel(counter.type)}</b> und sein Kanal{counter.channelName ? <> <b>{counter.channelName}</b></> : ''} werden dauerhaft gelöscht.</>,
                        onConfirm: async () => apply(await run<Result>(`${base}/${counter.id}/delete`, {}, 'Zähler gelöscht.')),
                      })}>
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card icon="plus" title="Zähler erstellen" description="Nexo legt dafür einen neuen Kanal in der gewählten Kategorie an.">
            {free.length === 0 ? <Notice>Alle Zählertypen sind schon angelegt.</Notice> : (
              <div className="stack">
                <div className="grid-2">
                  <Field label="Typ">
                    <Select<CounterType> value={draftType ?? 'members'} onChange={(type) => setDraft({ ...draft, type })} options={free} />
                  </Field>
                  <Field label="Kanaltyp" hint="Sprachkanäle sind empfohlen: niemand kann hineinschreiben.">
                    <Select<'voice' | 'text'> value={draft.channelType} onChange={(channelType) => setDraft({ ...draft, channelType })}
                      options={[{ value: 'voice', label: 'Sprachkanal' }, { value: 'text', label: 'Textkanal' }]} />
                  </Field>
                </div>
                <Field label="Kategorie">
                  <ChannelSelect kind="category" value={draft.categoryId} onChange={(categoryId) => setDraft({ ...draft, categoryId })} placeholder="Kategorie auswählen" />
                </Field>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-primary" disabled={busy !== null || !draft.categoryId} onClick={create}>
                    {busy ? 'Wird erstellt …' : 'Zähler erstellen'}
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
      {dialog}
    </>
  );
}
