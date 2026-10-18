import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ApiGuildDetail, ApiGuildSummary } from '../../../src/web/apiTypes';
import { DirtyContext, GuildContext, useApi, UserContext } from '../api';
import { Icon } from '../icons';
import { GROUPS, MODULES } from '../modules/registry';
import { Spinner, Notice } from './ui';
import { NexoLogo } from './NexoLogo';

gsap.registerPlugin(useGSAP);

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function guildInitials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3);
}

export function GuildIcon({ guild, className = '' }: { guild: { name: string; iconUrl: string | null }; className?: string }) {
  return guild.iconUrl
    ? <img src={guild.iconUrl} alt="" className={`object-cover ${className}`} />
    : <span className={`grid place-items-center bg-[#1e1f22] font-semibold text-white ${className}`}>{guildInitials(guild.name)}</span>;
}

/** Discord-style server column: Nexo home button plus every server Nexo is on. */
export function ServerRail({ guilds, activeId }: { guilds: ApiGuildSummary[]; activeId?: string }) {
  const navigate = useNavigate();
  const item = 'group relative grid h-12 w-12 place-items-center overflow-hidden rounded-[24px] bg-[#1a1b1f] transition-all duration-200 hover:rounded-2xl';
  return (
    <nav className="hidden w-[76px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-white/5 bg-[#0c0d0f] py-3 lg:flex" aria-label="Server">
      <button className={`${item} cursor-pointer border-0 bg-[#1a1540] p-0 hover:bg-blurple`} title="Alle Server" onClick={() => navigate('/servers')}>
        <NexoLogo className="w-10 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" animated={false} />
      </button>
      <div className="my-1 h-0.5 w-8 rounded bg-white/10" />
      {guilds.filter((g) => g.botPresent).map((guild) => {
        const active = guild.id === activeId;
        return (
          <div key={guild.id} className="relative flex w-full justify-center">
            <span className={`absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r bg-white transition-all duration-200 ${active ? 'h-10' : 'h-0'}`} />
            <button title={guild.name} onClick={() => navigate(`/servers/${guild.id}`)}
              className={`${item} cursor-pointer border-0 p-0 ${active ? 'rounded-2xl ring-2 ring-blurple/70' : ''}`}>
              <GuildIcon guild={guild} className="h-full w-full" />
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export function UserPanel({ compact = false }: { compact?: boolean }) {
  const user = useContext(UserContext);
  const logout = async () => {
    await fetch('/dashboard/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    location.href = '/dashboard/';
  };
  if (!user) return null;
  return (
    <div className={`flex items-center gap-2.5 ${compact ? '' : 'border-t border-white/5 bg-[#0c0d0f]/60 px-3 py-2.5'}`}>
      <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full ring-2 ring-white/10" />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-semibold text-white">{user.globalName ?? user.username}</div>
        <div className="truncate text-xs text-dc-muted">@{user.username}</div>
      </div>
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
  const navRef = useRef<HTMLElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const setGuard = useCallback((value: boolean) => setDirty(value), []);
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Sliding highlight behind the active navigation entry.
  useGSAP(() => {
    const active = navRef.current?.querySelector<HTMLElement>('a[aria-current="page"]');
    const marker = markerRef.current;
    if (!active || !marker) return;
    const target = { y: active.offsetTop, height: active.offsetHeight, autoAlpha: 1 };
    if (reducedMotion() || marker.dataset.placed !== '1') gsap.set(marker, target);
    else gsap.to(marker, { ...target, duration: 0.35, ease: 'power3.out' });
    marker.dataset.placed = '1';
  }, { dependencies: [location.pathname, Boolean(detail.data)] });

  // Page transition on every module change.
  useGSAP(() => {
    if (!pageRef.current || reducedMotion()) return;
    gsap.fromTo(pageRef.current, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: 'power2.out', clearProps: 'transform' });
  }, { dependencies: [location.pathname] });

  // Block in-app navigation while there are unsaved changes (Discord behaviour: the save bar shakes).
  const guardClick = (event: MouseEvent) => {
    if (!dirty) return;
    event.preventDefault();
    const bar = document.getElementById('save-bar');
    if (!bar) return;
    bar.classList.add('shake');
    gsap.fromTo(bar, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.3)', onComplete: () => bar.classList.remove('shake') });
  };

  const current = MODULES.find((m) => location.pathname.endsWith(`/${m.id}`));
  const navLink = 'relative z-10 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14.5px] font-medium transition-colors hover:no-underline';

  return (
    <div className="flex h-full bg-[#111214]">
      <ServerRail guilds={guilds.data ?? []} activeId={guildId} />

      {menuOpen && <button aria-label="Menü schließen" className="fixed inset-0 z-30 border-0 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-white/5 bg-[#111214] transition-transform duration-300 lg:static lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 px-4">
          {detail.data && <GuildIcon guild={detail.data} className="h-9 w-9 shrink-0 rounded-xl" />}
          <div className="min-w-0 leading-tight">
            <div className="truncate font-semibold text-white">{detail.data?.name ?? 'Server'}</div>
            {detail.data && <div className="text-xs text-dc-muted">{detail.data.memberCount.toLocaleString('de-DE')} Mitglieder</div>}
          </div>
        </div>
        <nav ref={navRef} className="relative flex-1 overflow-y-auto px-3 py-3" onClickCapture={guardClick}>
          <div ref={markerRef} className="invisible absolute left-3 right-3 top-0 rounded-lg bg-white/[.07] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-gradient-to-b before:from-nexo-violet before:to-nexo-cyan" />
          <NavLink end to={`/servers/${guildId}`} className={({ isActive }) => `${navLink} ${isActive ? 'text-white' : 'text-dc-muted hover:bg-white/[.04] hover:text-white'}`}>
            <Icon name="home" size={18} /> Übersicht
          </NavLink>
          {GROUPS.map((group) => (
            <div className="mt-5" key={group}>
              <div className="mb-1.5 px-2.5 text-[11px] font-bold uppercase tracking-[.12em] text-dc-muted/70">{group}</div>
              {MODULES.filter((m) => m.group === group).map((m) => (
                <NavLink key={m.id} to={`/servers/${guildId}/${m.id}`}
                  className={({ isActive }) => `${navLink} ${isActive ? 'text-white [&_svg]:text-nexo-cyan' : 'text-dc-muted hover:bg-white/[.04] hover:text-white'}`}>
                  <Icon name={m.icon} size={18} /> {m.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <UserPanel />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-[#141518] [background-image:var(--dots)] [background-size:24px_24px]">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 bg-[#141518]/80 px-4 backdrop-blur-md md:px-8">
          <button className="icon-btn lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label="Menü"><Icon name="menu" /></button>
          <Link to="/servers" className="hidden text-sm text-dc-muted hover:text-white hover:no-underline sm:inline">Server</Link>
          <span className="hidden text-dc-muted/50 sm:inline">/</span>
          <Link to={`/servers/${guildId}`} className="max-w-[30vw] truncate text-sm text-dc-muted hover:text-white hover:no-underline">{detail.data?.name}</Link>
          <span className="text-dc-muted/50">/</span>
          <span className="truncate text-sm font-semibold text-white">{current?.label ?? 'Übersicht'}</span>
        </header>
        <div className="flex-1 overflow-y-auto px-4 pb-32 pt-8 md:px-10">
          <div ref={pageRef} className="mx-auto max-w-[1040px]">
            {detail.loading && !detail.data && <div className="center"><Spinner /></div>}
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
