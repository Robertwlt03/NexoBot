import { Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import type { ApiUser } from '../../src/web/apiTypes';
import { api, ToastContext, UserContext, type Toast } from './api';
import { GuildLayout } from './components/Layout';
import { Spinner } from './components/ui';
import { MODULES } from './modules/registry';
import { Landing } from './pages/Landing';
import { Overview } from './pages/Overview';
import { ServerPicker } from './pages/ServerPicker';

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

  if (user === undefined) return <Spinner />;

  return (
    <UserContext.Provider value={user}>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <div className="toasts">{toasts.map((t) => <div key={t.id} className={`toast${t.error ? ' error' : ''}`}>{t.text}</div>)}</div>
      </ToastContext.Provider>
    </UserContext.Provider>
  );
}
