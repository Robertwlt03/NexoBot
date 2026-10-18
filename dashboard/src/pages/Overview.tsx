import { Link } from 'react-router';
import { useGuild } from '../api';
import { IconTile } from '../icons';
import { GROUPS, MODULES } from '../modules/registry';

export function Overview() {
  const { guild } = useGuild();
  const textChannels = guild.channels.filter((c) => c.type === 0 || c.type === 5).length;
  return (
    <>
      <div className="page-head">
        {guild.iconUrl ? <img src={guild.iconUrl} alt="" style={{ width: 48, height: 48, borderRadius: 14 }} /> : null}
        <div>
          <h1>{guild.name}</h1>
          <p>{guild.memberCount.toLocaleString('de-DE')} Mitglieder · {textChannels} Textkanäle · {guild.roles.length} Rollen</p>
        </div>
      </div>
      {GROUPS.map((group) => (
        <section key={group} style={{ marginBottom: 28 }}>
          <div className="nav-group-title" style={{ padding: '0 0 10px' }}>{group}</div>
          <div className="grid">
            {MODULES.filter((m) => m.group === group).map((m) => (
              <Link key={m.id} className="tile" to={m.id}>
                <IconTile name={m.icon} />
                <div><h3>{m.label}</h3><p>{m.description}</p></div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
