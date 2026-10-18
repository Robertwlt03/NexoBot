import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CountingStatus } from '../../../src/web/dto/counting';
import { COUNTING_LEADERBOARD_LIMIT, COUNTING_MAX_START } from '../../../src/web/dto/counting';
import { useAction, useApi, useGuild } from '../api';
import { Badge, Card, ChannelSelect, Field, Modal, Notice, NumberInput, PageHeader, Select, Spinner } from '../components/ui';
import { RankList } from './rankingKit';

type Confirm = 'activate' | 'reset' | null;

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="field-label">{label}</div>
      <div style={{ color: 'var(--text-strong)', fontWeight: 600, marginTop: 4 }}>{children}</div>
    </div>
  );
}

export default function CountingPage() {
  const { guild } = useGuild();
  const path = `/guilds/${guild.id}/counting`;
  const status = useApi<CountingStatus>(path);
  const { run, busy } = useAction();
  const [channelId, setChannelId] = useState<string | null>(null);
  const [system, setSystem] = useState<string | null>(null);
  const [start, setStart] = useState(1);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const header = <PageHeader icon="hash" title="Zählspiel" description="Mitglieder zählen gemeinsam hoch – wer sich verzählt oder zweimal hintereinander zählt, setzt alles auf 1 zurück." />;
  if (!status.data) return <>{header}{status.error ? <Notice tone="danger">{status.error}</Notice> : <Spinner />}</>;
  const value = status.data;
  const channelName = (id: string | null) => (id ? `#${guild.channels.find((c) => c.id === id)?.name ?? id}` : 'Nicht eingerichtet');
  const targetChannel = channelId ?? value.channelId;
  const targetSystem = system ?? value.system;

  const act = async (action: 'activate' | 'disable' | 'reset', body: unknown, success: string) => {
    setConfirm(null);
    const result = await run<CountingStatus>(`${path}/actions/${action}`, body, success);
    if (result) { status.setData(result); setChannelId(null); setSystem(null); }
  };
  const activate = () => act('activate', { channelId: targetChannel, system: targetSystem }, 'Zählspiel gestartet.');
  const startValid = Number.isInteger(start) && start >= 1 && start <= COUNTING_MAX_START;

  return (
    <>
      {header}
      <Card icon="stats" title="Status" right={<Badge on={value.enabled}>{value.enabled ? 'Aktiv' : 'Aus'}</Badge>}>
        <div className="grid">
          <Stat label="Kanal">{channelName(value.channelId)}</Stat>
          <Stat label="Zahlensystem">{value.systemLabel}</Stat>
          <Stat label="Nächste Zahl">{value.expected}{value.expected !== String(value.nextNumber) && <span className="faint"> ({value.nextNumber})</span>}</Stat>
          <Stat label="Aktuelle Serie">{value.currentStreak.toLocaleString('de-DE')}</Stat>
          <Stat label="Beste Serie">{value.bestStreak.toLocaleString('de-DE')}</Stat>
          <Stat label="Zuletzt gezählt von">{value.lastUserName ?? 'Niemand'}</Stat>
        </div>
      </Card>

      <Card icon="settings" title={value.enabled ? 'Kanal oder System ändern' : 'Zählspiel starten'}
        description="Startet das Spiel neu bei 1 – wie /count setup. Pro Server ist ein Zählkanal möglich.">
        <div className="grid-2">
          <Field label="Kanal" hint="Nexo braucht dort „Nachrichten verwalten“, um falsche Zahlen zu löschen.">
            <ChannelSelect value={targetChannel} onChange={setChannelId} />
          </Field>
          <Field label="Zahlensystem">
            <Select value={targetSystem} onChange={setSystem} options={value.systems} />
          </Field>
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" disabled={!targetChannel || busy !== null}
            onClick={() => (value.enabled || value.players > 0 ? setConfirm('activate') : void activate())}>
            {value.enabled ? 'Neu starten' : 'Starten'}
          </button>
          {value.enabled && (
            <button type="button" className="btn btn-secondary" disabled={busy !== null}
              onClick={() => void act('disable', {}, 'Zählspiel deaktiviert.')}>Deaktivieren</button>
          )}
        </div>
      </Card>

      <Card icon="refresh" title="Zählfolge zurücksetzen" description="Setzt die nächste Zahl und die aktuelle Serie zurück – wie /count reset. Bestenliste und beste Serie bleiben."
        disabled={!value.enabled}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ width: 200 }}>
            <Field label="Weiter bei" error={startValid ? null : `Zahl zwischen 1 und ${COUNTING_MAX_START.toLocaleString('de-DE')}.`}>
              <NumberInput value={start} min={1} max={COUNTING_MAX_START} onChange={setStart} />
            </Field>
          </div>
          <button type="button" className="btn btn-danger" disabled={!startValid || busy !== null} onClick={() => setConfirm('reset')}>Zurücksetzen</button>
        </div>
      </Card>

      <Card icon="users" title="Bestenliste" description={`Wer am meisten richtig gezählt hat (Top ${COUNTING_LEADERBOARD_LIMIT}${value.players > COUNTING_LEADERBOARD_LIMIT ? ` von ${value.players}` : ''}).`}>
        <RankList
          rows={value.leaderboard.map((entry) => ({ ...entry, value: <strong>{entry.count.toLocaleString('de-DE')} {entry.count === 1 ? 'Zahl' : 'Zahlen'}</strong> }))}
          loading={status.loading} error={status.error}
          emptyTitle="Bisher wurde noch nicht gezählt" />
      </Card>

      {confirm && (
        <Modal title={confirm === 'reset' ? 'Zählfolge zurücksetzen?' : 'Zählspiel neu starten?'} onClose={() => setConfirm(null)} footer={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>Abbrechen</button>
            <button type="button" className="btn btn-danger"
              onClick={() => void (confirm === 'reset' ? act('reset', { start }, 'Zählfolge zurückgesetzt.') : activate())}>
              {confirm === 'reset' ? 'Zurücksetzen' : 'Neu starten'}
            </button>
          </>
        )}>
          <p className="muted">
            {confirm === 'reset'
              ? `In ${channelName(value.channelId)} geht es wieder bei ${start} los.`
              : `Das Spiel startet in ${channelName(targetChannel)} bei 1. Aktuelle Zahl, Serien und die komplette Bestenliste werden gelöscht.`}
          </p>
        </Modal>
      )}
    </>
  );
}
