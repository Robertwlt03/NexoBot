import { useContext, useRef } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ApiGuildSummary } from '../../../src/web/apiTypes';
import { useApi, UserContext } from '../api';
import { GuildIcon, UserPanel } from '../components/Layout';
import { NexoLogo } from '../components/NexoLogo';
import { PageBackdrop } from '../components/Backdrop';
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
    <div ref={root} className="relative min-h-full bg-canvas">
      <header className="sticky top-0 z-20 border-b border-white/[.05] bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 md:px-8">
          <Link to="/servers" className="flex items-center gap-2.5 text-ink hover:no-underline">
            <NexoLogo className="h-9 w-auto" animated={false} />
            <span className="font-display text-lg font-semibold tracking-tight">Nexo</span>
          </Link>
          <div className="ml-auto w-[240px] max-w-[60vw]"><UserPanel compact /></div>
        </div>
      </header>

      <PageBackdrop column={1152} />
      <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-12 md:px-8">
        <div className="relative">
          <PageHeader
            kicker="Serverauswahl"
            title={`Hey ${user?.globalName ?? user?.username ?? ''}, wo legen wir los?`}
            description={data && guilds.length === 0
              ? 'Dein Profil, den Shop und die Ranglisten öffnest du oben rechts über deinen Namen – ganz ohne eigenen Server.'
              : <>Hier siehst du alle Server, auf denen du „Server verwalten“ darfst.{data ? ` Nexo ist auf ${active} von ${guilds.length} aktiv.` : ''}</>}
            actions={<button className="btn btn-secondary" onClick={refresh}><Icon name="refresh" size={16} /> Aktualisieren</button>}
          />
        </div>

        <div className="relative mt-4">
          {loading && !data && <Spinner />}
          {error && <Notice tone="danger" onRetry={reload}>{error}</Notice>}
          {data && guilds.length === 0 && <Empty title="Keine Server zum Verwalten">Server erscheinen hier, sobald du auf einem die Berechtigung „Server verwalten“ hast. Dein Profil erreichst du jederzeit oben rechts über deinen Namen.</Empty>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guilds.map((guild) => (
              <article key={guild.id} className="js-server group relative overflow-hidden rounded-[20px] border border-white/[.06] bg-surface transition duration-300 hover:-translate-y-0.5 hover:border-white/[.14]">
                {/* Fades out through a mask instead of a gradient in the card colour: no hard bottom edge that could show
                    as a line while the card lifts on hover. */}
                <div className="relative h-24 overflow-hidden" style={{ maskImage: 'linear-gradient(to bottom, #000 15%, transparent)' }}>
                  {guild.iconUrl
                    ? <img src={guild.iconUrl} alt="" className="absolute inset-0 h-full w-full scale-150 object-cover opacity-30 blur-2xl saturate-[.8] transition duration-500 group-hover:scale-[1.7] group-hover:opacity-40" />
                    : <div className="absolute inset-0 bg-white/[.03]" />}
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
          {data && guilds.length > 0 && (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Link to="/me" className="flex items-start gap-4 rounded-[20px] border border-white/[.06] bg-surface p-5 text-ink transition hover:border-white/[.14] hover:no-underline">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><Icon name="users" size={20} /></span>
                <span><b className="block text-[15px] font-medium">Mein Profil</b><span className="text-[13.5px] text-mute">Profilkarte, Shop, Tagesbonus und Saison – auf allen Servern gleich.</span></span>
              </Link>
              <div className="flex items-start gap-4 rounded-[20px] border border-dashed border-white/[.1] p-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[.04] text-mute"><Icon name="settings" size={20} /></span>
                <span><b className="block text-[15px] font-medium text-ink">Server fehlt?</b><span className="text-[13.5px] text-mute">Hier stehen Server, auf denen du „Server verwalten“ darfst. Nach einer Rechte-Änderung hilft „Aktualisieren“.</span></span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
