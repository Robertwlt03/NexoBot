import { useState } from 'react';
import type {
  ApplicationEntry, ApplicationList, ApplicationRoleConfig, ApplicationSettingsDto, NewApplicationRole, ReviewResult,
} from '../../../src/web/dto/applications';
import {
  APPLICATION_NAME_MAX_LENGTH, MAX_QUESTIONS, QUESTION_MAX_LENGTH, REVIEW_REASON_MAX_LENGTH,
} from '../../../src/web/dto/applications';
import { api, useAction, useApi, useGuild, useSettings, useToast } from '../api';
import {
  Badge, Card, ChannelSelect, Empty, Field, Modal, MultiRoleSelect, Notice, NumberInput, PageHeader, RoleSelect,
  Select, SettingsPage, Spinner, Switch, SwitchRow, TextArea, TextInput,
} from '../components/ui';
import { Icon } from '../icons';

function QuestionsEditor({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {value.map((question, index) => (
        <div className="row" key={index} style={{ flexWrap: 'nowrap' }}>
          <span className="faint" style={{ width: 20 }}>{index + 1}.</span>
          <div style={{ flex: 1 }}>
            <TextInput value={question} maxLength={QUESTION_MAX_LENGTH} placeholder="Frage eingeben"
              onChange={(text) => onChange(value.map((q, i) => (i === index ? text : q)))} />
          </div>
          <button type="button" className="icon-btn" aria-label="Frage entfernen" disabled={value.length <= 1}
            onClick={() => onChange(value.filter((_, i) => i !== index))}><Icon name="trash" size={16} /></button>
        </div>
      ))}
      {value.length < MAX_QUESTIONS && (
        <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => onChange([...value, ''])}><Icon name="plus" size={16} />Frage hinzufügen</button></div>
      )}
      <span className="faint">1 bis {MAX_QUESTIONS} Fragen, je höchstens {QUESTION_MAX_LENGTH} Zeichen.</span>
    </div>
  );
}

function RoleEditor({ value, globalQuestions, onChange, onDelete, locked }: {
  value: ApplicationRoleConfig; globalQuestions: string[]; onChange: (value: ApplicationRoleConfig) => void; onDelete: () => void; locked: boolean;
}) {
  const { guild } = useGuild();
  const role = guild.roles.find((r) => r.id === value.roleId);
  const set = (patch: Partial<ApplicationRoleConfig>) => onChange({ ...value, ...patch });
  return (
    <div className="card" style={{ background: 'var(--bg-input)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="title" style={{ fontWeight: 600 }}>{value.name}</div>
          <span className="faint">{role ? `@${role.name}` : 'Rolle gelöscht'} · /apply submit application:{value.name}</span>
        </div>
        <div className="row">
          <Badge on={value.enabled}>{value.enabled ? 'Aktiv' : 'Aus'}</Badge>
          <Switch checked={value.enabled} onChange={(enabled) => set({ enabled })} label="Bewerbung aktiv" />
          <button type="button" className="icon-btn" aria-label="Bewerbung löschen" disabled={locked} onClick={onDelete}
            title={locked ? 'Speichere zuerst deine Änderungen.' : undefined}><Icon name="trash" size={18} /></button>
        </div>
      </div>
      {!role && <div style={{ marginTop: 12 }}><Notice tone="warn">Die Discord-Rolle existiert nicht mehr. Annehmen klappt erst, wenn du die Bewerbung neu anlegst.</Notice></div>}
      <div className="stack" style={{ marginTop: 14 }}>
        <Field label="Log-Kanal">
          <ChannelSelect value={value.logChannelId} onChange={(logChannelId) => set({ logChannelId })} placeholder="Globalen Log-Kanal nutzen" />
        </Field>
        <SwitchRow title="Eigene Fragen" description="Aus = diese Bewerbung nutzt die globalen Fragen."
          checked={value.questions !== null} onChange={(own) => set({ questions: own ? [...globalQuestions] : null })} />
        {value.questions && <QuestionsEditor value={value.questions} onChange={(questions) => set({ questions })} />}
      </div>
    </div>
  );
}

function CreateRoleModal({ globalQuestions, onClose, onCreated }: { globalQuestions: string[]; onClose: () => void; onCreated: () => void }) {
  const { guild } = useGuild();
  const { run, busy } = useAction();
  const [draft, setDraft] = useState<NewApplicationRole>({ roleId: '', name: '', questions: [...globalQuestions] });
  const create = async () => {
    const result = await run<ApplicationSettingsDto>(`/guilds/${guild.id}/applications/roles`, draft, `Bewerbung „${draft.name}“ erstellt.`);
    if (result) onCreated();
  };
  return (
    <Modal title="Neue Bewerbung" onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
          <button type="button" className="btn btn-primary" disabled={busy !== null || !draft.roleId || !draft.name.trim()} onClick={create}>Erstellen</button>
        </>
      )}>
      <Field label="Rolle" hint="Die Rolle, die Bewerber beim Annehmen bekommen.">
        <RoleSelect value={draft.roleId || null} assignableOnly onChange={(roleId) => setDraft({ ...draft, roleId: roleId ?? '' })} />
      </Field>
      <Field label="Name der Bewerbung" hint="z. B. Moderator, Helfer, Entwickler">
        <TextInput value={draft.name} maxLength={APPLICATION_NAME_MAX_LENGTH} onChange={(name) => setDraft({ ...draft, name })} />
      </Field>
      <Field label="Fragen">
        <QuestionsEditor value={draft.questions} onChange={(questions) => setDraft({ ...draft, questions })} />
      </Field>
      <span className="faint">Bewerbungen werden dabei automatisch aktiviert.</span>
    </Modal>
  );
}

