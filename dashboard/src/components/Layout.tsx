import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ApiGuildDetail, ApiGuildSummary } from '../../../src/web/apiTypes';
import { DirtyContext, GuildContext, useApi, UserContext } from '../api';
import { Icon, ICON_PATHS } from '../icons';
import { GROUPS, MODULES } from '../modules/registry';
import { Spinner, Notice } from './ui';
import { NexoLogo } from './NexoLogo';
import { PageBackdrop } from './Backdrop';

gsap.registerPlugin(useGSAP);

/**
 * Scrolls the menu (and only the menu) so its active entry is visible. scrollIntoView would also scroll the page
 * and any page embedding the dashboard in a frame.
 */
export function keepActiveVisible(nav: HTMLElement | null) {
  const active = nav?.querySelector('[aria-current="page"]');
  if (!nav || !active) return;
  const menu = nav.getBoundingClientRect();
  const entry = active.getBoundingClientRect();
  if (entry.top < menu.top) nav.scrollTop -= menu.top - entry.top;
  else if (entry.bottom > menu.bottom) nav.scrollTop += entry.bottom - menu.bottom;
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function guildInitials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3);
}

export function GuildIcon({ guild, className = '' }: { guild: { name: string; iconUrl: string | null }; className?: string }) {
  return guild.iconUrl
    ? <img src={guild.iconUrl} alt="" className={`object-cover ${className}`} />
    : <span className={`grid place-items-center bg-raised font-semibold text-ink ${className}`}>{guildInitials(guild.name)}</span>;
}

/** Discord-style server column: Nexo button (server overview) plus every server Nexo is on. Servers only. */
export function ServerRail({ guilds, activeId }: { guilds: ApiGuildSummary[]; activeId?: string }) {
  const navigate = useNavigate();
  const onOverview = useLocation().pathname.replace(/\/$/, '') === '/servers';
  const item = 'group relative grid h-11 w-11 place-items-center overflow-hidden rounded-[22px] bg-surface transition-all duration-200 hover:rounded-[14px]';
  const pill = (active: boolean) => `rail-groove absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r transition-all duration-200 ${active ? 'h-8' : 'h-0 group-hover:h-4'}`;
  return (
    <nav className="flex w-[72px] shrink-0 flex-col items-center gap-2.5 overflow-y-auto border-r border-white/[.05] bg-rail py-4" aria-label="Server">
      <div className="relative flex w-full justify-center">
        <span className={pill(onOverview)} />
        <button className={`${item} cursor-pointer border-0 bg-surface p-0 ring-1 ring-white/[.06] hover:ring-accent/40`} title="Alle Server" onClick={() => navigate('/servers')}>
          <NexoLogo className="w-9 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" animated={false} />
        </button>
      </div>
      {/* Divider between "Alle Server" and the servers: the same groove as the open-server marker. */}
      <div className="rail-groove rail-line my-1 h-px w-7 shrink-0 rounded-full" />
      {guilds.filter((g) => g.botPresent).map((guild) => {
        const active = guild.id === activeId;
        return (
          <div key={guild.id} className="relative flex w-full justify-center">
            <span className={pill(active)} />
            <button title={guild.name} onClick={() => navigate(`/servers/${guild.id}`)}
              className={`${item} cursor-pointer border-0 p-0 ${active ? 'rounded-[14px] ring-1 ring-white/25' : 'opacity-80 hover:opacity-100'}`}>
              <GuildIcon guild={guild} className="h-full w-full" />
            </button>
          </div>
        );
      })}
    </nav>
  );
}

