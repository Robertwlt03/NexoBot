import { useEffect, useState } from 'react';
import type { EconomyLeaderboard, EconomyMember, EconomyMoneyType, EconomySettings } from '../../../src/web/dto/economy';
import { ECONOMY_MAX_AMOUNT } from '../../../src/web/dto/economy';
import { api, useAction, useApi, useGuild, useSettings, useToast } from '../api';
import { Card, Field, Modal, Notice, NumberInput, PageHeader, RoleSelect, Select, SettingsPage } from '../components/ui';
import { Icon } from '../icons';
import { RankList, isUserId } from './rankingKit';

type Money = (amount: number) => string;

function MoneyTools({ initialId, money, onChanged }: { initialId: string; money: Money; onChanged: () => void }) {
  const { guild } = useGuild();
  const toast = useToast();
  const { run, busy } = useAction();
  const [userId, setUserId] = useState(initialId);
  const [member, setMember] = useState<EconomyMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [type, setType] = useState<EconomyMoneyType>('wallet');
  const [amount, setAmount] = useState(100);
  const [confirm, setConfirm] = useState(false);

  const load = async (id: string) => {
    if (!isUserId(id)) { toast('Bitte gib eine gültige Nutzer-ID ein.', true); return; }
    setLoading(true);
    try {
      setMember(await api<EconomyMember>(`/guilds/${guild.id}/economy/members/${id.trim()}`));
    } catch (err) {
      setMember(null);
      toast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (initialId) void load(initialId); }, []);

  const execute = async () => {
    setConfirm(false);
    if (!member) return;
    const result = await run<EconomyMember>(`/guilds/${guild.id}/economy/members/${member.userId}`, { action, type, amount },
      action === 'add' ? 'Geld hinzugefügt.' : 'Geld abgezogen.');
    if (result) { setMember(result); onChanged(); }
  };
  const amountValid = Number.isInteger(amount) && amount >= 1 && amount <= ECONOMY_MAX_AMOUNT;
  const where = type === 'wallet' ? 'Geldbörse' : 'Bank';

  return (
    <Card icon="users" title="Kontostand ändern" description="Gib Mitgliedern Geld oder zieh es ab – wie im /economy dashboard.">
      <div className="stack">
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
              <img src={member.avatarUrl ?? 'https://cdn.discordapp.com/embed/avatars/0.png'} alt="" width={40} height={40} style={{ borderRadius: '50%' }} />
              <div className="grow">
                <div className="title">{member.name}</div>
                <div className="faint">Geldbörse {money(member.wallet)} · Bank {money(member.bank)} / {money(member.maxBank)}</div>
              </div>
            </div>
            <div className="grid">
              <Field label="Aktion">
                <Select value={action} onChange={setAction} options={[{ value: 'add', label: 'Geld hinzufügen' }, { value: 'remove', label: 'Geld abziehen' }]} />
              </Field>
              <Field label="Konto">
                <Select value={type} onChange={setType} options={[{ value: 'wallet', label: 'Geldbörse' }, { value: 'bank', label: 'Bank' }]} />
              </Field>
              <Field label="Betrag" error={amountValid ? null : `Ganze Zahl zwischen 1 und ${ECONOMY_MAX_AMOUNT.toLocaleString('de-DE')}.`}>
                <NumberInput value={amount} min={1} max={ECONOMY_MAX_AMOUNT} onChange={setAmount} />
              </Field>
            </div>
            <div>
              <button type="button" className={`btn ${action === 'add' ? 'btn-primary' : 'btn-danger'}`} disabled={!amountValid || busy !== null}
                onClick={() => (action === 'add' ? void execute() : setConfirm(true))}>
                {action === 'add' ? 'Geld hinzufügen' : 'Geld abziehen'}
              </button>
            </div>
          </>
        )}
      </div>
      {confirm && member && (
        <Modal title="Geld abziehen?" onClose={() => setConfirm(false)} footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(false)}>Abbrechen</button>
            <button type="button" className="btn btn-danger" onClick={() => void execute()}>Abziehen</button>
          </>
        )}>
          <p className="muted">{member.name} werden {money(amount)} aus der {where} abgezogen.</p>
        </Modal>
      )}
    </Card>
  );
}

function Leaderboard({ version, money, onSelect }: { version: number; money: Money; onSelect: (userId: string) => void }) {
  const { guild } = useGuild();
  const [page, setPage] = useState(1);
  const board = useApi<EconomyLeaderboard>(`/guilds/${guild.id}/economy/leaderboard?page=${page}&v=${version}`);
  return (
    <Card icon="stats" title="Bestenliste" description="Die reichsten Mitglieder dieses Servers (Geldbörse + Bank). Kontostände gelten pro Server."
      right={<button type="button" className="btn btn-ghost btn-sm" onClick={board.reload}><Icon name="refresh" size={16} /> Aktualisieren</button>}>
      {board.data && board.data.total > 0 && (
        <p className="faint" style={{ marginBottom: 12 }}>
          {board.data.total.toLocaleString('de-DE')} Konten · {money(board.data.totalInCirculation)} im Umlauf
        </p>
      )}
      <RankList
        rows={board.data?.entries.map((entry) => ({
          ...entry,
          value: <strong>{money(entry.netWorth)}</strong>,
          detail: `Geldbörse ${money(entry.wallet)} · Bank ${money(entry.bank)}`,
        })) ?? null}
        loading={board.loading} error={board.error}
        emptyTitle="Noch keine Konten" emptyText="Sobald Mitglieder /eco nutzen, tauchen sie hier auf."
        page={board.data?.page} pages={board.data?.pages} onPage={setPage} onSelect={onSelect}
      />
    </Card>
  );
}

export default function EconomyPage() {
  const settings = useSettings<EconomySettings>('economy');
  const [selected, setSelected] = useState('');
  const [version, setVersion] = useState(0);

  return (
    <>
      <PageHeader icon="coins" title="Economy" description="Premium-Rolle für den Shop, Bestenliste und Kontostände deiner Mitglieder." />
      <SettingsPage settings={settings}>
        {(value) => {
          const money: Money = (amount) => `${value.currency.symbol}${amount.toLocaleString('de-DE')}`;
          return (
            <>
              <Card icon="gift" title="Premium-Rolle" description="Diese Rolle bekommt, wer im Shop das Item „Premium-Rolle“ kauft.">
                <Field label="Rolle" hint="Ohne Rolle kann das Item nicht gekauft werden. Nexos Rolle muss darüber stehen.">
                  <RoleSelect value={value.premiumRoleId} assignableOnly placeholder="Keine Premium-Rolle"
                    onChange={(premiumRoleId) => settings.set({ premiumRoleId })} />
                </Field>
              </Card>

              <Card icon="coins" title="Währung">
                <div className="grid-2">
                  <Field label="Name"><input className="input" value={value.currency.name} readOnly disabled /></Field>
                  <Field label="Symbol"><input className="input" value={value.currency.symbol} readOnly disabled /></Field>
                </div>
                <div style={{ marginTop: 14 }}>
                  <Notice>Die Währung gilt global für alle Server mit Nexo und kann nur vom Bot-Owner geändert werden.</Notice>
                </div>
              </Card>

              <Leaderboard version={version} money={money}
                onSelect={(userId) => { setSelected(userId); document.getElementById('eco-member-tools')?.scrollIntoView({ behavior: 'smooth' }); }} />
              <div id="eco-member-tools" style={{ marginTop: 16 }}>
                <MoneyTools key={selected} initialId={selected} money={money} onChanged={() => setVersion((v) => v + 1)} />
              </div>
            </>
          );
        }}
      </SettingsPage>
    </>
  );
}