const STATUS: Record<string, { label: string; tone: 'on' | 'off' | 'warn' }> = {
  pending: { label: 'Offen', tone: 'warn' },
  approved: { label: 'Angenommen', tone: 'on' },
  denied: { label: 'Abgelehnt', tone: 'off' },
};

function StatusBadge({ status }: { status: string }) {
  const entry = STATUS[status] ?? { label: status, tone: 'off' as const };
  return <span className={`badge badge-${entry.tone}`}>{entry.label}</span>;
}

function ReviewModal({ entry, approve, onClose, onDone }: { entry: ApplicationEntry; approve: boolean; onClose: () => void; onDone: () => void }) {
  const { guild } = useGuild();
  const toast = useToast();
  const { run, busy } = useAction();
  const [reason, setReason] = useState('');
  const submit = async () => {
    const result = await run<ReviewResult>(`/guilds/${guild.id}/applications/submissions/${entry.id}/review`, { action: approve ? 'approve' : 'deny', reason });
    if (!result) return;
    const notes = [
      !result.dmSent && 'Die DM an den Bewerber konnte nicht zugestellt werden.',
      result.roleAssigned === false && 'Die Rolle konnte nicht vergeben werden (ist das Mitglied noch auf dem Server?).',
    ].filter(Boolean);
    toast(`Bewerbung ${approve ? 'angenommen' : 'abgelehnt'}.${notes.length ? ` ${notes.join(' ')}` : ''}`, notes.length > 0);
    onDone();
  };
  return (
    <Modal title={`Bewerbung ${approve ? 'annehmen' : 'ablehnen'}`} onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Abbrechen</button>
          <button type="button" className={`btn ${approve ? 'btn-success' : 'btn-danger'}`} disabled={busy !== null} onClick={submit}>
            {approve ? 'Annehmen' : 'Ablehnen'}
          </button>
        </>
      )}>
      <p><strong>{entry.userName}</strong> · {entry.roleName}</p>
      <p className="muted">{approve ? 'Nexo vergibt die Rolle, schickt eine DM und aktualisiert den Log-Eintrag.' : 'Nexo schickt eine DM und aktualisiert den Log-Eintrag.'}</p>
      <Field label="Grund (optional)" hint="Steht in der DM an den Bewerber.">
        <TextArea value={reason} onChange={setReason} maxLength={REVIEW_REASON_MAX_LENGTH} rows={3} placeholder="Kein Grund angegeben." />
      </Field>
    </Modal>
  );
}

