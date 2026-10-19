// Shell of the member area (/me, any logged-in user) and the owner area (/owner, isOwner only).
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ApiGuildSummary } from '../../../src/web/apiTypes';
import type { CosmeticItem } from '../../../src/shared/cosmetics';
import type { BlackMarketResponse, MeProfileResponse, ShopResponse } from '../../../src/web/dto/profile';
import { DirtyContext, useApi, useUser } from '../api';
import { ServerRail, UserPanel } from '../components/Layout';
import { Notice, Spinner } from '../components/ui';
import { Icon } from '../icons';
import { MeContext, reducedMotion, useCountUp } from './api';
import type { MeContextValue } from './api';
import { Glyph, Kristalle } from './visuals';
import type { GlyphName } from './visuals';

interface NavEntry { to: string; label: string; icon: GlyphName }

const MEMBER_NAV: NavEntry[] = [
  { to: '/me', label: 'Profil', icon: 'user' },
  { to: '/me/shop', label: 'Shop', icon: 'bag' },
  { to: '/me/blackmarket', label: 'Black Market', icon: 'incognito' },
  { to: '/me/inventar', label: 'Inventar', icon: 'box' },
  { to: '/me/verlauf', label: 'Verlauf', icon: 'clock' },
  { to: '/me/ranglisten', label: 'Ranglisten', icon: 'trophy' },
  { to: '/me/erfolge', label: 'Erfolge', icon: 'medal' },
  { to: '/me/design', label: 'Dashboard-Design', icon: 'palette' },
];
const OWNER_NAV: NavEntry[] = [
  { to: '/owner', label: 'Übersicht', icon: 'chart' },
  { to: '/owner/artikel', label: 'Artikel', icon: 'tag' },
  { to: '/owner/events', label: 'Events', icon: 'calendar' },
  { to: '/owner/blackmarket', label: 'Black Market', icon: 'shuffle' },
  { to: '/owner/kristalle', label: 'Kristalle vergeben', icon: 'diamond' },
  { to: '/owner/einstellungen', label: 'Einstellungen', icon: 'sliders' },
];

function WalletPill({ balance }: { balance: number }) {
  const shown = useCountUp(balance);
  return (
    <Link to="/me/verlauf" title="Dein Kontostand" className="inline-flex items-center gap-1.5 rounded-full border border-white/[.08] bg-white/[.04] px-3 py-1 text-[13px] font-medium text-ink hover:border-white/20 hover:no-underline">
      <Kristalle amount={shown} />
    </Link>
  );
}

