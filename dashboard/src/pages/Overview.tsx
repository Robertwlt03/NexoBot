import { useRef } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { CHANNEL_TYPES } from '../../../src/web/apiTypes';
import { useGuild } from '../api';
import { GuildIcon } from '../components/Layout';
import { Icon, IconTile } from '../icons';
import { GROUPS, MODULES } from '../modules/registry';

gsap.registerPlugin(useGSAP);

export function Overview() {
  const { guild } = useGuild();
  const root = useRef<HTMLDivElement>(null);
  const count = (...types: number[]) => guild.channels.filter((c) => types.includes(c.type)).length;
  const stats = [
    { label: 'Mitglieder', value: guild.memberCount },
    { label: 'Textkanäle', value: count(CHANNEL_TYPES.text, CHANNEL_TYPES.announcement, CHANNEL_TYPES.forum) },
    { label: 'Sprachkanäle', value: count(CHANNEL_TYPES.voice, CHANNEL_TYPES.stage) },
    { label: 'Rollen', value: guild.roles.length },
  ];

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.js-hero', { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out', clearProps: 'transform' });
      gsap.fromTo('.js-tile', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.035, ease: 'power3.out', delay: 0.15, clearProps: 'transform' });
      // Count the stats up from zero.
      gsap.utils.toArray<HTMLElement>('.js-count').forEach((el) => {
        const target = Number(el.dataset.value);
        const state = { n: 0 };
        gsap.to(state, { n: target, duration: 1.1, ease: 'power2.out', delay: 0.2, onUpdate: () => { el.textContent = Math.round(state.n).toLocaleString('de-DE'); } });
      });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [guild.id], revertOnUpdate: true });

  return (
    <div ref={root}>
      <section className="js-hero relative mb-10 overflow-hidden rounded-3xl border border-white/[.07] bg-[#1a1b1f] p-6 md:p-8">
        {guild.iconUrl && <img src={guild.iconUrl} alt="" className="pointer-events-none absolute -right-10 -top-16 h-72 w-72 scale-125 object-cover opacity-25 blur-3xl" />}
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-blurple/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <GuildIcon guild={guild} className="h-20 w-20 rounded-3xl text-2xl ring-4 ring-white/10" />
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[.14em] text-nexo-cyan">Übersicht</p>
            <h1 className="mt-1 truncate text-3xl">{guild.name}</h1>
          </div>
        </div>
        <dl className="relative m-0 mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/[.06] bg-black/20 px-4 py-3">
              <dt className="js-count font-display text-2xl font-semibold text-white" data-value={stat.value}>{stat.value.toLocaleString('de-DE')}</dt>
              <dd className="m-0 text-sm text-dc-muted">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {GROUPS.map((group) => (
        <section key={group} className="mb-9">
          <h2 className="mb-3 font-sans text-[11.5px] font-bold uppercase tracking-[.14em] text-dc-muted">{group}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MODULES.filter((m) => m.group === group).map((m) => (
              <Link key={m.id} to={m.id}
                className="js-tile group relative flex items-start gap-3.5 overflow-hidden rounded-2xl border border-white/[.07] bg-[#1a1b1f] p-4 text-dc-text transition duration-300 hover:-translate-y-0.5 hover:border-nexo-violet/50 hover:bg-[#1f2025] hover:no-underline">
                <span className="transition duration-300 group-hover:-rotate-6 group-hover:scale-105"><IconTile name={m.icon} /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px]">{m.label}</h3>
                  <p className="mt-0.5 text-[13px] leading-snug text-dc-muted">{m.description}</p>
                </div>
                <span className="mt-1 -translate-x-1 text-dc-muted opacity-0 transition duration-300 group-hover:translate-x-0 group-hover:text-nexo-cyan group-hover:opacity-100">
                  <span className="inline-block rotate-180"><Icon name="arrowLeft" size={16} /></span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
