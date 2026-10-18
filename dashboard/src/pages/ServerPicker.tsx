import { useContext, useRef } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ApiGuildSummary } from '../../../src/web/apiTypes';
import { useApi, UserContext } from '../api';
import { GuildIcon, UserPanel } from '../components/Layout';
import { NexoLogo } from '../components/NexoLogo';
import { Empty, Notice, Spinner } from '../components/ui';
import { Icon } from '../icons';

gsap.registerPlugin(useGSAP);

export function ServerPicker() {
  const user = useContext(UserContext);
  const { data, error, loading, reload } = useApi<ApiGuildSummary[]>('/guilds');
  const guilds = data ?? [];
  const root = useRef<HTMLDivElement>(null);
  const refresh = async () => { await fetch('/dashboard/api/guilds?refresh=1', { credentials: 'same-origin' }); reload(); };

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.js-head', { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.08, ease: 'power3.out' });
    });
    return () => mm.revert();
  }, { scope: root });

  // Server cards arrive with the data; fromTo + revertOnUpdate so a re-run never starts from a half-faded state.
  useGSAP(() => {
    if (!data?.length) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.js-server', { y: 30, autoAlpha: 0, scale: 0.97 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.55, stagger: 0.07, ease: 'power3.out', clearProps: 'transform' });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [data?.length ?? 0], revertOnUpdate: true });

  const active = guilds.filter((g) => g.botPresent).length;

  return (
    <div ref={root} className="min-h-full bg-[#111214] [background-image:var(--dots)] [background-size:24px_24px]">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[#111214]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 md:px-8">
          <Link to="/servers" className="flex items-center gap-2.5 text-white hover:no-underline">
            <NexoLogo className="h-9 w-auto" animated={false} />
            <span className="font-display text-lg font-semibold tracking-tight">Nexo</span>
          </Link>
          <div className="ml-auto w-[240px] max-w-[60vw]"><UserPanel compact /></div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-12 md:px-8">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[700px] -translate-x-1/2 rounded-full bg-blurple/15 blur-[110px]" />
        <div className="relative flex flex-wrap items-end gap-6">
          <div className="min-w-0 flex-1">
            <p className="js-head text-sm font-semibold uppercase tracking-[.14em] text-nexo-cyan">Serverauswahl</p>
            <h1 className="js-head mt-2 text-3xl md:text-4xl">Hey {user?.globalName ?? user?.username ?? ''}, wo legen wir los?</h1>
            <p className="js-head mt-3 max-w-2xl text-dc-muted">
              Hier siehst du alle Server, auf denen du „Server verwalten“ darfst.
              {data ? ` Nexo ist auf ${active} von ${guilds.length} aktiv.` : ''}
            </p>
          </div>
          <button className="js-head btn btn-secondary" onClick={refresh}><Icon name="refresh" size={16} /> Aktualisieren</button>
        </div>

        <div className="relative mt-10">
          {loading && !data && <div className="center"><Spinner /></div>}
          {error && <Notice tone="danger">{error}</Notice>}
          {data && guilds.length === 0 && <Empty title="Keine Server gefunden">Du brauchst auf einem Server die Berechtigung „Server verwalten“.</Empty>}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {guilds.map((guild) => (
              <article key={guild.id} className="js-server group relative overflow-hidden rounded-2xl border border-white/[.07] bg-[#1a1b1f] transition duration-300 hover:-translate-y-1 hover:border-nexo-violet/50 hover:shadow-[0_24px_50px_-24px_rgba(124,92,255,.6)]">
                <div className="relative h-24 overflow-hidden">
                  {guild.iconUrl
                    ? <img src={guild.iconUrl} alt="" className="absolute inset-0 h-full w-full scale-150 object-cover opacity-60 blur-2xl transition duration-500 group-hover:scale-[1.7]" />
                    : <div className="absolute inset-0 bg-gradient-to-br from-nexo-violet/50 to-nexo-cyan/30" />}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1a1b1f]" />
                </div>
                <div className="relative -mt-10 px-5 pb-5">
                  <GuildIcon guild={guild} className="h-16 w-16 rounded-2xl text-lg ring-4 ring-[#1a1b1f]" />
                  <div className="mt-3 flex items-center gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-base">{guild.name}</h3>
                    {guild.botPresent
                      ? <span className="badge badge-on">Aktiv</span>
                      : <span className="badge badge-off">Nicht eingeladen</span>}
                  </div>
                  <div className="mt-4">
                    {guild.botPresent
                      ? <Link className="btn btn-primary w-full" to={`/servers/${guild.id}`}>Dashboard öffnen</Link>
                      : <a className="btn btn-secondary w-full" href={guild.inviteUrl ?? '#'}><Icon name="plus" size={16} /> Nexo einladen</a>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
