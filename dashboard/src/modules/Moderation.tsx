import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { CasesPage, NoteType, NotesPage, Paged, WarningsPage } from '../../../src/web/dto/moderation';
import { NOTE_MAX_LENGTH, NOTE_TYPE_LABELS } from '../../../src/web/dto/moderation';
import { useAction, useApi, useGuild } from '../api';
import { Card, Empty, Field, Modal, Notice, PageHeader, Select, Spinner, TextArea, TextInput } from '../components/ui';

const ID_PATTERN = /^\d{17,20}$/;
const formatDate = (value: string | number) => new Date(value).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
/** "tag (id)" → "tag" */
const tagOf = (value: string | null) => value?.replace(/\s*\(\d+\)$/, '') ?? '—';

function query(params: Record<string, string | number>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== '') search.set(key, String(value));
  return search.toString();
}

/** Raw text of an id filter → the id to send, or '' while it is incomplete (no request per keystroke). */
const validId = (value: string) => (ID_PATTERN.test(value) ? value : '');

function IdFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label} hint="Nutzer-ID (Rechtsklick auf den Nutzer → ID kopieren)" error={value && !ID_PATTERN.test(value) ? 'Ungültige ID' : null}>
      <div className="input-group">
        <TextInput value={value} onChange={(next) => onChange(next.trim())} placeholder="Alle" maxLength={20} />
        {value && <button type="button" className="btn btn-ghost btn-sm" aria-label="Filter entfernen" onClick={() => onChange('')}>×</button>}
      </div>
    </Field>
  );
}

function Pager({ data, onPage }: { data: Paged; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  if (pages <= 1) return null;
  return (
    <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
      <button type="button" className="btn btn-secondary btn-sm" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Zurück</button>
      <span className="faint">Seite {data.page} von {pages}</span>
      <button type="button" className="btn btn-secondary btn-sm" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>Weiter</button>
    </div>
  );
}

interface Confirm { title: string; text: string; label: string; run: () => Promise<unknown> }

function ConfirmModal({ confirm, onClose }: { confirm: Confirm | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!confirm) return null;
  return (
    <Modal title={confirm.title} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Abbrechen</button>
        <button type="button" className="btn btn-danger" disabled={busy}
          onClick={async () => { setBusy(true); await confirm.run(); setBusy(false); onClose(); }}>{confirm.label}</button>
      </>
    )}>
      <p className="muted">{confirm.text}</p>
    </Modal>
  );
}

function Table({ loading, error, empty, children }: { loading: boolean; error: string | null; empty: boolean; children: ReactNode }) {
  if (loading && empty) return <Spinner />;
  if (error) return <Notice tone="danger">{error}</Notice>;
  if (empty) return <Empty title="Nichts gefunden">Für diese Auswahl gibt es keine Einträge.</Empty>;
  return <div style={{ overflowX: 'auto' }}><table className="table">{children}</table></div>;
}

// ---------- Cases ----------

