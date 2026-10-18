import type { WelcomeMessageSettings, WelcomeSettings } from '../../../src/web/dto/welcome';
import { WELCOME_PLACEHOLDERS } from '../../../src/web/dto/welcome';
import { useGuild, useSettings, useUser } from '../api';
import {
  Badge, Card, ChannelSelect, ColorInput, Field, MessagePreview, Notice, NumberInput, PageHeader, RoleSelect,
  SettingsPage, Switch, SwitchRow, TextArea, TextInput,
} from '../components/ui';
import { CardEditor } from './welcome/CardEditor';

function MessageEditor({ kind, value, onChange }: {
  kind: 'welcome' | 'goodbye'; value: WelcomeMessageSettings; onChange: (value: WelcomeMessageSettings) => void;
}) {
  const { guild } = useGuild();
  const user = useUser();
  const set = (patch: Partial<WelcomeMessageSettings>) => onChange({ ...value, ...patch });
  const name = user?.globalName ?? user?.username ?? 'Nexo-Fan';
  const sample = {
    '{user}': `@${name}`,
    '{username}': name,
    '{user.tag}': user?.username ?? 'nexo_fan',
    '{server}': guild.name,
    '{memberCount}': guild.memberCount.toLocaleString('de-DE'),
  };
  const isWelcome = kind === 'welcome';

  return (
    <>
      <Card
        icon={isWelcome ? 'wave' : 'logout'}
        title={isWelcome ? 'Willkommensnachricht' : 'Abschiedsnachricht'}
        description={isWelcome ? 'Wird gesendet, wenn jemand dem Server beitritt.' : 'Wird gesendet, wenn jemand den Server verlässt.'}
        right={(
          <div className="row">
            <Badge on={value.enabled}>{value.enabled ? 'Aktiv' : 'Aus'}</Badge>
            <Switch checked={value.enabled} label="Aktiv" onChange={(enabled) => set({ enabled })} />
          </div>
        )}
      >
        <div className="grid-2">
          <div className="stack">
            <Field label="Kanal">
              <ChannelSelect value={value.channelId} onChange={(channelId) => set({ channelId })} />
            </Field>
            <Field label="Nachricht" hint="Klick auf einen Platzhalter, um ihn einzufügen.">
              <TextArea value={value.message} onChange={(message) => set({ message })} maxLength={2000} variables={WELCOME_PLACEHOLDERS} />
            </Field>
            <div className="grid-2">
              <Field label="Titel"><TextInput value={value.embedTitle} onChange={(embedTitle) => set({ embedTitle })} maxLength={256} /></Field>
              <Field label="Farbe"><ColorInput value={value.embedColor} onChange={(embedColor) => set({ embedColor })} /></Field>
            </div>
            <Field label="Fußzeile"><TextInput value={value.embedFooter} onChange={(embedFooter) => set({ embedFooter })} maxLength={2048} /></Field>
            <Field label="Bild (optional)" hint="Direkter Link zu einem Bild oder GIF (https://…).">
              <TextInput value={value.imageUrl ?? ''} onChange={(imageUrl) => set({ imageUrl: imageUrl || null })} placeholder="https://…" />
            </Field>
            <SwitchRow title={isWelcome ? 'Neues Mitglied erwähnen' : 'Mitglied erwähnen'} description="Pingt das Mitglied zusätzlich zur Nachricht."
              checked={value.ping} onChange={(ping) => set({ ping })} />
            <SwitchRow title="Profil-Stil der Mitglieder zeigen"
              description="Der Avatar auf der Karte bekommt Rahmen- und Akzentfarbe aus dem Nexo-Profil – bei allen, die das in ihrem Profil erlauben."
              checked={value.memberStyle} onChange={(memberStyle) => set({ memberStyle })} />
          </div>
          <div className="stack">
            <span className="field-label">Vorschau</span>
            <MessagePreview
              content={value.ping ? '{user}' : undefined}
              embed={{ title: value.embedTitle, description: value.message, color: value.embedColor, image: value.card.enabled ? null : value.imageUrl, footer: value.embedFooter }}
              sample={sample}
            />
            {value.card.enabled && <p className="faint">Die Karte unten ersetzt das Bild im Embed.</p>}
          </div>
        </div>
      </Card>
      <CardEditor kind={kind} value={value.card} onChange={(card) => set({ card })} />
    </>
  );
}

export default function WelcomePage() {
  const settings = useSettings<WelcomeSettings>('welcome');
  return (
    <>
      <PageHeader icon="wave" title="Willkommen" description="Begrüße neue Mitglieder, verabschiede Leute und vergib automatisch eine Rolle." />
      <SettingsPage settings={settings}>
        {(value) => (
          <>
            <MessageEditor kind="welcome" value={value.welcome} onChange={(welcome) => settings.set({ welcome })} />
            <MessageEditor kind="goodbye" value={value.goodbye} onChange={(goodbye) => settings.set({ goodbye })} />
            <Card icon="users" title="Auto-Rolle" description="Diese Rolle bekommt jedes neue Mitglied automatisch.">
              {value.verificationActive && (
                <div className="mb-4"><Notice tone="warn">Die Verifizierung ist aktiv. Sie vergibt die Rolle nach der Bestätigung, eine Auto-Rolle ist dann nicht möglich.</Notice></div>
              )}
              <div className="grid-2">
                <Field label="Rolle" hint="Nexos eigene Rolle muss in der Rollenliste darüber stehen.">
                  <RoleSelect value={value.autoRole.roleId} assignableOnly placeholder="Keine Auto-Rolle"
                    onChange={(roleId) => settings.set({ autoRole: { ...value.autoRole, roleId } })} />
                </Field>
                <Field label="Verzögerung (Sekunden)" hint="0 = sofort beim Beitritt.">
                  <NumberInput value={value.autoRole.delaySeconds} min={0} max={3600}
                    onChange={(delaySeconds) => settings.set({ autoRole: { ...value.autoRole, delaySeconds } })} />
                </Field>
              </div>
            </Card>
          </>
        )}
      </SettingsPage>
    </>
  );
}
