import { useRef } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { CHANNEL_TYPES } from '../../../src/web/apiTypes';
import type { InsightsResponse } from '../../../src/web/dto/insights';
import { useApi, useGuild } from '../api';
import { GuildIcon } from '../components/Layout';
import { PageHeader, Stats } from '../components/ui';
import { Icon, IconTile } from '../icons';
import { GROUPS, MODULES } from '../modules/registry';

gsap.registerPlugin(useGSAP);

export function Overview() {
  const { guild } = useGuild();
  const root = useRef<HTMLDivElement>(null);
  const week = useApi<InsightsResponse>(`/guilds/${guild.id}/insights?range=7`).data;
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
      <PageHeader
        kicker="Übersicht"
        media={<GuildIcon guild={guild} className="h-[52px] w-[52px] shrink-0 rounded-[14px] text-lg" />}
        title={guild.name}
        description="Wähle ein Modul, um es für diesen Server einzurichten."
      />
      <Stats items={stats.map((stat) => ({ label: stat.label, value: <span className="js-count" data-value={stat.value}>{stat.value.toLocaleString('de-DE')}</span> }))} />
      {week && (
        <section className="mt-6">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-sans text-[11.5px] font-bold uppercase tracking-[.14em] text-dc-muted">Letzte 7 Tage</h2>
            <Link to="insights" className="text-[13px]">Alle Statistiken</Link>
          </div>
          <Stats items={[
            { label: 'Beitritte', value: week.history.totals.joins.toLocaleString('de-DE') },
            { label: 'Nachrichten', value: week.history.totals.messages.toLocaleString('de-DE') },
            { label: 'Aktive Mitglieder', value: week.history.totals.activeAvg.toLocaleString('de-DE'), hint: 'Ø pro Tag' },
          ]} />
        </section>
      )}
      <div className="mb-8" />

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
