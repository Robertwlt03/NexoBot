// Shell of the member area (/me, any logged-in user) and the owner area (/owner, isOwner only).
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ApiGuildSummary } from '../../../src/web/apiTypes';
import type { CosmeticItem } from '../../../src/shared/cosmetics';
import type { BlackMarketResponse, MeProfileResponse, ShopResponse } from '../../../src/web/dto/profile';
import { DirtyContext, useApi, useUser } from '../api';
import { keepActiveVisible, ServerRail, SideMenu, UserPanel } from '../components/Layout';
import { PageBackdrop } from '../components/Backdrop';
import { Notice, Spinner } from '../components/ui';
import { Icon } from '../icons';
import { MeContext, reducedMotion, useCountUp } from './api';
import type { MeContextValue } from './api';
import { Bernis, GLYPHS, Glyph } from './visuals';
import { CoinFlight, useCoinFlight, useCoinMilestone } from './CoinFlight';
import { Celebration } from './Celebration';
import { CoinIcon } from '../components/CoinIcon';
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
  { to: '/me/saison', label: 'Saison', icon: 'star' },
  { to: '/me/design', label: 'Dashboard-Design', icon: 'palette' },
];
const OWNER_NAV: NavEntry[] = [
  { to: '/owner', label: 'Übersicht', icon: 'chart' },
  { to: '/owner/artikel', label: 'Artikel', icon: 'tag' },
  { to: '/owner/events', label: 'Events', icon: 'calendar' },
  { to: '/owner/blackmarket', label: 'Black Market', icon: 'shuffle' },
  { to: '/owner/bernis', label: 'Bernis vergeben', icon: 'gift' },
  { to: '/owner/einstellungen', label: 'Einstellungen', icon: 'sliders' },
];

/** "Deine erste Goldmünze!" once the balance rises past a coin milestone (one instance for the whole layout). */
function CoinMilestone({ balance }: { balance: number }) {
  const user = useUser();
  const { milestone, close } = useCoinMilestone(balance, user?.id);
  if (!milestone) return null;
  return (
    <Celebration tint={milestone.tint} kicker="Neue Münze" title={milestone.title} text={milestone.text} onClose={close}
      tile={<span className="game-tile-field grid aspect-square place-items-center rounded-[22px] ring-1 ring-white/10" style={{ '--tile': milestone.tint } as CSSProperties}><CoinIcon tier={milestone.tier} size={128} /></span>}
      actions={<button type="button" className="btn btn-primary" onClick={close}>Weiter</button>} />
  );
}

function WalletPill({ balance }: { balance: number }) {
  const shown = useCountUp(balance);
  const pill = useRef<HTMLSpanElement>(null);
  const { flight, done } = useCoinFlight(balance, pill);
  return (
    <>
      <span ref={pill} className="inline-flex items-center gap-1.5 rounded-full border border-white/[.08] bg-white/[.04] px-3 py-1 text-[13px] font-medium text-ink">
        <Bernis amount={shown} nowrap max={2} />
      </span>
      <CoinFlight flight={flight} pill={pill} onDone={done} />
    </>
  );
}

export function MeLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const guilds = useApi<ApiGuildSummary[]>('/guilds');
  const profile = useApi<MeProfileResponse>('/me/profile');
  const shop = useApi<ShopResponse>('/me/shop');
  const blackMarket = useApi<BlackMarketResponse>('/me/blackmarket');
  const pageRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const setProfile = profile.setData;
  const { reload: reloadShopData } = shop;
  const { reload: reloadBlackMarket } = blackMarket;

  const setGuard = useCallback((value: boolean) => setDirty(value), []);
  useEffect(() => setMenuOpen(false), [location.pathname]);
  // Keep the active entry visible when the menu is taller than the window.
  useEffect(() => keepActiveVisible(navRef.current), [location.pathname]);
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
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)}>
        <ServerRail guilds={guilds.data ?? []} />
        <aside className="flex w-[264px] flex-col border-r border-white/[.05] bg-panel">
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[.05] px-4">
            <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">Mein Profil</div>
            {profile.data && <WalletPill balance={profile.data.wallet.balance} />}
          </div>
          <nav ref={navRef} className="nav-scroll flex-1 overflow-y-auto px-3 py-3" onClickCapture={guardClick}>
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
          </nav>
          <UserPanel />
        </aside>
      </SideMenu>

      <main className="relative flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[.05] bg-canvas/80 px-4 backdrop-blur-md md:px-8">
          <button className="icon-btn lg:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label="Menü"><Icon name="menu" /></button>
          {/* Phones show only the page name, so the wallet pill has room. */}
          <span className="text-sm text-mute max-sm:hidden">{isOwnerArea ? 'Owner' : 'Mein Profil'}</span>
          <span className="text-faint max-sm:hidden">/</span>
          <span className="truncate text-sm font-medium text-ink">{current?.label ?? 'Übersicht'}</span>
          {profile.data && <span className="ml-auto lg:hidden"><WalletPill balance={profile.data.wallet.balance} /></span>}
          {profile.data && <CoinMilestone balance={profile.data.wallet.balance} />}
        </header>
        <div className="relative flex-1 overflow-y-auto px-4 pb-32 pt-9 md:px-10">
          <PageBackdrop art={current && GLYPHS[current.icon]} label={current?.label} column={1100} />
          <div ref={pageRef} className="relative mx-auto max-w-[1100px]">
            {profile.loading && !profile.data && <Spinner />}
            {profile.error && !profile.data && <Notice tone="danger" onRetry={profile.reload}>{profile.error}</Notice>}
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