/** Off-canvas on small screens, static from lg: server rail and the area navigation side by side. */
export function SideMenu({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <>
      {open && <button aria-label="Menü schließen" className="fixed inset-0 z-30 border-0 bg-black/60 lg:hidden" onClick={onClose} />}
      <div className={`fixed inset-y-0 left-0 z-40 flex transition-transform duration-300 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        {children}
      </div>
    </>
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
    <div className={`flex items-center gap-2.5 ${compact ? '' : 'm-3 rounded-2xl border border-white/[.06] bg-surface px-3 py-2.5'}`}>
      <Link to="/me" title="Mein Profil öffnen" className="-m-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1 text-body transition-colors hover:bg-white/[.04] hover:no-underline">
        <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full ring-1 ring-white/15" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium text-ink">{user.globalName ?? user.username}</span>
          <span className="block truncate text-xs text-mute">Mein Profil</span>
        </span>
      </Link>
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

  // Sliding highlight behind the active navigation entry: slides on navigation, snaps when the layout shifts
  // (styles/fonts arriving, window resize).
  const placeMarker = useCallback((animate: boolean) => {
    const active = navRef.current?.querySelector<HTMLElement>('a[aria-current="page"]');
    const marker = markerRef.current;
    if (!marker) return;
    if (!active) { gsap.set(marker, { autoAlpha: 0 }); return; }
    const target = { y: active.offsetTop, height: active.offsetHeight, autoAlpha: 1 };
    if (animate && !reducedMotion() && marker.dataset.placed === '1') gsap.to(marker, { ...target, duration: 0.35, ease: 'power3.out', overwrite: true });
    else gsap.set(marker, { ...target, overwrite: true });
    marker.dataset.placed = '1';
  }, []);
  useGSAP(() => placeMarker(true), { dependencies: [location.pathname, placeMarker] });
  // Keep the active entry visible when the menu is taller than the window.
  useEffect(() => keepActiveVisible(navRef.current), [location.pathname, detail.data]);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(() => placeMarker(false));
    Array.from(nav.children).forEach((child) => observer.observe(child));
    void document.fonts?.ready.then(() => placeMarker(false));
    return () => observer.disconnect();
  }, [placeMarker]);

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
  const navLink = 'relative z-10 flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors hover:no-underline';

  return (
    <div className="flex h-full bg-canvas">
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
        <ServerRail guilds={guilds.data ?? []} activeId={guildId} />
        <aside className="flex w-[264px] flex-col border-r border-white/[.05] bg-panel">
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[.05] px-4">
            {detail.data && <GuildIcon guild={detail.data} className="h-9 w-9 shrink-0 rounded-xl ring-1 ring-white/10" />}
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[14px] font-semibold text-ink">{detail.data?.name ?? 'Server'}</div>
              {detail.data && <div className="text-xs text-mute">{detail.data.memberCount.toLocaleString('de-DE')} Mitglieder</div>}
            </div>
          </div>
          <nav ref={navRef} className="nav-scroll relative flex-1 overflow-y-auto px-3 py-3" onClickCapture={guardClick}>
            <div ref={markerRef} className="invisible absolute left-3 right-3 top-0 rounded-xl border border-white/[.06] bg-white/[.05] before:absolute before:-left-3 before:top-1/2 before:h-4 before:w-[2px] before:-translate-y-1/2 before:rounded-r before:bg-accent" />
            <NavLink end to={`/servers/${guildId}`} className={({ isActive }) => `${navLink} ${isActive ? 'text-ink' : 'text-mute hover:bg-white/[.03] hover:text-ink'}`}>
              <Icon name="home" size={18} /> Übersicht
            </NavLink>
            {GROUPS.map((group) => (
              <div className="mt-5" key={group}>
                <div className="mb-1 px-3 text-[11.5px] font-medium text-faint">{group}</div>
                {MODULES.filter((m) => m.group === group).map((m) => (
                  <NavLink key={m.id} to={`/servers/${guildId}/${m.id}`}
                    className={({ isActive }) => `${navLink} ${isActive ? 'text-ink' : 'text-mute hover:bg-white/[.03] hover:text-ink'}`}>
                    <Icon name={m.icon} size={18} /> {m.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <UserPanel />
        </aside>
      </SideMenu>

      <main className="relative flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[.05] bg-canvas/80 px-4 backdrop-blur-md md:px-8">
          <button className="icon-btn lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label="Menü"><Icon name="menu" /></button>
          <span className="max-w-[40vw] truncate text-sm text-mute">{detail.data?.name}</span>
          <span className="text-faint">/</span>
          <span className="truncate text-sm font-medium text-ink">{current?.label ?? 'Übersicht'}</span>
        </header>
        <div className="relative flex-1 overflow-y-auto px-4 pb-32 pt-9 md:px-10">
          <PageBackdrop art={ICON_PATHS[current?.icon ?? 'home']} />
          <div ref={pageRef} className="relative mx-auto max-w-[1040px]">
            {detail.loading && !detail.data && <Spinner />}
            {detail.error && (
              <Notice tone="danger" onRetry={detail.reload}>
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
