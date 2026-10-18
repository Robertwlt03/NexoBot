import { Link } from 'react-router';
import type { ApiGuildSummary } from '../../../src/web/apiTypes';
import { useApi } from '../api';
import { ServerRail, UserPanel } from '../components/Layout';
import { Empty, Notice, Spinner } from '../components/ui';
import { Icon } from '../icons';

export function ServerPicker() {
  const { data, error, loading, reload } = useApi<ApiGuildSummary[]>('/guilds');
  const guilds = data ?? [];
  const refresh = async () => { await fetch('/dashboard/api/guilds?refresh=1', { credentials: 'same-origin' }); reload(); };

  return (
    <div className="app app-picker">
      <ServerRail guilds={guilds} />
      <main className="main">
        <div className="topbar">Server auswählen</div>
        <div className="content">
          <div className="content-inner">
            <div className="page-head">
              <div>
                <h1>Deine Server</h1>
                <p>Server, auf denen du „Server verwalten“ darfst. Wähle einen aus, um Nexo einzurichten.</p>
              </div>
              <div className="actions"><button className="btn btn-secondary" onClick={refresh}><Icon name="refresh" size={16} /> Aktualisieren</button></div>
            </div>
            {loading && !data && <Spinner />}
            {error && <Notice tone="danger">{error}</Notice>}
            {data && guilds.length === 0 && <Empty title="Keine Server gefunden">Du brauchst auf einem Server die Berechtigung „Server verwalten“.</Empty>}
            <div className="server-grid">
              {guilds.map((guild) => (
                <div className="server-card" key={guild.id}>
                  <div className="banner" style={guild.iconUrl ? { backgroundImage: `linear-gradient(135deg, rgba(124,92,255,.55), rgba(34,211,238,.35)), url(${guild.iconUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
                    <div className="icon">{guild.iconUrl ? <img src={guild.iconUrl} alt="" /> : guild.name.slice(0, 2)}</div>
                  </div>
                  <div className="body">
                    <div className="name">{guild.name}</div>
                    {guild.botPresent
                      ? <Link className="btn btn-primary" to={`/servers/${guild.id}`}>Einrichten</Link>
                      : <a className="btn btn-secondary" href={guild.inviteUrl ?? '#'}><Icon name="plus" size={16} /> Nexo einladen</a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <div className="picker-user"><UserPanel /></div>
    </div>
  );
}
