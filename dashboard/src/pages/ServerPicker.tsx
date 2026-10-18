import { useContext, useRef } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ApiGuildSummary } from '../../../src/web/apiTypes';
import { useApi, UserContext } from '../api';
import { GuildIcon, UserPanel } from '../components/Layout';
import { NexoLogo } from '../components/NexoLogo';
import { Empty, Notice, PageHeader, Spinner } from '../components/ui';
import { Icon } from '../icons';

gsap.registerPlugin(useGSAP);

export function ServerPicker() {
  const user = useContext(UserContext);
  const { data, error, loading, reload } = useApi<ApiGuildSummary[]>('/guilds');
  const guilds = data ?? [];
  const root = useRef<HTMLDivElement>(null);
  const refresh = async () => { await fetch('/dashboard/api/guilds?refresh=1', { credentials: 'same-origin' }); reload(); };

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
    <div ref={root} className="min-h-full bg-canvas">
      <header className="sticky top-0 z-20 border-b border-white/[.05] bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 md:px-8">
          <Link to="/servers" className="flex items-center gap-2.5 text-ink hover:no-underline">
            <NexoLogo className="h-9 w-auto" animated={false} />
            <span className="font-display text-lg font-semibold tracking-tight">Nexo</span>
          </Link>
          <div className="ml-auto w-[240px] max-w-[60vw]"><UserPanel compact /></div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-12 md:px-8">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[640px] -translate-x-1/2 rounded-full bg-accent/[.07] blur-[120px]" />
        <div className="relative">
          <PageHeader
            kicker="Serverauswahl"
            title={`Hey ${user?.globalName ?? user?.username ?? ''}, wo legen wir los?`}
            description={<>Hier siehst du alle Server, auf denen du „Server verwalten“ darfst.{data ? ` Nexo ist auf ${active} von ${guilds.length} aktiv.` : ''}</>}
            actions={<button className="btn btn-secondary" onClick={refresh}><Icon name="refresh" size={16} /> Aktualisieren</button>}
          />
        </div>

        <div className="relative mt-4">
          {loading && !data && <div className="center"><Spinner /></div>}
          {error && <Notice tone="danger">{error}</Notice>}
          {data && guilds.length === 0 && <Empty title="Keine Server gefunden">Du brauchst auf einem Server die Berechtigung „Server verwalten“.</Empty>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guilds.map((guild) => (
              <article key={guild.id} className="js-server group relative overflow-hidden rounded-[20px] border border-white/[.06] bg-surface transition duration-300 hover:-translate-y-0.5 hover:border-white/[.14]">
                <div className="relative h-24 overflow-hidden">
                  {guild.iconUrl
                    ? <img src={guild.iconUrl} alt="" className="absolute inset-0 h-full w-full scale-150 object-cover opacity-30 blur-2xl saturate-[.8] transition duration-500 group-hover:scale-[1.7] group-hover:opacity-40" />
                    : <div className="absolute inset-0 bg-white/[.03]" />}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface" />
                </div>
                <div className="relative -mt-10 px-5 pb-5">
                  <GuildIcon guild={guild} className="h-14 w-14 rounded-2xl text-lg ring-4 ring-surface" />
                  <div className="mt-3 flex items-center gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-[15px] font-medium">{guild.name}</h3>
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