function Submissions() {
  const { guild } = useGuild();
  const [status, setStatus] = useState<'pending' | 'approved' | 'denied' | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const [review, setReview] = useState<{ entry: ApplicationEntry; approve: boolean } | null>(null);
  const list = useApi<ApplicationList>(`/guilds/${guild.id}/applications/submissions?status=${status}&page=${page}`);
  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Card icon="clipboard" title="Eingereichte Bewerbungen" description="Prüfe Bewerbungen und nimm sie an oder lehne sie ab."
      right={(
        <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[
          { value: 'pending', label: 'Offen' },
          { value: 'approved', label: 'Angenommen' },
          { value: 'denied', label: 'Abgelehnt' },
          { value: 'all', label: 'Alle' },
        ]} />
      )}>
      {!data && list.loading && <Spinner />}
      {list.error && !data && <Notice tone="danger">{list.error}</Notice>}
      {data && data.items.length === 0 && <Empty title="Keine Bewerbungen">Hier ist gerade nichts zu tun.</Empty>}
      {data && data.items.length > 0 && (
        <div className="list">
          {data.items.map((entry) => (
            <div key={entry.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div className="row" style={{ flexWrap: 'nowrap', cursor: 'pointer' }} onClick={() => setOpen(open === entry.id ? null : entry.id)}>
                {entry.avatarUrl && <img src={entry.avatarUrl} alt="" width={32} height={32} style={{ borderRadius: '50%' }} />}
                <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                  <div className="title">{entry.userName} · {entry.roleName}</div>
                  <span className="faint">{new Date(entry.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })} · ID {entry.id}</span>
                </div>
                <StatusBadge status={entry.status} />
              </div>
              {open === entry.id && (
                <div className="stack" style={{ marginTop: 12, gap: 10 }}>
                  {entry.answers.map((answer, index) => (
                    <div key={index}>
                      <div className="faint">{index + 1}. {answer.question}</div>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{answer.answer || '–'}</div>
                    </div>
                  ))}
                  {entry.status !== 'pending' && (
                    <span className="faint">
                      Geprüft{entry.reviewerName ? ` von ${entry.reviewerName}` : ''}
                      {entry.reviewedAt ? ` am ${new Date(entry.reviewedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                      {entry.reviewMessage ? ` · Grund: ${entry.reviewMessage}` : ''}
                    </span>
                  )}
                  {entry.status === 'pending' && (
                    <div className="row">
                      <button type="button" className="btn btn-success btn-sm" onClick={() => setReview({ entry, approve: true })}><Icon name="check" size={16} />Annehmen</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setReview({ entry, approve: false })}><Icon name="x" size={16} />Ablehnen</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {data && pages > 1 && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Zurück</button>
          <span className="faint">Seite {page} von {pages}</span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Weiter</button>
        </div>
      )}
      {review && <ReviewModal entry={review.entry} approve={review.approve} onClose={() => setReview(null)} onDone={() => { setReview(null); list.reload(); }} />}
    </Card>
  );
}

export default function ApplicationsPage() {
  const { guild } = useGuild();
  const toast = useToast();
  const settings = useSettings<ApplicationSettingsDto>('applications');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ApplicationRoleConfig | null>(null);
  const [busy, setBusy] = useState(false);

  const deleteRole = async (role: ApplicationRoleConfig) => {
    setBusy(true);
    try {
      const result = await api<{ deletedApplications: number }>(`/guilds/${guild.id}/applications/roles/${role.roleId}`, { method: 'DELETE' });
      toast(`Bewerbung „${role.name}“ gelöscht (${result.deletedApplications} gespeicherte Bewerbung${result.deletedApplications === 1 ? '' : 'en'}).`);
      settings.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader icon="clipboard" title="Bewerbungen" description="Team-Bewerbungen einrichten, Fragen festlegen und Bewerbungen prüfen." />
      <SettingsPage settings={settings}>
        {(value) => (
          <>
            <Card icon="settings" title="Allgemein">
              <div className="stack">
                <SwitchRow title="Bewerbungen aktiv" description="Wenn aus, kann sich niemand mit /apply bewerben."
                  checked={value.enabled} onChange={(enabled) => settings.set({ enabled })} />
                <div className="grid-2">
                  <Field label="Log-Kanal" hint="Neue Bewerbungen landen hier. Gilt auch für das Logging.">
                    <ChannelSelect value={value.logChannelId} onChange={(logChannelId) => settings.set({ logChannelId })} placeholder="Kein Log-Kanal" />
                  </Field>
                  <Field label="Manager-Rollen" hint="Dürfen /app-admin nutzen. „Server verwalten“ reicht immer.">
                    <MultiRoleSelect value={value.managerRoleIds} max={25} onChange={(managerRoleIds) => settings.set({ managerRoleIds })} />
                  </Field>
                  <Field label="Offene Bewerbungen aufbewahren (Tage)" hint="1 bis 3650. Danach werden sie automatisch gelöscht.">
                    <NumberInput value={value.pendingRetentionDays} min={1} max={3650} onChange={(pendingRetentionDays) => settings.set({ pendingRetentionDays })} />
                  </Field>
                  <Field label="Geprüfte Bewerbungen aufbewahren (Tage)" hint="1 bis 3650.">
                    <NumberInput value={value.reviewedRetentionDays} min={1} max={3650} onChange={(reviewedRetentionDays) => settings.set({ reviewedRetentionDays })} />
                  </Field>
                </div>
              </div>
            </Card>

            <Card icon="flag" title="Globale Fragen" description="Gelten für jede Bewerbung ohne eigene Fragen.">
              <QuestionsEditor value={value.questions} onChange={(questions) => settings.set({ questions })} />
            </Card>

            <Card icon="users" title="Bewerbungen" description="Rollen, auf die sich Mitglieder bewerben können."
              right={(
                <button type="button" className="btn btn-primary btn-sm" disabled={settings.dirty} onClick={() => setCreating(true)}
                  title={settings.dirty ? 'Speichere zuerst deine Änderungen.' : undefined}>
                  <Icon name="plus" size={16} />Neue Bewerbung
                </button>
              )}>
              {value.roles.length === 0 ? (
                <Empty title="Noch keine Bewerbungen">Leg eine an, damit sich Mitglieder mit /apply bewerben können.</Empty>
              ) : (
                <div className="stack">
                  {value.roles.map((role) => (
                    <RoleEditor key={role.roleId} value={role} globalQuestions={value.questions} locked={settings.dirty}
                      onDelete={() => setDeleting(role)}
                      onChange={(next) => settings.set({ roles: value.roles.map((r) => (r.roleId === next.roleId ? next : r)) })} />
                  ))}
                </div>
              )}
            </Card>

            {creating && (
              <CreateRoleModal globalQuestions={value.questions} onClose={() => setCreating(false)}
                onCreated={() => { setCreating(false); settings.reload(); }} />
            )}
          </>
        )}
      </SettingsPage>

      <Submissions />

      {deleting && (
        <Modal title="Bewerbung löschen?" onClose={() => setDeleting(null)}
          footer={(
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setDeleting(null)}>Abbrechen</button>
              <button type="button" className="btn btn-danger" disabled={busy} onClick={() => deleteRole(deleting)}>Endgültig löschen</button>
            </>
          )}>
          <p><strong>{deleting.name}</strong> wird mit allen Einstellungen und gespeicherten Bewerbungen gelöscht. Das lässt sich nicht rückgängig machen.</p>
          <p className="muted">Die Discord-Rolle selbst bleibt bestehen.</p>
        </Modal>
      )}
    </>
  );
}
