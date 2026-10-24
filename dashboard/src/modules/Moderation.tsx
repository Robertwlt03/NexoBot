import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { CasesPage, NoteType, NotesPage, Paged, WarningsPage } from '../../../src/web/dto/moderation';
import { NOTE_MAX_LENGTH, NOTE_TYPE_LABELS } from '../../../src/web/dto/moderation';
import { useAction, useApi, useGuild } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { Actions, Card, Empty, Field, Notice, PageHeader, Pager, Select, Spinner, TableWrap, Tabs, TextArea, TextInput } from '../components/ui';

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

const pagesOf = (data: Paged) => Math.max(1, Math.ceil(data.total / data.pageSize));

function Table({ loading, error, empty, children }: { loading: boolean; error: string | null; empty: boolean; children: ReactNode }) {
  if (loading && empty) return <Spinner />;
  if (error) return <Notice tone="danger">{error}</Notice>;
  if (empty) return <Empty title="Nichts gefunden">Für diese Auswahl gibt es keine Einträge.</Empty>;
  return <TableWrap>{children}</TableWrap>;
}

// ---------- Cases ----------

function CasesTab() {
  const { guild } = useGuild();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState({ action: '', userId: params.get('userId') ?? '', moderatorId: '', page: 1 });
  const { data, error, loading } = useApi<CasesPage>(`/guilds/${guild.id}/moderation/cases?${query({ ...filter, userId: validId(filter.userId), moderatorId: validId(filter.moderatorId) })}`);
  const update = (patch: Partial<typeof filter>) => setFilter((prev) => ({ ...prev, page: 1, ...patch }));

  return (
    <Card icon="gavel" title="Moderationsfälle" description="Alle Fälle aus /cases: Banns, Kicks, Timeouts, Verwarnungen und mehr.">
      <div className="auto-grid mb-4">
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
      {data && <Pager page={data.page} pages={pagesOf(data)} busy={loading} onPage={(page) => setFilter((prev) => ({ ...prev, page }))} />}
    </Card>
  );
}

// ---------- Warnings ----------

function WarningsTab() {
  const { guild } = useGuild();
  const { run } = useAction();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState({ userId: params.get('userId') ?? '', page: 1 });
  const { confirm, dialog } = useConfirm();
  const base = `/guilds/${guild.id}/moderation/warnings`;
  const { data, error, loading, reload } = useApi<WarningsPage>(`${base}?${query({ ...filter, userId: validId(filter.userId) })}`);

  const remove = (userId: string, warningId: number, name: string) => confirm({
    title: 'Verwarnung entfernen',
    text: `Diese Verwarnung von ${name} wird gelöscht.`,
    confirmLabel: 'Entfernen',
    onConfirm: async () => { if (await run(`${base}/remove`, { userId, warningId }, 'Verwarnung entfernt.')) reload(); },
  });
  const clear = (userId: string, name: string) => confirm({
    title: 'Alle Verwarnungen löschen',
    text: `Alle Verwarnungen von ${name} werden gelöscht. Das kann nicht rückgängig gemacht werden.`,
    confirmLabel: 'Alle löschen',
    onConfirm: async () => { if (await run(`${base}/clear`, { userId }, 'Verwarnungen gelöscht.')) reload(); },
  });

  return (
    <Card icon="flag" title="Verwarnungen" description="Aktive Verwarnungen aus /mod warn. Neue Verwarnungen vergibst du in Discord.">
      <div className="grid-2 mb-4">
        <IdFilter label="Nutzer" value={filter.userId} onChange={(userId) => setFilter({ userId, page: 1 })} />
        {validId(filter.userId) && data?.warnings[0] && (
          <div className="self-center">
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
              <td className="text-right">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(w.userId, w.id, w.userName)}>Entfernen</button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {data && <Pager page={data.page} pages={pagesOf(data)} busy={loading} onPage={(page) => setFilter((prev) => ({ ...prev, page }))} />}
      {dialog}
    </Card>
  );
}

// ---------- User notes ----------

const NOTE_TYPES = Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => ({ value: value as NoteType, label }));

function NotesTab() {
  const { guild } = useGuild();
  const { run, busy } = useAction();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState({ userId: params.get('userId') ?? '', page: 1 });
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<{ userId: string; type: NoteType; content: string }>({ userId: '', type: 'neutral', content: '' });
  const base = `/guilds/${guild.id}/moderation/notes`;
  const { data, error, loading, reload } = useApi<NotesPage>(`${base}?${query({ ...filter, userId: validId(filter.userId) })}`);

  const add = async () => {
    if (await run(`${base}/add`, draft, 'Notiz hinzugefügt.')) {
      setDraft((prev) => ({ ...prev, content: '' }));
      reload();
    }
  };
  const remove = (userId: string, noteId: number) => confirm({
    title: 'Notiz löschen', text: 'Diese Notiz wird gelöscht.', confirmLabel: 'Löschen',
    onConfirm: async () => { if (await run(`${base}/remove`, { userId, noteId }, 'Notiz gelöscht.')) reload(); },
  });
  const clear = (userId: string, name: string) => confirm({
    title: 'Alle Notizen löschen', text: `Alle Notizen zu ${name} werden gelöscht. Das kann nicht rückgängig gemacht werden.`, confirmLabel: 'Alle löschen',
    onConfirm: async () => { if (await run(`${base}/clear`, { userId }, 'Notizen gelöscht.')) reload(); },
  });

  return (
    <>
      <Card icon="plus" title="Notiz hinzufügen" description="Interne Notiz für dein Team, wie /usernotes add. Der Nutzer sieht sie nicht.">
        <div className="stack">
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
        </div>
        <Actions>
          <button type="button" className="btn btn-primary" onClick={add}
            disabled={busy !== null || !ID_PATTERN.test(draft.userId) || !draft.content.trim()}>Notiz speichern</button>
        </Actions>
      </Card>

      <Card icon="clipboard" title="Nutzernotizen" description="Alle Notizen auf diesem Server, die neuesten zuerst.">
        <div className="grid-2 mb-4">
          <IdFilter label="Nutzer" value={filter.userId} onChange={(userId) => setFilter({ userId, page: 1 })} />
          {validId(filter.userId) && data?.notes[0] && (
            <div className="self-center">
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
                <td className="whitespace-pre-wrap">{note.content}</td>
                <td>{note.author}</td>
                <td className="faint">{formatDate(note.timestamp)}</td>
                <td className="text-right">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(note.userId, note.id)}>Löschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {data && <Pager page={data.page} pages={pagesOf(data)} busy={loading} onPage={(page) => setFilter((prev) => ({ ...prev, page }))} />}
        {dialog}
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
        Den Mod-Log-Kanal stellst du unter <Link to="../logging">Protokolle</Link> ein, Moderator- und Admin-Rolle
        unter <Link to="../general">Allgemein</Link>. Bannen, Kicken und Timeouts machst du direkt in Discord.
      </Notice>
      <div className="mt-4"><Tabs value={tab} onChange={setTab} items={TABS.map(({ id, label }) => ({ id, label }))} /></div>
      <Active />
    </>
  );
}
