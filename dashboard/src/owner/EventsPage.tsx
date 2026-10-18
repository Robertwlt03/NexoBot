import { useState } from 'react';
import { COSMETIC_SLOTS, SLOT_LABELS } from '../../../src/shared/cosmetics';
import type { CosmeticSlot } from '../../../src/shared/cosmetics';
import type { ShopEvent } from '../../../src/web/dto/profile';
import { useApi } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { Card, Empty, Field, Modal, Notice, NumberInput, PageHeader, Spinner, Switch, SwitchRow, TextArea, TextInput } from '../components/ui';
import { Icon } from '../icons';
import { formatDateTime, useMutation, useNow } from '../me/api';

/** ISO ↔ value of <input type="datetime-local"> (local time). */
const toLocalInput = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
const fromLocalInput = (value: string) => new Date(value).toISOString();

function status(event: ShopEvent, now: number) {
  if (!event.active) return <span className="badge badge-off">Deaktiviert</span>;
  if (Date.parse(event.endsAt) <= now) return <span className="badge badge-off">Beendet</span>;
  if (Date.parse(event.startsAt) <= now) return <span className="badge badge-on">Läuft</span>;
  return <span className="badge">Geplant</span>;
}

const blankEvent = (): ShopEvent => ({
  id: '', name: '', description: '', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  discount: 20, slots: null, kind: 'custom', active: true,
});

function EventEditor({ initial, onClose, onSaved }: { initial: ShopEvent; onClose: () => void; onSaved: () => void }) {
  const [event, setEvent] = useState(initial);
  const { run, busy } = useMutation();
  const isNew = !initial.id;
  const set = (patch: Partial<ShopEvent>) => setEvent((prev) => ({ ...prev, ...patch }));
  const rangeError = Date.parse(event.endsAt) <= Date.parse(event.startsAt) ? 'Das Ende muss nach dem Start liegen.' : null;
  const valid = event.name.trim() !== '' && !rangeError && Number.isInteger(event.discount) && event.discount >= 0 && event.discount <= 90 && (event.slots === null || event.slots.length > 0);
  const toggleSlot = (slot: CosmeticSlot) => {
    const slots = event.slots ?? [];
    set({ slots: slots.includes(slot) ? slots.filter((s) => s !== slot) : [...slots, slot] });
  };
  const save = async () => {
    if (await run(isNew ? '/owner/events' : `/owner/events/${event.id}`, isNew ? 'POST' : 'PUT', event, isNew ? 'Event angelegt.' : 'Event gespeichert.')) onSaved();
  };

  return (
    <Modal title={isNew ? 'Neues Event' : `„${initial.name}“ bearbeiten`} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={save}>{isNew ? 'Anlegen' : 'Speichern'}</button>
      </>
    )}>
      <div className="-mx-6 max-h-[62vh] overflow-y-auto px-6">
        <div className="stack">
          <Field label="Name"><TextInput value={event.name} onChange={(name) => set({ name })} maxLength={40} placeholder="Herbst-Special" /></Field>
          <Field label="Beschreibung"><TextArea value={event.description} onChange={(description) => set({ description })} maxLength={200} rows={2} /></Field>
          <div className="grid-2">
            <Field label="Start"><input className="input" type="datetime-local" value={toLocalInput(event.startsAt)} onChange={(e) => e.target.value && set({ startsAt: fromLocalInput(e.target.value) })} /></Field>
            <Field label="Ende" error={rangeError}><input className="input" type="datetime-local" value={toLocalInput(event.endsAt)} onChange={(e) => e.target.value && set({ endsAt: fromLocalInput(e.target.value) })} /></Field>
          </div>
          <Field label="Rabatt (%)" hint="0–90 %"><NumberInput value={event.discount} onChange={(discount) => set({ discount })} min={0} max={90} step={5} /></Field>
          <SwitchRow title="Gilt für alle Bereiche" checked={event.slots === null} onChange={(all) => set({ slots: all ? null : [] })} />
          {event.slots !== null && (
            <div className="flex flex-wrap gap-1.5">
              {COSMETIC_SLOTS.map((slot) => {
                const on = event.slots?.includes(slot) ?? false;
                return (
                  <button key={slot} type="button" aria-pressed={on} onClick={() => toggleSlot(slot)}
                    className={`cursor-pointer rounded-full border px-3 py-1 font-[inherit] text-[13px] ${on ? 'border-accent bg-accent/10 text-ink' : 'border-white/[.08] bg-transparent text-mute hover:text-ink'}`}>
                    {SLOT_LABELS[slot]}
                  </button>
                );
              })}
            </div>
          )}
          <SwitchRow title="Aktiv" checked={event.active} onChange={(active) => set({ active })} />
        </div>
      </div>
    </Modal>
  );
}

