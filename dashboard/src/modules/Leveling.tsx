import { useEffect, useState } from 'react';
import type {
  LevelingLeaderboard, LevelingMember, LevelingMemberAction, LevelingSettings, LevelRoleReward, LevelRoleSyncResult,
} from '../../../src/web/dto/leveling';
import { LEVEL_UP_PLACEHOLDERS, LEVELING_LEADERBOARD_MAX, LEVELING_MAX_LEVEL } from '../../../src/web/dto/leveling';
import { api, useAction, useApi, useGuild, useSettings, useToast, useUser } from '../api';
import {
  Actions, Card, ChannelSelect, Field, MessagePreview, MultiChannelSelect, MultiRoleSelect, Notice, NumberInput, PageHeader,
  RoleSelect, Select, SettingsPage, SwitchRow, TextArea,
} from '../components/ui';
import { useConfirm } from '../components/ConfirmDialog';
import { Icon } from '../icons';
import { RankList, isUserId } from './rankingKit';

function RewardsEditor({ value, onChange }: { value: LevelRoleReward[]; onChange: (value: LevelRoleReward[]) => void }) {
  const update = (index: number, patch: Partial<LevelRoleReward>) => onChange(value.map((reward, i) => (i === index ? { ...reward, ...patch } : reward)));
  const nextLevel = Math.min(500, (value.reduce((max, reward) => Math.max(max, reward.level || 0), 0)) + 5);
  return (
    <>
      <div className="stack">
        {value.length === 0 && <p className="faint">Noch keine Rollen-Belohnungen.</p>}
        {value.map((reward, index) => (
          // On phones the role select takes its own line, so the role name stays readable.
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2" key={index}>
            <span className="faint whitespace-nowrap">Ab Level</span>
            <div className="w-[110px] shrink-0">
              <NumberInput value={reward.level} min={1} max={500} onChange={(level) => update(index, { level })} />
            </div>
            <div className="min-w-0 flex-[1_1_200px]">
              <RoleSelect value={reward.roleId} assignableOnly onChange={(roleId) => update(index, { roleId: roleId ?? '' })} />
            </div>
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Belohnung entfernen" onClick={() => onChange(value.filter((_, i) => i !== index))}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
      </div>
      <Actions align="start">
        <button type="button" className="btn btn-secondary btn-sm" disabled={value.length >= 100}
          onClick={() => onChange([...value, { level: nextLevel, roleId: '' }])}>
          <Icon name="plus" size={16} /> Belohnung hinzufügen
        </button>
      </Actions>
    </>
  );
}

const ACTIONS: { value: LevelingMemberAction; label: string }[] = [
  { value: 'add', label: 'Level hinzufügen' },
  { value: 'remove', label: 'Level abziehen' },
  { value: 'set', label: 'Level setzen' },
];

function MemberTools({ initialId, disabled, onChanged }: { initialId: string; disabled: boolean; onChanged: () => void }) {
  const { guild } = useGuild();
  const toast = useToast();
  const { run, busy } = useAction();
  const [userId, setUserId] = useState(initialId);
  const [member, setMember] = useState<LevelingMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<LevelingMemberAction>('add');
  const [amount, setAmount] = useState(1);
  const { confirm, dialog } = useConfirm();

  const load = async (id: string) => {
    if (!isUserId(id)) { toast('Bitte gib eine gültige Nutzer-ID ein.', true); return; }
    setLoading(true);
    try {
      setMember(await api<LevelingMember>(`/guilds/${guild.id}/leveling/members/${id.trim()}`));
    } catch (err) {
      setMember(null);
      toast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (initialId) void load(initialId); }, []);

  const execute = async () => {
    if (!member) return;
    const result = await run<LevelingMember>(`/guilds/${guild.id}/leveling/members/${member.userId}`, { action, amount }, 'Level aktualisiert.');
    if (result) { setMember(result); onChanged(); }
  };
  const min = action === 'set' ? 0 : 1;
  const amountValid = Number.isInteger(amount) && amount >= min && amount <= LEVELING_MAX_LEVEL;
  const summary = action === 'set'
    ? `Das Level von ${member?.name} wird auf ${amount} gesetzt. Die XP im aktuellen Level werden auf 0 gesetzt.`
    : action === 'remove' ? `${member?.name} werden ${amount} Level abgezogen.` : '';

  return (
    <Card icon="users" title="Mitglied bearbeiten" description="Setze Level oder gib/zieh Level ab – wie /levelset, /leveladd und /levelremove.">
      <div className="stack">
        {disabled && <Notice tone="warn">Das Leveling ist deaktiviert. Level lassen sich erst ändern, wenn es aktiv und gespeichert ist.</Notice>}
        <Field label="Nutzer-ID" hint="Rechtsklick auf ein Mitglied → „Nutzer-ID kopieren“ (Entwicklermodus) oder in der Bestenliste auf „Bearbeiten“ klicken.">
          <div className="input-group">
            <input className="input" value={userId} placeholder="z. B. 123456789012345678" onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void load(userId); } }} />
            <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => void load(userId)}>{loading ? 'Lädt …' : 'Laden'}</button>
          </div>
        </Field>
        {member && (
          <>
            <div className="list-item">
              <img src={member.avatarUrl ?? 'https://cdn.discordapp.com/embed/avatars/0.png'} alt="" className="h-8 w-8 rounded-full" />
              <div className="grow">
                <div className="title">{member.name}</div>
                <div className="faint">Level {member.level} · {member.xp.toLocaleString('de-DE')} XP im Level · {member.totalXp.toLocaleString('de-DE')} XP gesamt</div>
              </div>
            </div>
            <div className="grid-2">
              <Field label="Aktion"><Select value={action} onChange={setAction} options={ACTIONS} /></Field>
              <Field label={action === 'set' ? 'Neues Level' : 'Anzahl Level'} error={amountValid ? null : `Zahl zwischen ${min} und ${LEVELING_MAX_LEVEL}.`}>
                <NumberInput value={amount} min={min} max={LEVELING_MAX_LEVEL} onChange={setAmount} />
              </Field>
            </div>
          </>
        )}
      </div>
      {member && (
        <Actions>
          <button type="button" className={`btn ${action === 'add' ? 'btn-primary' : 'btn-danger'}`} disabled={!amountValid || busy !== null || disabled}
            onClick={() => (action === 'add' ? void execute() : confirm({
              title: 'Bist du sicher?', confirmLabel: 'Bestätigen',
              text: `${summary} Das lässt sich nicht automatisch rückgängig machen.`,
              onConfirm: execute,
            }))}>
            {ACTIONS.find((a) => a.value === action)?.label}
          </button>
        </Actions>
      )}
      {dialog}
    </Card>
  );
}

