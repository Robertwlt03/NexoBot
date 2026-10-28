import { useEffect, useRef } from 'react';
import type { TicketOverview, TicketPanelState, TicketSettings } from '../../../src/web/dto/tickets';
import { DEFAULT_BUTTON_LABEL, DEFAULT_PANEL_MESSAGE, OPEN_TICKET_LIMIT } from '../../../src/web/dto/tickets';
import { useAction, useApi, useGuild, useSettings } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import {
  Badge, Card, ChannelSelect, Empty, Field, MessagePreview, Notice, NumberInput, PageHeader, RoleSelect,
  SettingsPage, Spinner, Stats, SwitchRow, TableWrap, TextArea, TextInput, type BadgeTone,
} from '../components/ui';
import { Icon, type IconName } from '../icons';

const PANEL_STATE: Record<TicketPanelState, { label: string; tone: BadgeTone; hint: string }> = {
  active: { label: 'Aktiv', tone: 'pos', hint: 'Das Panel ist gepostet. Text- und Button-Änderungen landen beim Speichern direkt im Panel.' },
  no_channel: { label: 'Nicht eingerichtet', tone: 'off', hint: 'Wähl unten einen Panel-Kanal aus und speichere, dann kannst du das Panel posten.' },
  channel_missing: { label: 'Kanal fehlt', tone: 'warn', hint: 'Der Panel-Kanal wurde gelöscht. Wähl unten einen neuen aus.' },
  panel_deleted: { label: 'Nicht gepostet', tone: 'warn', hint: 'Im Panel-Kanal ist gerade kein Panel. Poste es mit einem Klick.' },
};

