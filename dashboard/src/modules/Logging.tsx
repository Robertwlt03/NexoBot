import { useState } from 'react';
import type { LogDestination, LoggingSettings } from '../../../src/web/dto/logging';
import { LOG_DESTINATIONS } from '../../../src/web/dto/logging';
import { useSettings } from '../api';
import { Card, ChannelSelect, Field, MultiChannelSelect, Notice, PageHeader, SettingsPage, Switch, SwitchRow } from '../components/ui';

const DESTINATIONS: Record<LogDestination, { label: string; hint: string }> = {
  audit: { label: 'Audit-Log', hint: 'Moderation, Nachrichten, Rollen, Mitglieder und alles andere.' },
  applications: { label: 'Bewerbungen', hint: 'Eingereichte und geprüfte Bewerbungen.' },
  reports: { label: 'Meldungen', hint: 'Nutzermeldungen über /report.' },
};

function UserIdList({ value, names, onChange }: { value: string[]; names: Record<string, string>; onChange: (value: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const id = draft.trim();
    if (/^\d{17,20}$/.test(id) && !value.includes(id)) onChange([...value, id]);
    setDraft('');
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      {value.length > 0 && (
        <div className="chips">
          {value.map((id) => (
            <span className="chip" key={id} title={id}>
              {names[id] ? `@${names[id]}` : id}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} aria-label="Entfernen">×</button>
            </span>
          ))}
        </div>
      )}
      <input className="input" value={draft} placeholder="Nutzer-ID einfügen und Enter drücken" inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)} onBlur={add}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
    </div>
  );
}

export default function LoggingPage() {
  const settings = useSettings<LoggingSettings>('logging');
  return (
    <>
      <PageHeader icon="log" title="Logging" description="Lege fest, welche Ereignisse Nexo in welchen Kanal protokolliert." />
      <SettingsPage settings={settings}>
        {(value) => {
          const setEvents = (types: string[], on: boolean) =>
            settings.set({ events: { ...value.events, ...Object.fromEntries(types.map((type) => [type, on])) } });
          return (
            <>
              <Card icon="log" title="Logging" description="Hauptschalter: Ist er aus, protokolliert Nexo gar nichts – auch keine Bewerbungen und Meldungen."
                right={<Switch checked={value.enabled} onChange={(enabled) => settings.set({ enabled })} label="Logging aktiv" />}>
                {!value.channels.audit && value.enabled && <Notice tone="warn">Es ist noch kein Audit-Kanal gesetzt.</Notice>}
              </Card>

              <Card icon="hash" title="Log-Kanäle" description="Nexo braucht dort „Kanal ansehen“, „Nachrichten senden“ und „Links einbetten“.">
                <div className="grid">
                  {LOG_DESTINATIONS.map((dest) => (
                    <Field key={dest} label={DESTINATIONS[dest].label} hint={DESTINATIONS[dest].hint}>
                      <ChannelSelect value={value.channels[dest]} placeholder="Kein Kanal" onChange={(channelId) =>
                        settings.set({ channels: { ...value.channels, [dest]: channelId }, enabled: channelId ? true : value.enabled })} />
                    </Field>
                  ))}
                </div>
              </Card>

              <Card icon="check" title="Ereignisse" description={value.enabled ? "Wähle aus, welche Ereignisse protokolliert werden." : "Wähle aus, welche Ereignisse protokolliert werden. Greift erst, wenn das Logging an ist."}>
                <div className="grid">
                  {value.categories.map((category) => {
                    const types = category.events.map((event) => event.type);
                    const allOn = types.every((type) => value.events[type]);
                    return (
                      <div key={category.key} className="stack" style={{ gap: 4 }}>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <div>
                            <h3>{category.label}</h3>
                            <span className="faint">→ {DESTINATIONS[category.destination].label}</span>
                          </div>
                          <Switch checked={allOn} onChange={(on) => setEvents(types, on)} label={`${category.label}: alle`} />
                        </div>
                        {category.events.map((event) => (
                          <SwitchRow key={event.type} title={event.label} checked={value.events[event.type] ?? true}
                            onChange={(on) => setEvents([event.type], on)} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card icon="x" title="Ignorieren" description="Ereignisse von diesen Nutzern und aus diesen Kanälen werden nicht protokolliert.">
                <div className="grid-2">
                  <Field label="Nutzer" hint="Rechtsklick auf einen Nutzer → „Nutzer-ID kopieren“ (Entwicklermodus).">
                    <UserIdList value={value.ignore.users} names={value.userNames}
                      onChange={(users) => settings.set({ ignore: { ...value.ignore, users } })} />
                  </Field>
                  <Field label="Kanäle">
                    <MultiChannelSelect value={value.ignore.channels}
                      onChange={(channels) => settings.set({ ignore: { ...value.ignore, channels } })} />
                  </Field>
                </div>
              </Card>
            </>
          );
        }}
      </SettingsPage>
    </>
  );
}
