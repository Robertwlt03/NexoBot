import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import type { ApiUser } from '../../src/web/apiTypes';
import { api, ToastContext, UserContext, type Toast } from './api';
import { ThemeProvider } from './theme';
import { GuildLayout } from './components/Layout';
import { Spinner } from './components/ui';
import { MeLayout } from './me/MeLayout';
import { MODULES } from './modules/registry';
import { Landing } from './pages/Landing';
import { Overview } from './pages/Overview';
import { ServerPicker } from './pages/ServerPicker';

// Member area (any logged-in user) and owner area; loaded on demand.
const MEMBER_PAGES = [
  ['/me', lazy(() => import('./me/ProfilePage'))],
  ['/me/shop', lazy(() => import('./me/ShopPage'))],
  ['/me/blackmarket', lazy(() => import('./me/BlackMarketPage'))],
  ['/me/inventar', lazy(() => import('./me/InventoryPage'))],
  ['/me/verlauf', lazy(() => import('./me/HistoryPage'))],
  ['/me/ranglisten', lazy(() => import('./me/RankingsPage'))],
  ['/me/erfolge', lazy(() => import('./me/AchievementsPage'))],
  ['/me/saison', lazy(() => import('./me/SeasonPage'))],
  ['/me/design', lazy(() => import('./me/DesignPage'))],
  ['/owner', lazy(() => import('./owner/OverviewPage'))],
  ['/owner/artikel', lazy(() => import('./owner/ItemsPage'))],
  ['/owner/events', lazy(() => import('./owner/EventsPage'))],
  ['/owner/blackmarket', lazy(() => import('./owner/BlackMarketPage'))],
  ['/owner/bernis', lazy(() => import('./owner/GrantPage'))],
  ['/owner/einstellungen', lazy(() => import('./owner/SettingsPage'))],
] as const;

export function App() {
  const [user, setUser] = useState<ApiUser | null | undefined>(undefined);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    api<ApiUser>('/me').then(setUser).catch(() => setUser(null));
  }, []);

  const toast = useCallback((text: string, error?: boolean) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, text, error }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000);
  }, []);

  if (user === undefined) return <div className="grid h-full place-items-center bg-canvas"><Spinner /></div>;

  return (
    <UserContext.Provider value={user}>
      <ThemeProvider loggedIn={Boolean(user)}>
      <ToastContext.Provider value={toast}>
        <BrowserRouter basename="/dashboard">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/servers" element={user ? <ServerPicker /> : <Navigate to="/" replace />} />
            <Route path="/servers/:guildId" element={user ? <GuildLayout /> : <Navigate to="/" replace />}>
              <Route index element={<Overview />} />
              {MODULES.map((m) => (
                <Route key={m.id} path={m.id} element={<Suspense fallback={<Spinner />}><m.component /></Suspense>} />
              ))}
            </Route>
            <Route element={user ? <MeLayout /> : <Navigate to="/" replace />}>
              {MEMBER_PAGES.map(([path, Page]) => <Route key={path} path={path} element={<Page />} />)}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <div className="toasts">{toasts.map((t) => <ToastItem key={t.id} toast={t} />)}</div>
      </ToastContext.Provider>
      </ThemeProvider>
    </UserContext.Provider>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.from(ref.current, { x: 40, autoAlpha: 0, duration: 0.4, ease: 'back.out(1.6)' });
  });
  return <div ref={ref} className={`toast${toast.error ? ' error' : ''}`}>{toast.text}</div>;
}
