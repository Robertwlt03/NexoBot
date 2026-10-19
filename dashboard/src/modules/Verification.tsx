import type { AutoVerifyCriteria, VerificationSettings } from '../../../src/web/dto/verification';
import { ACCOUNT_AGE_MAX, ACCOUNT_AGE_MIN } from '../../../src/web/dto/verification';
import { useAction, useGuild, useSettings } from '../api';
import {
  Badge, Card, ChannelSelect, Field, MessagePreview, Notice, NumberInput, PageHeader, RoleSelect, Select,
  SettingsPage, Switch, TextArea, TextInput,
} from '../components/ui';
import { Icon } from '../icons';

const CRITERIA: { value: AutoVerifyCriteria; label: string }[] = [
  { value: 'account_age', label: 'Account-Alter' },
  { value: 'none', label: 'Keine Kriterien (alle sofort)' },
  { value: 'server_size', label: 'Servergröße (unter 1000 Mitglieder)' },
];

const PANEL_STATUS: Record<VerificationSettings['panel']['status'], { text: string; on?: boolean }> = {
  ok: { text: 'Panel aktiv', on: true },
  deleted: { text: 'Panel-Nachricht gelöscht', on: false },
  channel_missing: { text: 'Kanal fehlt', on: false },
  none: { text: 'Nicht gepostet', on: false },
};

function PanelPreview({ message, buttonText }: { message: string; buttonText: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <MessagePreview embed={{ title: 'Server-Verifizierung', description: message, color: '#57F287' }} sample={{}} />
      <div className="ml-[70px] inline-flex items-center gap-1.5 self-start rounded-(--radius-sm) bg-(--success) px-3.5 py-1.5 text-sm font-medium text-[#fff]"><span>✅</span>{buttonText || 'Verifizieren'}</div>
    </div>
  );
}

export default function VerificationPage() {
  const settings = useSettings<VerificationSettings>('verification');
  const { guild } = useGuild();
  const { run, busy } = useAction();

  const repost = async () => {
    const result = await run<VerificationSettings>(`/guilds/${guild.id}/verification/actions/repost`, {}, 'Panel neu gepostet.');
    if (result) settings.reload();
  };

  return (
    <>
      <PageHeader icon="verify" title="Verifizierung" description="Neue Mitglieder bestätigen per Button oder werden automatisch verifiziert." />
      <SettingsPage settings={settings}>
        {(value) => {
          const av = value.autoVerify;
          const setAv = (patch: Partial<VerificationSettings['autoVerify']>) => settings.set({ autoVerify: { ...av, ...patch } });
          const status = PANEL_STATUS[value.panel.status];
          const criteria = CRITERIA.filter((c) => c.value !== 'server_size' || av.criteria === 'server_size');
          return (
            <>
              {value.autoRoleConfigured && (
                <div className="mb-4">
                  <Notice tone="warn">
                    Unter „Willkommen“ ist eine Auto-Rolle eingerichtet. Solange sie aktiv ist, kannst du weder die Verifizierung noch AutoVerify einschalten.
                  </Notice>
                </div>
              )}

              <Card icon="verify" title="Verifizierungs-Panel" description="Mitglieder klicken auf den Button und bekommen die Rolle."
                right={<Switch checked={value.enabled} onChange={(enabled) => settings.set({ enabled })} label="Verifizierung aktiv" />}>
                <div className="stack">
                  {value.enabled && av.enabled && (
                    <Notice tone="warn">Verifizierung und AutoVerify schließen sich aus. Schalte eins davon aus.</Notice>
                  )}
                  <div className="row">
                    <Badge on={status.on}>{status.text}</Badge>
                    <Badge>{value.verifiedCount.toLocaleString('de-DE')} verifiziert</Badge>
                    {value.panel.url && (
                      <a className="btn btn-ghost btn-sm" href={value.panel.url} target="_blank" rel="noreferrer"><Icon name="external" size={14} />Panel ansehen</a>
                    )}
                    <button type="button" className="btn btn-secondary btn-sm ml-auto"
                      disabled={!value.enabled || !value.channelId || settings.dirty || busy !== null} onClick={repost}
                      title={settings.dirty ? 'Speichere zuerst deine Änderungen.' : undefined}>
                      <Icon name="refresh" size={14} />Panel neu posten
                    </button>
                  </div>
                  <div className="grid-2">
                    <div className="stack">
                      <Field label="Kanal" hint="Hier postet Nexo das Panel. Beim Wechsel wird es verschoben.">
                        <ChannelSelect value={value.channelId} onChange={(channelId) => settings.set({ channelId })} />
                      </Field>
                      <Field label="Verifizierungsrolle" hint="Nexos eigene Rolle muss darüber stehen.">
                        <RoleSelect value={value.roleId} assignableOnly onChange={(roleId) => settings.set({ roleId })} />
                      </Field>
                      <Field label="Nachricht">
                        <TextArea value={value.message} onChange={(message) => settings.set({ message })} maxLength={2000} />
                      </Field>
                      <Field label="Button-Text">
                        <TextInput value={value.buttonText} onChange={(buttonText) => settings.set({ buttonText })} maxLength={80} />
                      </Field>
                    </div>
                    <div className="stack">
                      <span className="field-label">Vorschau</span>
                      <PanelPreview message={value.message} buttonText={value.buttonText} />
                    </div>
                  </div>
                </div>
              </Card>

              <Card icon="shield" title="AutoVerify" description="Vergibt die Rolle direkt beim Beitritt, wenn das Mitglied die Kriterien erfüllt."
                right={<Switch checked={av.enabled} onChange={(enabled) => setAv({ enabled })} label="AutoVerify aktiv" />}>
                <div className="grid-2">
                  <Field label="Kriterium">
                    <Select value={av.criteria} options={criteria} onChange={(next) => setAv({ criteria: next })} />
                  </Field>
                  <Field label="Rolle" hint="Nexos eigene Rolle muss darüber stehen.">
                    <RoleSelect value={av.roleId} assignableOnly onChange={(roleId) => setAv({ roleId })} />
                  </Field>
                  {av.criteria === 'account_age' && (
                    <Field label="Mindestalter des Accounts (Tage)" hint={`Zwischen ${ACCOUNT_AGE_MIN} und ${ACCOUNT_AGE_MAX} Tagen.`}>
                      <NumberInput value={av.accountAgeDays} min={ACCOUNT_AGE_MIN} max={ACCOUNT_AGE_MAX} onChange={(accountAgeDays) => setAv({ accountAgeDays })} />
                    </Field>
                  )}
                </div>
              </Card>
            </>
          );
        }}
      </SettingsPage>
    </>
  );
}
