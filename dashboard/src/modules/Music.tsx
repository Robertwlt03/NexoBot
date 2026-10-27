import type { MusicState } from '../../../src/web/dto/music';
import { useAction, useApi, useGuild } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { Actions, Badge, Card, Empty, Notice, PageHeader, Spinner, SwitchRow } from '../components/ui';
import { Icon } from '../icons';

const LOOP_LABELS: Record<string, string> = { none: 'Aus', track: 'Titel', queue: 'Warteschlange' };

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const rest = `${Math.floor((total % 3600) / 60)}`.padStart(hours ? 2 : 1, '0') + `:${`${total % 60}`.padStart(2, '0')}`;
  return hours ? `${hours}:${rest}` : rest;
}

export default function MusicPage() {
  const { guild } = useGuild();
  const { data, setData, error, loading, reload } = useApi<MusicState>(`/guilds/${guild.id}/music`);
  const { run, busy } = useAction();
  const { confirm, dialog } = useConfirm();
  const base = `/guilds/${guild.id}/music`;
  const voiceChannel = guild.channels.find((channel) => channel.id === data?.voiceChannelId);

  const act = async (path: string, body: unknown, success: string) => {
    const state = await run<MusicState>(`${base}/${path}`, body, success);
    if (state) setData(state);
  };

  return (
    <>
      <PageHeader
        icon="music"
        title="Musik"
        description="Sieh, was gerade läuft, und schalte den 24/7-Modus."
        actions={<button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}><Icon name="refresh" size={16} />Aktualisieren</button>}
      />
      <div className="stack mb-4">
        <Notice>Der Musikstatus liegt nur im Arbeitsspeicher. Bei einem Neustart von Nexo werden Wiedergabe, Warteschlange und 24/7-Modus zurückgesetzt.</Notice>
        {error && !data && <Notice tone="danger" onRetry={reload}>{error}</Notice>}
        {data && !data.available && <Notice tone="warn">Musik ist auf diesem Bot nicht verfügbar – Lavalink ist nicht konfiguriert.</Notice>}
      </div>
      {loading && !data && <Spinner />}
      {data && data.available && (
        <>
          <Card icon="music" title="Gerade läuft" right={data.active && <Badge on={!data.paused}>{data.paused ? 'Pausiert' : 'Spielt'}</Badge>}>
            {!data.nowPlaying ? (
              <Empty title="Gerade läuft nichts">Starte Musik in Discord mit /play.</Empty>
            ) : (
              <div className="stack">
                <div>
                  <div className="text-base font-semibold">
                    {data.nowPlaying.uri ? <a href={data.nowPlaying.uri} target="_blank" rel="noreferrer">{data.nowPlaying.title}</a> : data.nowPlaying.title}
                  </div>
                  <div className="muted">{data.nowPlaying.author}</div>
                </div>
                <div className="chips">
                  <Badge>{formatTime(data.positionMs)} / {formatTime(data.nowPlaying.lengthMs)}</Badge>
                  <Badge>{data.queueLength} in der Warteschlange</Badge>
                  <Badge>Lautstärke {data.volume} %</Badge>
                  <Badge>Wiederholen: {LOOP_LABELS[data.loop] ?? data.loop}</Badge>
                  {voiceChannel && <span className="badge whitespace-nowrap"><Icon name="mic" size={13} />{voiceChannel.name}</span>}
                </div>
              </div>
            )}
            {data.active && (
              <>
                {!data.canControl && <div className="mt-4"><Notice>Wie bei den Commands kannst du die Wiedergabe nur steuern, wenn du im selben Sprachkanal wie Nexo bist.</Notice></div>}
                <Actions>
                  <button type="button" className="btn btn-secondary" disabled={!data.canControl || !data.nowPlaying || busy !== null}
                    onClick={() => act('skip', {}, 'Titel übersprungen.')}>Überspringen</button>
                  <button type="button" className="btn btn-danger" disabled={!data.canControl || busy !== null}
                    onClick={() => confirm({
                      title: 'Wiedergabe stoppen?', confirmLabel: 'Stoppen',
                      text: `Die Wiedergabe wird gestoppt und die Warteschlange (${data.queueLength} Titel) geleert.`,
                      onConfirm: () => act('stop', {}, 'Wiedergabe gestoppt.'),
                    })}>Stoppen</button>
                </Actions>
              </>
            )}
          </Card>
          <Card icon="settings" title="Einstellungen">
            <SwitchRow
              title="24/7-Modus"
              description="Nexo bleibt im Sprachkanal, auch wenn die Warteschlange leer ist. Sonst verlässt Nexo den Kanal nach 30 Sekunden Leerlauf."
              checked={data.twentyFourSeven}
              disabled={busy !== null}
              onChange={(enabled) => act('twentyfourseven', { enabled }, enabled ? '24/7-Modus aktiviert.' : '24/7-Modus deaktiviert.')}
            />
          </Card>
        </>
      )}
      {dialog}
    </>
  );
}