function Leaderboard({ version, onSelect }: { version: number; onSelect: (userId: string) => void }) {
  const { guild } = useGuild();
  const [page, setPage] = useState(1);
  const board = useApi<LevelingLeaderboard>(`/guilds/${guild.id}/leveling/leaderboard?page=${page}&v=${version}`);
  return (
    <Card icon="stats" title="Bestenliste" description={`Die aktivsten Mitglieder nach Gesamt-XP (Top ${LEVELING_LEADERBOARD_MAX}).`}
      right={<button type="button" className="btn btn-secondary btn-sm" onClick={board.reload}><Icon name="refresh" size={16} /> Aktualisieren</button>}>
      <RankList
        rows={board.data?.entries.map((entry) => ({
          ...entry,
          value: <strong>Level {entry.level}</strong>,
          detail: `${entry.totalXp.toLocaleString('de-DE')} XP`,
        })) ?? null}
        loading={board.loading} error={board.error}
        emptyTitle="Noch keine Level-Daten" emptyText="Sobald Mitglieder schreiben, sammeln sie XP."
        page={board.data?.page} pages={board.data?.pages} onPage={setPage} onSelect={onSelect}
      />
    </Card>
  );
}

export default function LevelingPage() {
  const settings = useSettings<LevelingSettings>('leveling');
  const { guild } = useGuild();
  const user = useUser();
  const toast = useToast();
  const { run, busy } = useAction();
  const [selected, setSelected] = useState('');
  const [version, setVersion] = useState(0);
  const name = user?.globalName ?? user?.username ?? 'Nexo-Fan';

  const syncRoles = async () => {
    const result = await run<LevelRoleSyncResult>(`/guilds/${guild.id}/leveling/actions/sync-roles`);
    if (!result) return;
    toast(`Synchronisiert: ${result.rolesReAwarded} Rolle(n) vergeben${result.prunedRewardEntries ? `, ${result.prunedRewardEntries} gelöschte Rolle(n) aus den Belohnungen entfernt` : ''}${result.errors ? `, ${result.errors} Fehler` : ''}.`, result.errors > 0);
    if (result.prunedRewardEntries) settings.reload();
  };

  return (
    <>
      <PageHeader icon="level" title="Leveling" description="Mitglieder sammeln XP fürs Schreiben, steigen im Level auf und bekommen Rollen als Belohnung." />
      <SettingsPage settings={settings}>
        {(value) => (
          <>
            <Card>
              <SwitchRow title="Leveling aktiv" description="Wenn aus, bekommt niemand XP und Level lassen sich nicht ändern."
                checked={value.enabled} onChange={(enabled) => settings.set({ enabled })} />
            </Card>

            <Card icon="settings" title="XP-Vergabe" description="Pro Nachricht gibt es eine zufällige Menge XP im gewählten Bereich." disabled={!value.enabled}>
              <div className="auto-grid">
                <Field label="Minimale XP" error={value.xpMin > value.xpMax ? 'Darf nicht größer als die maximalen XP sein.' : null}>
                  <NumberInput value={value.xpMin} min={1} max={500} onChange={(xpMin) => settings.set({ xpMin })} />
                </Field>
                <Field label="Maximale XP">
                  <NumberInput value={value.xpMax} min={1} max={500} onChange={(xpMax) => settings.set({ xpMax })} />
                </Field>
                <Field label="Cooldown (Sekunden)" hint="Wartezeit pro Mitglied zwischen zwei XP-Vergaben (0–3600).">
                  <NumberInput value={value.cooldownSeconds} min={0} max={3600} onChange={(cooldownSeconds) => settings.set({ cooldownSeconds })} />
                </Field>
              </div>
            </Card>

            <Card icon="send" title="Level-up-Nachricht" description="Wird gesendet, wenn jemand ein neues Level erreicht." disabled={!value.enabled}>
              <div className="grid-2">
                <div className="stack">
                  <SwitchRow title="Level-ups ankündigen" checked={value.announceLevelUp} onChange={(announceLevelUp) => settings.set({ announceLevelUp })} />
                  <Field label="Kanal" hint="Leer lassen = Systemkanal des Servers.">
                    <ChannelSelect value={value.levelUpChannelId} placeholder="Systemkanal" onChange={(levelUpChannelId) => settings.set({ levelUpChannelId })} />
                  </Field>
                  <Field label="Nachricht" hint="Klick auf einen Platzhalter, um ihn einzufügen.">
                    <TextArea value={value.levelUpMessage} maxLength={500} variables={LEVEL_UP_PLACEHOLDERS}
                      onChange={(levelUpMessage) => settings.set({ levelUpMessage })} />
                  </Field>
                </div>
                <div className="stack">
                  <span className="field-label">Vorschau</span>
                  <MessagePreview content={value.levelUpMessage}
                    sample={{ '{user}': `@${name}`, '{level}': '5', '{xp}': '0', '{xpNeeded}': '530' }} />
                </div>
              </div>
            </Card>

            <Card icon="gift" title="Rollen-Belohnungen" description="Diese Rollen bekommt man beim Erreichen des Levels. Nexos Rolle muss darüber stehen."
              disabled={!value.enabled}
              right={(
                <button type="button" className="btn btn-secondary btn-sm" disabled={settings.dirty || busy !== null || value.roleRewards.length === 0}
                  title={settings.dirty ? 'Speichere zuerst deine Änderungen.' : 'Vergibt fehlende Belohnungsrollen an alle Mitglieder mit genug Level.'}
                  onClick={() => void syncRoles()}>
                  <Icon name="refresh" size={16} /> Rollen synchronisieren
                </button>
              )}>
              <RewardsEditor value={value.roleRewards} onChange={(roleRewards) => settings.set({ roleRewards })} />
            </Card>

            <Card icon="x" title="Ausnahmen" description="Hier gibt es keine XP." disabled={!value.enabled}>
              <div className="grid-2">
                <Field label="Ignorierte Kanäle">
                  <MultiChannelSelect value={value.ignoredChannels} onChange={(ignoredChannels) => settings.set({ ignoredChannels })} />
                </Field>
                <Field label="Ignorierte Rollen" hint="Mitglieder mit einer dieser Rollen bekommen keine XP.">
                  <MultiRoleSelect value={value.ignoredRoles} onChange={(ignoredRoles) => settings.set({ ignoredRoles })} />
                </Field>
              </div>
            </Card>

            <Leaderboard version={version} onSelect={(userId) => { setSelected(userId); document.getElementById('level-member-tools')?.scrollIntoView({ behavior: 'smooth' }); }} />
            <div id="level-member-tools" className="mt-4">
              <MemberTools key={selected} initialId={selected} disabled={!value.enabled}
                onChanged={() => setVersion((v) => v + 1)} />
            </div>
          </>
        )}
      </SettingsPage>
    </>
  );
}
