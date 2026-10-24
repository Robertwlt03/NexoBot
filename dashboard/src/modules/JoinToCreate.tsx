import { useState } from 'react';
import type { JoinToCreateCreate, JoinToCreateState, JoinToCreateTrigger, JoinToCreateTriggerSettings } from '../../../src/web/dto/jointocreate';
import { JTC_DEFAULTS, JTC_PLACEHOLDERS } from '../../../src/web/dto/jointocreate';
import { api, useAction, useApi, useGuild, useToast } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { Actions, Card, ChannelSelect, Field, Notice, NumberInput, PageHeader, Spinner, TextArea } from '../components/ui';
import { Icon } from '../icons';

function SettingsFields({ value, onChange }: { value: JoinToCreateTriggerSettings; onChange: (value: JoinToCreateTriggerSettings) => void }) {
  return (
    <>
      <Field label="Namensvorlage" hint="Name der temporären Kanäle. Keine @, #, : oder Backticks.">
        <TextArea value={value.nameTemplate} onChange={(nameTemplate) => onChange({ ...value, nameTemplate })} maxLength={100} rows={1} variables={JTC_PLACEHOLDERS} />
      </Field>
      <div className="grid-2">
        <Field label="Nutzerlimit" hint="0 = unbegrenzt, höchstens 99.">
          <NumberInput value={value.userLimit} min={0} max={99} onChange={(userLimit) => onChange({ ...value, userLimit })} />
        </Field>
        <Field label="Bitrate (kbps)" hint="8–384. Mehr als 96 braucht Server-Boosts.">
          <NumberInput value={value.bitrateKbps} min={8} max={384} onChange={(bitrateKbps) => onChange({ ...value, bitrateKbps })} />
        </Field>
      </div>
    </>
  );
}

function TriggerCard({ trigger, onChanged }: { trigger: JoinToCreateTrigger; onChanged: (state: JoinToCreateState) => void }) {
  const { guild } = useGuild();
  const toast = useToast();
  const { run, busy } = useAction();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<JoinToCreateTriggerSettings>({ nameTemplate: trigger.nameTemplate, userLimit: trigger.userLimit, bitrateKbps: trigger.bitrateKbps });
  const [saving, setSaving] = useState(false);
  const channel = guild.channels.find((c) => c.id === trigger.channelId);
  const category = guild.channels.find((c) => c.id === trigger.categoryId);
  const dirty = draft.nameTemplate !== trigger.nameTemplate || draft.userLimit !== trigger.userLimit || draft.bitrateKbps !== trigger.bitrateKbps;
  const path = `/guilds/${guild.id}/jointocreate/${trigger.channelId}`;

  const save = async () => {
    setSaving(true);
    try {
      onChanged(await api<JoinToCreateState>(path, { method: 'PUT', body: draft }));
      toast('Änderungen gespeichert.');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      icon="mic"
      title={channel ? `🔊 ${channel.name}` : 'Gelöschter Kanal'}
      description={`Wer diesem Kanal beitritt, bekommt einen eigenen Sprachkanal${category ? ` in ${category.name.toUpperCase()}` : ''}.`}
      right={(
        <button type="button" className="btn btn-danger btn-sm" disabled={busy !== null}
          onClick={() => confirm({
            title: 'Join-to-Create entfernen?', confirmLabel: 'Entfernen',
            text: <>Der Kanal wird aus dem Join-to-Create-System entfernt{channel ? ' und gelöscht, wenn gerade niemand darin ist' : ''}. Das kann nicht rückgängig gemacht werden.</>,
            onConfirm: async () => {
              const state = await run<JoinToCreateState>(`${path}/delete`, {}, 'Join-to-Create entfernt.');
              if (state) onChanged(state);
            },
          })}>
          <Icon name="trash" size={14} />Entfernen
        </button>
      )}
    >
      {!trigger.exists ? (
        <Notice tone="warn">Der Auslöser-Kanal existiert nicht mehr. Entferne ihn und richte Join-to-Create neu ein.</Notice>
      ) : (
        <>
          <div className="stack">
            <SettingsFields value={draft} onChange={setDraft} />
          </div>
          <Actions>
            <button type="button" className="btn btn-secondary" disabled={!dirty || saving} onClick={() => setDraft({ nameTemplate: trigger.nameTemplate, userLimit: trigger.userLimit, bitrateKbps: trigger.bitrateKbps })}>Zurücksetzen</button>
            <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? 'Speichern …' : 'Änderungen speichern'}</button>
          </Actions>
        </>
      )}
      {dialog}
    </Card>
  );
}

function CreateCard({ onCreated }: { onCreated: (state: JoinToCreateState) => void }) {
  const { guild } = useGuild();
  const { run, busy } = useAction();
  const [draft, setDraft] = useState<JoinToCreateCreate>({ ...JTC_DEFAULTS, categoryId: null });

  const create = async () => {
    const state = await run<JoinToCreateState>(`/guilds/${guild.id}/jointocreate`, draft, 'Join-to-Create-Kanal erstellt.');
    if (state) onCreated(state);
  };

  return (
    <Card icon="plus" title="Join-to-Create einrichten" description="Nexo erstellt einen Sprachkanal „Join-to-Create“. Wer ihm beitritt, bekommt einen eigenen temporären Kanal.">
      <div className="stack">
        <Field label="Kategorie" hint="Hier landen der Auslöser und die temporären Kanäle.">
          <ChannelSelect kind="category" value={draft.categoryId} onChange={(categoryId) => setDraft({ ...draft, categoryId })} placeholder="Oberste Ebene" />
        </Field>
        <SettingsFields value={draft} onChange={(settings) => setDraft({ ...draft, ...settings })} />
      </div>
      <Actions>
        <button type="button" className="btn btn-primary" disabled={busy !== null || !draft.nameTemplate.trim()} onClick={create}>
          {busy ? 'Wird erstellt …' : 'Kanal erstellen'}
        </button>
      </Actions>
    </Card>
  );
}

export default function JoinToCreatePage() {
  const { guild, reload: reloadGuild } = useGuild();
  const { data, setData, error, loading, reload } = useApi<JoinToCreateState>(`/guilds/${guild.id}/jointocreate`);

  return (
    <>
      <PageHeader icon="mic" title="Join-to-Create" description="Temporäre Sprachkanäle, die beim Beitreten entstehen und leer wieder verschwinden." />
      {loading && !data && <Spinner />}
      {error && !data && <Notice tone="danger" onRetry={reload}>{error}</Notice>}
      {data && (
        <>
          {data.triggers.length === 0
            ? <CreateCard onCreated={(state) => { setData(state); reloadGuild(); }} />
            : data.triggers.map((trigger) => (
              // Keyed by the saved values so the card's draft resets after a save.
              <TriggerCard key={`${trigger.channelId}:${trigger.nameTemplate}:${trigger.userLimit}:${trigger.bitrateKbps}`} trigger={trigger}
                onChanged={(state) => { setData(state); reloadGuild(); }} />
            ))}
          {data.triggers.length > 0 && (
            <p className="faint mt-4">Pro Server ist ein Join-to-Create-Kanal möglich. Gerade offen: {data.activeChannels} temporäre{data.activeChannels === 1 ? 'r Kanal' : ' Kanäle'}.</p>
          )}
        </>
      )}
    </>
  );
}
