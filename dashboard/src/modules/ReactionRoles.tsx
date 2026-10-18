import { useState } from 'react';
import type { CreateReactionRolePanel, ReactionRolePanel, ReactionRolesData } from '../../../src/web/dto/reactionroles';
import { DESCRIPTION_MAX, MAX_PANELS, MAX_ROLES, TITLE_MAX } from '../../../src/web/dto/reactionroles';
import { api, useApi, useGuild, useToast } from '../api';
import {
  Badge, Card, ChannelSelect, Empty, Field, MessagePreview, Modal, MultiRoleSelect, Notice, PageHeader, RoleSelect,
  Spinner, TextArea, TextInput,
} from '../components/ui';
import { Icon } from '../icons';

const STATUS: Record<ReactionRolePanel['status'], { text: string; on: boolean }> = {
  ok: { text: 'Aktiv', on: true },
  deleted: { text: 'Nachricht gelöscht', on: false },
  channel_missing: { text: 'Kanal fehlt', on: false },
};

interface Confirm { title: string; text: string; danger: string; run: () => Promise<void> }

function PanelEditor({ initial, onCancel, onSave, busy, withRoles }: {
  initial: CreateReactionRolePanel; onCancel: () => void; onSave: (value: CreateReactionRolePanel) => void; busy: boolean; withRoles: boolean;
}) {
  const [value, setValue] = useState(initial);
  const { guild } = useGuild();
  const set = (patch: Partial<CreateReactionRolePanel>) => setValue({ ...value, ...patch });
  const roleNames = value.roleIds.map((id) => `• @${guild.roles.find((r) => r.id === id)?.name ?? 'Rolle'}`).join('\n');
  return (
    <Modal title={withRoles ? 'Panel erstellen' : 'Panel-Text bearbeiten'} onClose={onCancel} footer={(
      <>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Abbrechen</button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSave(value)}>{withRoles ? 'Panel posten' : 'Speichern'}</button>
      </>
    )}>
      {withRoles && (
        <Field label="Kanal"><ChannelSelect value={value.channelId} onChange={(channelId) => set({ channelId: channelId ?? '' })} /></Field>
      )}
      <Field label="Titel"><TextInput value={value.title} onChange={(title) => set({ title })} maxLength={TITLE_MAX} /></Field>
      <Field label="Beschreibung"><TextArea value={value.description} onChange={(description) => set({ description })} maxLength={DESCRIPTION_MAX} /></Field>
      {withRoles && (
        <div className="field">
          <span className="field-label">Rollen ({value.roleIds.length}/{MAX_ROLES})</span>
          <MultiRoleSelect value={value.roleIds} onChange={(roleIds) => set({ roleIds })} assignableOnly max={MAX_ROLES} />
          <span className="field-hint">Im Menü steht der Rollenname, jede Option bekommt das Emoji 🎭.</span>
        </div>
      )}
      {withRoles && (
        <MessagePreview sample={{}} embed={{ title: value.title, description: `${value.description}\n\nVerfügbare Rollen\n${roleNames}`, color: '#5865F2', footer: 'Wähle deine Rollen im Dropdown-Menü unten' }} />
      )}
    </Modal>
  );
}

