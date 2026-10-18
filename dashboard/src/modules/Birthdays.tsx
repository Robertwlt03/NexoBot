import type { BirthdayEntry, BirthdaySettings } from '../../../src/web/dto/birthdays';
import { useAction, useGuild, useSettings } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { Badge, Card, ChannelSelect, Empty, Field, Notice, PageHeader, RoleSelect, SettingsPage } from '../components/ui';
import { Icon } from '../icons';

const formatDay = (entry: BirthdayEntry) => new Date(2000, entry.month - 1, entry.day).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });

export default function BirthdaysPage() {
  const { guild } = useGuild();
  const settings = useSettings<BirthdaySettings>('birthdays');
  const { run, busy } = useAction();
  const { confirm, dialog } = useConfirm();

  const remove = (entry: BirthdayEntry) => confirm({
    title: 'Geburtstag entfernen?',
    confirmLabel: 'Entfernen',
    text: <>Der Geburtstag von <b>{entry.name}</b> ({formatDay(entry)}) wird von diesem Server entfernt.</>,
    onConfirm: async () => {
      if (await run(`/guilds/${guild.id}/birthdays/entries/${entry.userId}/delete`, {}, 'Geburtstag entfernt.')) settings.reload();
    },
  });

  return (
    <>
      <PageHeader icon="cake" title="Geburtstage" description="Gratuliere Mitgliedern automatisch und vergib ihnen für den Tag eine Rolle." />
      <SettingsPage settings={settings}>
        {(value) => (
          <>
            <Card icon="cake" title="Ankündigungen" description="Nexo prüft einmal am Tag (UTC), wer Geburtstag hat, und gratuliert im gewählten Kanal.">
              <div className="grid-2">
                <Field label="Geburtstagskanal" hint="Leer lassen, um Ankündigungen auszuschalten.">
                  <ChannelSelect value={value.channelId} onChange={(channelId) => settings.set({ channelId })} placeholder="Keine Ankündigungen" />
                </Field>
                <Field label="Geburtstagsrolle (optional)" hint="Wird für einen Tag vergeben. Nexos Rolle muss darüber stehen.">
                  <RoleSelect value={value.roleId} assignableOnly onChange={(roleId) => settings.set({ roleId })} placeholder="Keine Rolle" />
                </Field>
              </div>
              {!value.channelId && value.roleId && (
                <div className="mt-4"><Notice tone="warn">Ohne Geburtstagskanal läuft die tägliche Prüfung nicht – die Rolle wird dann auch nicht vergeben.</Notice></div>
              )}
            </Card>

            <Card icon="gift" title="Nächste Geburtstage">
              {value.upcoming.length === 0 ? <Empty title="Noch keine Geburtstage">Mitglieder tragen ihren Geburtstag mit /birthday set ein.</Empty> : (
                <div className="list">
                  {value.upcoming.map((entry) => (
                    <div className="list-item" key={entry.userId}>
                      <div className="grow"><div className="title">{entry.name}</div><div className="faint">{formatDay(entry)}</div></div>
                      <Badge on={entry.daysUntil === 0}>{entry.daysUntil === 0 ? 'Heute 🎉' : entry.daysUntil === 1 ? 'Morgen' : `in ${entry.daysUntil} Tagen`}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card icon="users" title={`Alle Geburtstage (${value.entries.length})`} description="Mitglieder tragen ihren Geburtstag selbst ein. Hier kannst du Einträge entfernen.">
              {value.entries.length === 0 ? <Empty title="Keine Einträge" /> : (
                <div className="list">
                  {value.entries.map((entry) => (
                    <div className="list-item" key={entry.userId}>
                      <div className="grow"><div className="title">{entry.name}</div><div className="faint">{formatDay(entry)}</div></div>
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Geburtstag von ${entry.name} entfernen`} disabled={busy !== null} onClick={() => remove(entry)}>
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </SettingsPage>
      {dialog}
    </>
  );
}
