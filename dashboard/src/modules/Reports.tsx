import type { ReportSettings } from '../../../src/web/dto/reports';
import { useSettings } from '../api';
import { Card, ChannelSelect, Field, Notice, PageHeader, SettingsPage } from '../components/ui';

export default function ReportsPage() {
  const settings = useSettings<ReportSettings>('reports');
  return (
    <>
      <PageHeader icon="flag" title="Meldungen" description="Mit /report file melden Mitglieder andere Nutzer an euer Team." />
      <SettingsPage settings={settings}>
        {(value) => (
          <Card icon="flag" title="Meldekanal" description="Hier landen alle neuen Meldungen, der Serverinhaber wird dabei erwähnt.">
            <div className="stack">
              {value.channelId && !value.loggingEnabled && (
                <Notice tone="warn">Die Protokollierung ist ausgeschaltet, deshalb kommen keine Meldungen an. Schalte sie unter Protokolle ein.</Notice>
              )}
              {value.channelId && !value.eventEnabled && (
                <Notice tone="warn">Das Ereignis „Meldung eingereicht“ ist unter Protokolle ausgeschaltet, deshalb kommen keine Meldungen an.</Notice>
              )}
              <Field label="Kanal" hint="Ohne Kanal kann niemand etwas melden. Nexo braucht dort „Nachrichten senden“ und „Links einbetten“.">
                <ChannelSelect value={value.channelId} placeholder="Kein Meldekanal" onChange={(channelId) => settings.set({ channelId })} />
              </Field>
            </div>
          </Card>
        )}
      </SettingsPage>
    </>
  );
}