function CasesTab() {
  const { guild } = useGuild();
  const [filter, setFilter] = useState({ action: '', userId: '', moderatorId: '', page: 1 });
  const { data, error, loading } = useApi<CasesPage>(`/guilds/${guild.id}/moderation/cases?${query({ ...filter, userId: validId(filter.userId), moderatorId: validId(filter.moderatorId) })}`);
  const update = (patch: Partial<typeof filter>) => setFilter((prev) => ({ ...prev, page: 1, ...patch }));

  return (
    <Card icon="gavel" title="Moderationsfälle" description="Alle Fälle aus /cases: Banns, Kicks, Timeouts, Verwarnungen und mehr.">
      <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 14 }}>
        <Field label="Aktion">
          <Select value={filter.action} onChange={(action) => update({ action })}
            options={[{ value: '', label: 'Alle Aktionen' }, ...(data?.actions ?? [])]} />
        </Field>
        <IdFilter label="Nutzer" value={filter.userId} onChange={(userId) => update({ userId })} />
        <IdFilter label="Moderator" value={filter.moderatorId} onChange={(moderatorId) => update({ moderatorId })} />
      </div>
      <Table loading={loading} error={error} empty={!data?.cases.length}>
        <thead><tr><th>#</th><th>Aktion</th><th>Nutzer</th><th>Moderator</th><th>Grund</th><th>Datum</th></tr></thead>
        <tbody>
          {data?.cases.map((entry) => (
            <tr key={entry.caseId}>
              <td className="faint">{entry.caseId}</td>
              <td>{entry.actionLabel}{entry.duration && <div className="faint">{entry.duration}</div>}</td>
              <td>{entry.targetUserId
                ? <button type="button" className="btn btn-ghost btn-sm" title="Nach Nutzer filtern" onClick={() => update({ userId: entry.targetUserId! })}>{tagOf(entry.target)}</button>
                : tagOf(entry.target)}</td>
              <td>{tagOf(entry.executor)}</td>
              <td>{entry.reason || <span className="faint">Kein Grund angegeben</span>}</td>
              <td className="faint">{formatDate(entry.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {data && <Pager data={data} onPage={(page) => setFilter((prev) => ({ ...prev, page }))} />}
    </Card>
  );
}

// ---------- Warnings ----------

function WarningsTab() {
  const { guild } = useGuild();
  const { run } = useAction();
  const [filter, setFilter] = useState({ userId: '', page: 1 });
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const base = `/guilds/${guild.id}/moderation/warnings`;
  const { data, error, loading, reload } = useApi<WarningsPage>(`${base}?${query({ ...filter, userId: validId(filter.userId) })}`);

  const remove = (userId: string, warningId: number, name: string) => setConfirm({
    title: 'Verwarnung entfernen',
    text: `Diese Verwarnung von ${name} wird gelöscht.`,
    label: 'Entfernen',
    run: async () => { if (await run(`${base}/remove`, { userId, warningId }, 'Verwarnung entfernt.')) reload(); },
  });
  const clear = (userId: string, name: string) => setConfirm({
    title: 'Alle Verwarnungen löschen',
    text: `Alle Verwarnungen von ${name} werden gelöscht. Das kann nicht rückgängig gemacht werden.`,
    label: 'Alle löschen',
    run: async () => { if (await run(`${base}/clear`, { userId }, 'Verwarnungen gelöscht.')) reload(); },
  });

  return (
    <Card icon="flag" title="Verwarnungen" description="Aktive Verwarnungen aus /mod warn. Neue Verwarnungen vergibst du in Discord.">
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <IdFilter label="Nutzer" value={filter.userId} onChange={(userId) => setFilter({ userId, page: 1 })} />
        {validId(filter.userId) && data?.warnings[0] && (
          <div style={{ alignSelf: 'center' }}>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => clear(filter.userId, data.warnings[0].userName)}>Alle Verwarnungen dieses Nutzers löschen</button>
          </div>
        )}
      </div>
      <Table loading={loading} error={error} empty={!data?.warnings.length}>
        <thead><tr><th>Nutzer</th><th>Grund</th><th>Moderator</th><th>Datum</th><th /></tr></thead>
        <tbody>
          {data?.warnings.map((w) => (
            <tr key={`${w.userId}-${w.id}`}>
              <td><button type="button" className="btn btn-ghost btn-sm" title="Nach Nutzer filtern" onClick={() => setFilter({ userId: w.userId, page: 1 })}>{w.userName}</button></td>
              <td>{w.reason}</td>
              <td>{w.moderatorName}</td>
              <td className="faint">{formatDate(w.timestamp)}</td>
              <td style={{ textAlign: 'right' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(w.userId, w.id, w.userName)}>Entfernen</button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {data && <Pager data={data} onPage={(page) => setFilter((prev) => ({ ...prev, page }))} />}
      <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />
    </Card>
  );
}

// ---------- User notes ----------

const NOTE_TYPES = Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => ({ value: value as NoteType, label }));

function NotesTab() {
  const { guild } = useGuild();
  const { run, busy } = useAction();
  const [filter, setFilter] = useState({ userId: '', page: 1 });
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [draft, setDraft] = useState<{ userId: string; type: NoteType; content: string }>({ userId: '', type: 'neutral', content: '' });
  const base = `/guilds/${guild.id}/moderation/notes`;
  const { data, error, loading, reload } = useApi<NotesPage>(`${base}?${query({ ...filter, userId: validId(filter.userId) })}`);

  const add = async () => {
    if (await run(`${base}/add`, draft, 'Notiz hinzugefügt.')) {
      setDraft((prev) => ({ ...prev, content: '' }));
      reload();
    }
  };
  const remove = (userId: string, noteId: number) => setConfirm({
    title: 'Notiz löschen', text: 'Diese Notiz wird gelöscht.', label: 'Löschen',
    run: async () => { if (await run(`${base}/remove`, { userId, noteId }, 'Notiz gelöscht.')) reload(); },
  });
  const clear = (userId: string, name: string) => setConfirm({
    title: 'Alle Notizen löschen', text: `Alle Notizen zu ${name} werden gelöscht. Das kann nicht rückgängig gemacht werden.`, label: 'Alle löschen',
    run: async () => { if (await run(`${base}/clear`, { userId }, 'Notizen gelöscht.')) reload(); },
  });

  return (
    <>
      <Card icon="plus" title="Notiz hinzufügen" description="Interne Notiz für dein Team, wie /usernotes add. Der Nutzer sieht sie nicht.">
        <div className="grid-2">
          <Field label="Nutzer-ID" error={draft.userId && !ID_PATTERN.test(draft.userId) ? 'Ungültige ID' : null}>
            <TextInput value={draft.userId} onChange={(userId) => setDraft({ ...draft, userId: userId.trim() })} maxLength={20} placeholder="123456789012345678" />
          </Field>
          <Field label="Art">
            <Select value={draft.type} onChange={(type) => setDraft({ ...draft, type })} options={NOTE_TYPES} />
          </Field>
        </div>
        <Field label="Notiz">
          <TextArea value={draft.content} onChange={(content) => setDraft({ ...draft, content })} maxLength={NOTE_MAX_LENGTH} rows={3} />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" onClick={add}
            disabled={busy !== null || !ID_PATTERN.test(draft.userId) || !draft.content.trim()}>Notiz speichern</button>
        </div>
      </Card>

      <Card icon="clipboard" title="Nutzernotizen" description="Alle Notizen auf diesem Server, die neuesten zuerst.">
        <div className="grid-2" style={{ marginBottom: 14 }}>
          <IdFilter label="Nutzer" value={filter.userId} onChange={(userId) => setFilter({ userId, page: 1 })} />
          {validId(filter.userId) && data?.notes[0] && (
            <div style={{ alignSelf: 'center' }}>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => clear(filter.userId, data.notes[0].userName)}>Alle Notizen dieses Nutzers löschen</button>
            </div>
          )}
        </div>
        <Table loading={loading} error={error} empty={!data?.notes.length}>
          <thead><tr><th>Nutzer</th><th>Art</th><th>Notiz</th><th>Von</th><th>Datum</th><th /></tr></thead>
          <tbody>
            {data?.notes.map((note) => (
              <tr key={`${note.userId}-${note.id}`}>
                <td><button type="button" className="btn btn-ghost btn-sm" title="Nach Nutzer filtern" onClick={() => { setFilter({ userId: note.userId, page: 1 }); setDraft((prev) => ({ ...prev, userId: note.userId })); }}>{note.userName}</button></td>
                <td>{NOTE_TYPE_LABELS[note.type]}</td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{note.content}</td>
                <td>{note.author}</td>
                <td className="faint">{formatDate(note.timestamp)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(note.userId, note.id)}>Löschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {data && <Pager data={data} onPage={(page) => setFilter((prev) => ({ ...prev, page }))} />}
        <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />
      </Card>
    </>
  );
}

// ---------- Page ----------

const TABS = [
  { id: 'cases', label: 'Fälle', component: CasesTab },
  { id: 'warnings', label: 'Verwarnungen', component: WarningsTab },
  { id: 'notes', label: 'Notizen', component: NotesTab },
] as const;

export default function ModerationPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('cases');
  const Active = TABS.find((entry) => entry.id === tab)!.component;
  return (
    <>
      <PageHeader icon="gavel" title="Moderation" description="Fälle, Verwarnungen und Nutzernotizen" />
      <Notice>
        Den Mod-Log-Kanal stellst du unter <Link to="../logging">Logging</Link> ein, Moderator- und Admin-Rolle
        unter <Link to="../general">Allgemein</Link>. Bannen, Kicken und Timeouts machst du direkt in Discord.
      </Notice>
      <div className="row">
        {TABS.map((entry) => (
          <button key={entry.id} type="button" className={`btn btn-sm ${entry.id === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(entry.id)}>{entry.label}</button>
        ))}
      </div>
      <Active />
    </>
  );
}