function PanelCard({ panel, busy, onAddRole, onRemoveRole, onEdit, onRepost, onDelete }: {
  panel: ReactionRolePanel; busy: boolean;
  onAddRole: (roleId: string) => void; onRemoveRole: (roleId: string) => void;
  onEdit: () => void; onRepost: () => void; onDelete: () => void;
}) {
  const { guild } = useGuild();
  const channel = guild.channels.find((c) => c.id === panel.channelId);
  const roles = new Map(guild.roles.map((r) => [r.id, r]));
  const status = STATUS[panel.status];
  const editable = !panel.legacy;
  return (
    <Card icon="reaction" title={panel.title || 'Panel ohne Titel'}
      description={channel ? `#${channel.name}` : 'Kanal nicht gefunden'}
      right={<Badge on={status.on}>{status.text}</Badge>}>
      <div className="stack">
        {panel.legacy && <Notice>Altes Reaktions-Panel (Emojis). Du kannst es hier nur löschen.</Notice>}
        {panel.description && <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{panel.description}</p>}
        <div className="field">
          <span className="field-label">Rollen ({panel.roleIds.length}/{MAX_ROLES})</span>
          <div className="chips">
            {panel.roleIds.map((id) => {
              const role = roles.get(id);
              return (
                <span className="chip" key={id}>
                  <span className="dot" style={{ background: role && role.color !== '#000000' ? role.color : '#99aab5' }} />
                  {role ? role.name : 'Unbekannte Rolle'}
                  {editable && <button type="button" aria-label="Entfernen" disabled={busy} onClick={() => onRemoveRole(id)}>×</button>}
                </span>
              );
            })}
          </div>
        </div>
        {editable && panel.roleIds.length < MAX_ROLES && (
          <RoleSelect value={null} assignableOnly placeholder="Rolle hinzufügen" onChange={(id) => id && onAddRole(id)} />
        )}
        <div className="row">
          {panel.url && (
            <a className="btn btn-ghost btn-sm" href={panel.url} target="_blank" rel="noreferrer"><Icon name="external" size={14} />Nachricht öffnen</a>
          )}
          <div className="row" style={{ marginLeft: 'auto' }}>
            {editable && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy || panel.status !== 'ok'} onClick={onEdit}>Text bearbeiten</button>
            )}
            {editable && (
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy || panel.status === 'channel_missing'} onClick={onRepost}>
                <Icon name="refresh" size={14} />Neu posten
              </button>
            )}
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={onDelete}><Icon name="trash" size={14} />Löschen</button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ReactionRolesPage() {
  const { guild } = useGuild();
  const toast = useToast();
  const base = `/guilds/${guild.id}/reactionroles`;
  const { data, setData, error, loading } = useApi<ReactionRolesData>(base);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ReactionRolePanel | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const mutate = async (method: string, path: string, body: unknown, success: string): Promise<boolean> => {
    setBusy(true);
    try {
      setData(await api<ReactionRolesData>(`${base}${path}`, { method, body }));
      toast(success);
      return true;
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const panels = data?.panels ?? [];
  const full = panels.length >= MAX_PANELS;

  return (
    <>
      <PageHeader icon="reaction" title="Reaktionsrollen" description="Mitglieder wählen sich Rollen selbst über ein Dropdown-Menü aus."
        actions={(
          <button type="button" className="btn btn-primary" disabled={!data || full} onClick={() => setCreating(true)}
            title={full ? `Maximal ${MAX_PANELS} Panels pro Server.` : undefined}>
            <Icon name="plus" size={16} />Panel erstellen
          </button>
        )} />

      {loading && !data && <Spinner />}
      {error && !data && <Notice tone="danger">{error}</Notice>}
      {data && (
        <div className="stack">
          <span className="faint">{panels.length}/{MAX_PANELS} Panels · bis zu {MAX_ROLES} Rollen pro Panel</span>
          {panels.length === 0 && (
            <Card><Empty title="Noch keine Panels">Erstelle ein Panel, damit sich Mitglieder ihre Rollen selbst geben können.</Empty></Card>
          )}
          {panels.map((panel) => (
            <PanelCard key={panel.messageId} panel={panel} busy={busy}
              onAddRole={(roleId) => void mutate('POST', `/${panel.messageId}/roles`, { roleId }, 'Rolle hinzugefügt.')}
              onRemoveRole={(roleId) => {
                const last = panel.roleIds.length === 1;
                const name = guild.roles.find((r) => r.id === roleId)?.name ?? 'diese Rolle';
                setConfirm({
                  title: 'Rolle entfernen',
                  text: last
                    ? `@${name} ist die letzte Rolle im Panel. Wenn du sie entfernst, wird das ganze Panel samt Nachricht gelöscht.`
                    : `@${name} aus dem Panel entfernen? Mitglieder behalten die Rolle, können sie aber nicht mehr selbst wählen.`,
                  danger: last ? 'Rolle und Panel löschen' : 'Entfernen',
                  run: async () => {
                    await mutate('DELETE', `/${panel.messageId}/roles/${roleId}`, undefined,
                      last ? 'Das war die letzte Rolle im Panel. Das Panel wurde gelöscht.' : 'Rolle entfernt.');
                  },
                });
              }}
              onEdit={() => setEditing(panel)}
              onRepost={() => void mutate('POST', `/${panel.messageId}/repost`, {}, 'Panel erneut gepostet.')}
              onDelete={() => setConfirm({
                title: 'Panel löschen',
                text: `Du bist dabei, das Panel „${panel.title || 'Panel ohne Titel'}“ dauerhaft zu löschen. Dabei werden die Discord-Nachricht und alle zugehörigen Reaktionsrollen-Zuweisungen entfernt.`,
                danger: 'Endgültig löschen',
                run: async () => { await mutate('DELETE', `/${panel.messageId}`, undefined, 'Panel gelöscht.'); },
              })}
            />
          ))}
        </div>
      )}

      {creating && (
        <PanelEditor withRoles busy={busy} initial={{ channelId: '', title: '', description: '', roleIds: [] }}
          onCancel={() => setCreating(false)}
          onSave={async (value) => { if (await mutate('POST', '', value, 'Panel erstellt.')) setCreating(false); }} />
      )}
      {editing && (
        <PanelEditor withRoles={false} busy={busy}
          initial={{ channelId: editing.channelId, title: editing.title, description: editing.description, roleIds: editing.roleIds }}
          onCancel={() => setEditing(null)}
          onSave={async (value) => {
            if (await mutate('PATCH', `/${editing.messageId}`, { title: value.title, description: value.description }, 'Titel und Beschreibung wurden aktualisiert.')) setEditing(null);
          }} />
      )}
      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)} footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>Abbrechen</button>
            <button type="button" className="btn btn-danger" disabled={busy}
              onClick={async () => { await confirm.run(); setConfirm(null); }}>{confirm.danger}</button>
          </>
        )}>
          <p>{confirm.text}</p>
        </Modal>
      )}
    </>
  );
}