export default function EventsPage() {
  const { data, error, loading, reload } = useApi<ShopEvent[]>('/owner/events');
  const { run } = useMutation();
  const { confirm, dialog } = useConfirm();
  const now = useNow(60_000);
  const [editing, setEditing] = useState<ShopEvent | null>(null);
  const sorted = [...(data ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const toggleAuto = async (event: ShopEvent, active: boolean) => { if (await run(`/owner/events/${event.id}`, 'PUT', { active }, active ? 'Event aktiviert.' : 'Event deaktiviert.')) reload(); };
  const remove = (event: ShopEvent) => confirm({
    title: 'Event löschen', text: `„${event.name}“ wird gelöscht. Event-Artikel sind danach nicht mehr kaufbar.`, confirmLabel: 'Löschen',
    onConfirm: async () => { if (await run(`/owner/events/${event.id}`, 'DELETE', undefined, 'Event gelöscht.')) reload(); },
  });

  const row = (event: ShopEvent) => (
    <li key={event.id} className="list-item flex-wrap">
      <div className="grow">
        <div className="flex flex-wrap items-center gap-2"><span className="title">{event.name}</span>{status(event, now)}</div>
        <div className="faint mt-0.5">
          {formatDateTime(event.startsAt)} – {formatDateTime(event.endsAt)} · −{event.discount} % · {event.slots ? event.slots.map((s) => SLOT_LABELS[s]).join(', ') : 'alle Bereiche'}
        </div>
      </div>
      {event.kind === 'auto'
        ? <Switch checked={event.active} onChange={(active) => toggleAuto(event, active)} label={`${event.name} aktiv`} />
        : (
          <div className="flex gap-1">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(event)}>Bearbeiten</button>
            <button type="button" className="btn btn-ghost btn-sm text-neg" onClick={() => remove(event)}>Löschen</button>
          </div>
        )}
    </li>
  );

  return (
    <>
      <PageHeader kicker="Owner" title="Events" description="Rabattaktionen im Shop. Automatische Events kommen jedes Jahr wieder, eigene legst du selbst an."
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing(blankEvent())}><Icon name="plus" size={16} /> Neues Event</button>} />
      {loading && !data && <Spinner />}
      {error && <Notice tone="danger">{error}</Notice>}
      {data && (
        <>
          <Card title="Eigene Events" description="Mit Zeitraum, Rabatt und Bereichen – Event-Artikel sind nur während des Events kaufbar.">
            {sorted.some((e) => e.kind === 'custom') ? <ul className="list p-0">{sorted.filter((e) => e.kind === 'custom').map(row)}</ul> : <Empty title="Noch keine eigenen Events" />}
          </Card>
          <Card title="Automatische Events" description="Feste Termine im Kalender. Schalte aus, was du nicht willst.">
            <ul className="list p-0">{sorted.filter((e) => e.kind === 'auto').map(row)}</ul>
          </Card>
        </>
      )}
      {editing && <EventEditor initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {dialog}
    </>
  );
}
