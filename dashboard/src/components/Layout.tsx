import { useCallback, useContext, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import type { ApiGuildDetail, ApiGuildSummary } from '../../../src/web/apiTypes';
import { DirtyContext, GuildContext, useApi, UserContext } from '../api';
import { Icon } from '../icons';
import { GROUPS, MODULES } from '../modules/registry';
import { Spinner, Notice } from './ui';

function guildInitials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3);
}

export function ServerRail({ guilds, activeId }: { guilds: ApiGuildSummary[]; activeId?: string }) {
  const navigate = useNavigate();
  return (
    <nav className="rail" aria-label="Server">
      <button className="rail-item" title="Alle Server" onClick={() => navigate('/servers')}>
        <img src="/dashboard/nexo.svg" alt="Nexo" style={{ padding: 4, background: '#fff' }} />
      </button>
      <div className="rail-sep" />
      {guilds.filter((g) => g.botPresent).map((guild) => (
        <button key={guild.id} title={guild.name} className={`rail-item${guild.id === activeId ? ' active' : ''}`}
          onClick={() => navigate(`/servers/${guild.id}`)}>
          {guild.iconUrl ? <img src={guild.iconUrl} alt="" /> : guildInitials(guild.name)}
        </button>
      ))}
    </nav>
  );
}

export function UserPanel() {
  const user = useContext(UserContext);
  const logout = async () => {
    await fetch('/dashboard/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    location.href = '/dashboard/';
  };
  if (!user) return null;
  return (
    <div className="user-panel">
      <img src={user.avatarUrl} alt="" />
      <div className="name">{user.globalName ?? user.username}<div className="sub">@{user.username}</div></div>
      <button className="icon-btn" title="Abmelden" onClick={logout}><Icon name="logout" size={18} /></button>
    </div>
  );
}

/** Guild area: server rail, module navigation and the module page (with unsaved-changes guard). */
export function GuildLayout() {
  const { guildId } = useParams();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const guilds = useApi<ApiGuildSummary[]>('/guilds');
  const detail = useApi<ApiGuildDetail>(guildId ? `/guilds/${guildId}` : null);

  const setGuard = useCallback((value: boolean) => setDirty(value), []);
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Block in-app navigation while there are unsaved changes (Discord behaviour: the save bar shakes).
  const guardClick = (event: MouseEvent) => {
    if (!dirty) return;
    event.preventDefault();
    const bar = document.getElementById('save-bar');
    bar?.classList.remove('shake');
    void bar?.offsetWidth;
    bar?.classList.add('shake');
  };

  const current = MODULES.find((m) => location.pathname.endsWith(`/${m.id}`));

  return (
    <div className="app">
      <ServerRail guilds={guilds.data ?? []} activeId={guildId} />
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          {detail.data?.iconUrl ? <img src={detail.data.iconUrl} alt="" /> : null}
          <span>{detail.data?.name ?? 'Server'}</span>
        </div>
        <nav className="sidebar-nav" onClickCapture={guardClick}>
          <NavLink end to={`/servers/${guildId}`} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon name="home" size={18} /> Übersicht
          </NavLink>
          {GROUPS.map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-group-title">{group}</div>
              {MODULES.filter((m) => m.group === group).map((m) => (
                <NavLink key={m.id} to={`/servers/${guildId}/${m.id}`} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <Icon name={m.icon} size={18} /> {m.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <UserPanel />
      </aside>
      <main className="main">
        <div className="topbar">
          <button className="icon-btn mobile-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label="Menü"><Icon name="menu" /></button>
          <span className="crumb">{detail.data?.name}</span>
          <span className="crumb">/</span>
          <span>{current?.label ?? 'Übersicht'}</span>
        </div>
        <div className="content">
          <div className="content-inner">
            {detail.loading && !detail.data && <Spinner />}
            {detail.error && (
              <Notice tone="danger">
                {detail.error} <Link to="/servers">Zur Serverauswahl</Link>
              </Notice>
            )}
            {detail.data && (
              <GuildContext.Provider value={{ guild: detail.data, reload: detail.reload }}>
                <DirtyContext.Provider value={{ setGuard }}>
                  <Outlet key={guildId} />
                </DirtyContext.Provider>
              </GuildContext.Provider>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
