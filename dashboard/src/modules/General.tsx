import type { GeneralSettings } from '../../../src/web/dto/general';
import { useSettings } from '../api';
import { Card, ChannelSelect, Field, PageHeader, RoleSelect, SettingsPage, TextInput } from '../components/ui';

export default function GeneralPage() {
  const settings = useSettings<GeneralSettings>('general');
  return (
    <>
      <PageHeader icon="settings" title="Allgemein" description="Prefix, Moderator- und Admin-Rolle und der Log-Kanal für diesen Server." />
      <SettingsPage settings={settings}>
        {(value) => (
          <>
            <Card icon="commands" title="Prefix" description="Damit startest du Nachrichten-Commands, z. B. !help.">
              <Field label="Prefix" hint={`1–10 Zeichen, ohne Leerzeichen. Standard: ${value.defaultPrefix}`}>
                <TextInput value={value.prefix} onChange={(prefix) => settings.set({ prefix })} maxLength={10} placeholder={value.defaultPrefix} />
              </Field>
            </Card>
            <Card icon="shield" title="Rollen" description="Wer mit dieser Rolle Moderations-Commands nutzen darf, auch ohne passende Discord-Berechtigung.">
              <div className="grid-2">
                <Field label="Moderator-Rolle" hint="Nexos eigene Rolle muss in der Rollenliste darüber stehen.">
                  <RoleSelect value={value.modRoleId} assignableOnly placeholder="Keine Moderator-Rolle" onChange={(modRoleId) => settings.set({ modRoleId })} />
                </Field>
                <Field label="Admin-Rolle" hint="Wird gespeichert, aktuell wertet aber noch kein Command sie aus.">
                  <RoleSelect value={value.adminRoleId} assignableOnly placeholder="Keine Admin-Rolle" onChange={(adminRoleId) => settings.set({ adminRoleId })} />
                </Field>
              </div>
            </Card>
            <Card icon="log" title="Log-Kanal" description="Hierhin gehen die Audit-Logs (Moderation, Nachrichten, Mitglieder …).">
              <Field label="Kanal" hint="Setzt du einen Kanal, wird die Protokollierung eingeschaltet. Mehr Optionen findest du unter Protokolle.">
                <ChannelSelect value={value.auditLogChannelId} placeholder="Kein Log-Kanal" onChange={(auditLogChannelId) => settings.set({ auditLogChannelId })} />
              </Field>
            </Card>
          </>
        )}
      </SettingsPage>
    </>
  );
}