export function MeLayout() {
  const user = useUser();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const guilds = useApi<ApiGuildSummary[]>('/guilds');
  const profile = useApi<MeProfileResponse>('/me/profile');
  const shop = useApi<ShopResponse>('/me/shop');
  const blackMarket = useApi<BlackMarketResponse>('/me/blackmarket');
  const pageRef = useRef<HTMLDivElement>(null);
  const setProfile = profile.setData;
  const { reload: reloadShopData } = shop;
  const { reload: reloadBlackMarket } = blackMarket;

  const setGuard = useCallback((value: boolean) => setDirty(value), []);
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useGSAP(() => {
    if (!pageRef.current || reducedMotion()) return;
    gsap.fromTo(pageRef.current, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: 'power2.out', clearProps: 'transform' });
  }, { dependencies: [location.pathname] });

  // Same unsaved-changes guard as the guild area: block navigation and shake the save bar.
  const guardClick = (event: MouseEvent) => {
    if (!dirty) return;
    event.preventDefault();
    const bar = document.getElementById('save-bar');
    if (!bar) return;
    bar.classList.add('shake');
    gsap.fromTo(bar, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.3)', onComplete: () => bar.classList.remove('shake') });
  };

  const catalog = useApi<CosmeticItem[]>('/me/items');
  const items = useMemo(() => new Map((catalog.data ?? []).map((item) => [item.id, item])), [catalog.data]);
  const { reload: reloadCatalog } = catalog;
  const context = useMemo((): MeContextValue | null => profile.data && {
    me: profile.data,
    setMe: (update) => setProfile((prev) => (prev ? update(prev) : prev)),
    shop: shop.data,
    blackMarket: blackMarket.data,
    items,
    reloadShop: () => { reloadShopData(); reloadBlackMarket(); reloadCatalog(); },
  }, [profile.data, setProfile, shop.data, blackMarket.data, items, reloadShopData, reloadBlackMarket, reloadCatalog]);

  const isOwnerArea = location.pathname.startsWith('/owner');
  const isOwner = profile.data?.isOwner ?? false;
  const current = [...MEMBER_NAV, ...OWNER_NAV].find((entry) => entry.to === location.pathname.replace(/\/$/, ''));
  const navLink = 'relative flex items-center gap-3 rounded-xl border px-3 py-2 text-[14px] font-medium transition-colors hover:no-underline';
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `${navLink} ${isActive ? 'border-white/[.06] bg-white/[.05] text-ink before:absolute before:-left-3 before:top-1/2 before:h-4 before:w-[2px] before:-translate-y-1/2 before:rounded-r before:bg-accent' : 'border-transparent text-mute hover:bg-white/[.03] hover:text-ink'}`;

  return (
    <div className="flex h-full bg-canvas">
      <ServerRail guilds={guilds.data ?? []} />

      {menuOpen && <button aria-label="Menü schließen" className="fixed inset-0 z-30 border-0 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r border-white/[.05] bg-panel transition-transform duration-300 lg:static lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[.05] px-4">
          {user && <img src={user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full ring-1 ring-white/10" />}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[14px] font-semibold text-ink">Mein Profil</div>
            <div className="truncate text-xs text-mute">{user?.globalName ?? user?.username}</div>
          </div>
          {profile.data && <WalletPill balance={profile.data.wallet.balance} />}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3" onClickCapture={guardClick}>
          {MEMBER_NAV.map((entry) => (
            <NavLink key={entry.to} end to={entry.to} className={navClass}><Glyph name={entry.icon} size={18} /> {entry.label}</NavLink>
          ))}
          {isOwner && (
            <div className="mt-5">
              <div className="mb-1 px-3 text-[11.5px] font-medium text-faint">Owner</div>
              {OWNER_NAV.map((entry) => (
                <NavLink key={entry.to} end to={entry.to} className={navClass}><Glyph name={entry.icon} size={18} /> {entry.label}</NavLink>
              ))}
            </div>
          )}
          <div className="mt-5 border-t border-white/[.05] pt-3">
            <Link to="/servers" className={`${navLink} border-transparent text-mute hover:bg-white/[.03] hover:text-ink`}><Icon name="arrowLeft" size={18} /> Server verwalten</Link>
          </div>
        </nav>
        <UserPanel />
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[.05] bg-canvas/80 px-4 backdrop-blur-md md:px-8">
          <button className="icon-btn lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label="Menü"><Icon name="menu" /></button>
          <Link to={isOwnerArea ? '/owner' : '/me'} className="text-sm text-mute hover:text-ink hover:no-underline">{isOwnerArea ? 'Owner' : 'Mein Profil'}</Link>
          <span className="text-faint">/</span>
          <span className="truncate text-sm font-medium text-ink">{current?.label ?? 'Übersicht'}</span>
          {profile.data && <span className="ml-auto lg:hidden"><WalletPill balance={profile.data.wallet.balance} /></span>}
        </header>
        <div className="flex-1 overflow-y-auto px-4 pb-32 pt-9 md:px-10">
          <div ref={pageRef} className="mx-auto max-w-[1100px]">
            {profile.loading && !profile.data && <Spinner />}
            {profile.error && !profile.data && <Notice tone="danger">{profile.error}</Notice>}
            {context && (isOwnerArea && !isOwner
              ? <Notice tone="danger">Dieser Bereich ist nur für die Betreiber von Nexo. <Link to="/me">Zu deinem Profil</Link></Notice>
              : (
                <MeContext.Provider value={context}>
                  <DirtyContext.Provider value={{ setGuard }}>
                    <Suspense fallback={<Spinner />}><Outlet /></Suspense>
                  </DirtyContext.Provider>
                </MeContext.Provider>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