function formatDuration(ms: number | null) {
  if (ms === null) return '–';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function Overview({ overview, canPost, onPosted, onRefresh }: {
  overview: ReturnType<typeof useApi<TicketOverview>>; canPost: boolean; onPosted: () => void; onRefresh: () => void;
}) {
  const { guild } = useGuild();
  const { run, busy } = useAction();
  const data = overview.data;

  const post = async () => {
    const result = await run<{ url: string }>(`/guilds/${guild.id}/tickets/actions/post-panel`, {}, 'Ticket-Panel gepostet.');
    if (result) onPosted();
  };

  return (
    <>
      {data && (
        <Stats items={[
          { label: 'Offene Tickets', value: data.stats.openCount },
          { label: 'Geschlossene Tickets', value: data.stats.closedCount },
          { label: 'Ø Zeit bis Schließen', value: formatDuration(data.stats.avgCloseTimeMs) },
          { label: 'Feedback', value: data.stats.avgRating !== null ? `${data.stats.avgRating.toLocaleString('de-DE', { maximumFractionDigits: 1 })} / 5` : 'Noch keins', hint: data.stats.avgRating !== null ? `${data.stats.feedbackCount} Bewertungen` : undefined },
        ]} />
      )}
      <Card icon="ticket" title="Übersicht" description="Panel-Status und offene Tickets."
        right={<button type="button" className="icon-btn" onClick={onRefresh} aria-label="Aktualisieren"><Icon name="refresh" size={18} /></button>}>
        {!data && overview.loading && <Spinner />}
        {overview.error && !data && <Notice tone="danger" onRetry={overview.reload}>{overview.error}</Notice>}
        {data && (
          <div className="stack">
            <div className="row">
              <span className="field-label">Panel</span>
              <Badge tone={PANEL_STATE[data.panel.state].tone}>{PANEL_STATE[data.panel.state].label}</Badge>
              {data.panel.url && <a href={data.panel.url} target="_blank" rel="noreferrer">In Discord öffnen <Icon name="external" size={14} /></a>}
              {data.panel.state === 'panel_deleted' && (
                <button type="button" className="btn btn-primary btn-sm" disabled={!canPost || busy !== null} onClick={post}>
                  <Icon name="send" size={16} />Panel posten
                </button>
              )}
              {data.panel.state === 'panel_deleted' && !canPost && <span className="faint">Speichere zuerst deine Änderungen.</span>}
            </div>
            <span className="faint">{PANEL_STATE[data.panel.state].hint}</span>

            {data.openTickets.length === 0 ? (
              <Empty title="Keine offenen Tickets">Sobald jemand ein Ticket öffnet, siehst du es hier.</Empty>
            ) : (
              <>
                <TableWrap>
                  <thead>
                    <tr><th>Ticket</th><th>Von</th><th>Übernommen</th><th>Priorität</th><th>Erstellt</th></tr>
                  </thead>
                  <tbody>
                    {data.openTickets.map((ticket) => (
                      <tr key={ticket.channelId}>
                        <td>
                          <a href={`https://discord.com/channels/${guild.id}/${ticket.channelId}`} target="_blank" rel="noreferrer">
                            #{ticket.channelName ?? 'gelöschter-kanal'}
                          </a>
                          {ticket.reason && <div className="faint">{ticket.reason}</div>}
                        </td>
                        <td>{ticket.userName}</td>
                        <td>{ticket.claimedByName ?? <span className="faint">–</span>}</td>
                        <td>{ticket.priority ? <Priority priority={ticket.priority} /> : <span className="faint">–</span>}</td>
                        <td>{new Date(ticket.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
                {data.openTickets.length >= OPEN_TICKET_LIMIT && <span className="faint">Es werden die neuesten {OPEN_TICKET_LIMIT} Tickets angezeigt.</span>}
              </>
            )}
          </div>
        )}
      </Card>
    </>
  );
}

/** Priority read like Jira: each level has its own shape (double up, up, equals, down) and its own colour. */
const PRIORITY: Record<string, { icon: IconName; tone: string }> = {
  urgent: { icon: 'priorityUrgent', tone: 'var(--prio-urgent)' },
  high: { icon: 'priorityHigh', tone: 'var(--prio-high)' },
  medium: { icon: 'priorityMedium', tone: 'var(--prio-medium)' },
  low: { icon: 'priorityLow', tone: 'var(--prio-low)' },
};
function Priority({ priority }: { priority: { level: string; label: string } }) {
  const look = PRIORITY[priority.level] ?? PRIORITY.medium;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="inline-flex" style={{ color: look.tone }}><Icon name={look.icon} size={18} /></span>
      {priority.label}
    </span>
  );
}

export default function TicketsPage() {
  const { guild } = useGuild();
  const settings = useSettings<TicketSettings>('tickets');
  const overview = useApi<TicketOverview>(`/guilds/${guild.id}/tickets/overview`);
  const { run } = useAction();
  const { confirm, dialog } = useConfirm();

  // The panel state depends on the saved panel channel: refresh the overview after it was saved.
  const savedChannel = settings.dirty || !settings.value ? undefined : settings.value.panelChannelId;
  const lastChannel = useRef<string | null | undefined>(undefined);
  const reloadOverview = overview.reload;
  useEffect(() => {
    if (savedChannel === undefined) return;
    if (lastChannel.current !== undefined && lastChannel.current !== savedChannel) reloadOverview();
    lastChannel.current = savedChannel;
  }, [savedChannel, reloadOverview]);

  const deleteSystem = async () => {
    const result = await run<TicketSettings>(`/guilds/${guild.id}/tickets/actions/delete-system`, {}, 'Ticket-System gelöscht.');
    if (result) {
      settings.reload();
      overview.reload();
    }
  };

  return (
    <>
      <PageHeader icon="ticket" title="Tickets" description="Ticket-Panel, Support-Team, Kategorien und Transkripte" />
      <SettingsPage settings={settings}>
        {(value) => (
          <>
            <Overview overview={overview} canPost={!settings.dirty} onPosted={overview.reload} onRefresh={overview.reload} />

            <Card icon="send" title="Ticket-Panel" description="Die Nachricht mit dem Button, über den Mitglieder ein Ticket öffnen.">
              <div className="grid-2">
                <div className="stack">
                  <Field label="Panel-Kanal" hint="Nach einem Kanalwechsel speichern und das Panel neu posten. Das alte Panel löschst du selbst.">
                    <ChannelSelect value={value.panelChannelId} onChange={(panelChannelId) => settings.set({ panelChannelId })} />
                  </Field>
                  <Field label="Panel-Nachricht">
                    <TextArea value={value.panelMessage} onChange={(panelMessage) => settings.set({ panelMessage })} maxLength={2000} placeholder={DEFAULT_PANEL_MESSAGE} />
                  </Field>
                  <Field label="Button-Beschriftung">
                    <TextInput value={value.buttonLabel} onChange={(buttonLabel) => settings.set({ buttonLabel })} maxLength={80} placeholder={DEFAULT_BUTTON_LABEL} />
                  </Field>
                </div>
                <div className="stack">
                  <span className="field-label">Vorschau</span>
                  <MessagePreview embed={{ title: 'Support-Tickets', description: value.panelMessage, color: 'var(--blurple)' }} sample={{}} />
                  <div><span className="btn btn-primary btn-sm pointer-events-none"><Icon name="ticket" size={15} />{value.buttonLabel || DEFAULT_BUTTON_LABEL}</span></div>
                </div>
              </div>
            </Card>

            <Card icon="users" title="Team & Tickets" description="Wer Tickets sieht, wo sie landen und wie viele jemand gleichzeitig offen haben darf.">
              <div className="grid-2">
                <Field label="Team-Rolle" hint="Sieht und bearbeitet alle Tickets.">
                  <RoleSelect value={value.staffRoleId} onChange={(staffRoleId) => settings.set({ staffRoleId })} placeholder="Keine Team-Rolle" />
                </Field>
                <Field label="Max. offene Tickets pro Mitglied" hint="1 bis 10.">
                  <NumberInput value={value.maxTicketsPerUser} min={1} max={10} onChange={(maxTicketsPerUser) => settings.set({ maxTicketsPerUser })} />
                </Field>
                <Field label="Kategorie für offene Tickets" hint="Leer = Nexo nutzt eine Kategorie „Tickets“ oder legt sie an.">
                  <ChannelSelect kind="category" value={value.openCategoryId} onChange={(openCategoryId) => settings.set({ openCategoryId })} placeholder="Automatisch" />
                </Field>
                <Field label="Kategorie für geschlossene Tickets" hint="Leer = geschlossene Tickets bleiben, wo sie sind.">
                  <ChannelSelect kind="category" value={value.closedCategoryId} onChange={(closedCategoryId) => settings.set({ closedCategoryId })} placeholder="Nicht verschieben" />
                </Field>
              </div>
              <div className="mt-4">
                <SwitchRow title="DM beim Schließen" description="Das Mitglied bekommt eine DM, wenn sein Ticket geschlossen wird."
                  checked={value.dmOnClose} onChange={(dmOnClose) => settings.set({ dmOnClose })} />
              </div>
            </Card>

            <Card icon="log" title="Logs & Transkripte">
              <div className="grid-2">
                <Field label="Ticket-Log-Kanal" hint="Öffnen, Schließen, Übernehmen und Feedback.">
                  <ChannelSelect value={value.logsChannelId} onChange={(logsChannelId) => settings.set({ logsChannelId })} placeholder="Keine Logs" />
                </Field>
                <Field label="Transkript-Kanal" hint="Transkripte, wenn ein Ticket gelöscht wird.">
                  <ChannelSelect value={value.transcriptChannelId} onChange={(transcriptChannelId) => settings.set({ transcriptChannelId })} placeholder="Keine Transkripte" />
                </Field>
              </div>
            </Card>

            <Card icon="trash" title="Ticket-System löschen" description="Entfernt das Panel, alle gespeicherten Tickets und die Ticket-Einstellungen."
              right={<button type="button" className="btn btn-danger btn-sm" onClick={() => confirm({
                title: 'Ticket-System löschen?', confirmLabel: 'Endgültig löschen', onConfirm: deleteSystem,
                text: 'Das Panel, alle gespeicherten Tickets und die Ticket-Einstellungen werden gelöscht. Das lässt sich nicht rückgängig machen. Bestehende Ticket-Kanäle sowie Log- und Transkript-Kanal bleiben erhalten.',
              })}>System löschen</button>} />
          </>
        )}
      </SettingsPage>

      {dialog}
    </>
  );
}
