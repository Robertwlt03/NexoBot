import { useRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { CHANNEL_TYPES } from '../../../src/web/apiTypes';
import type { InsightsResponse } from '../../../src/web/dto/insights';
import { useApi, useGuild } from '../api';
import { Sparkline } from '../components/charts';
import { GuildIcon } from '../components/Layout';
import { PageHeader } from '../components/ui';
import { Icon, IconTile } from '../icons';
import { GROUPS, MODULES } from '../modules/registry';

gsap.registerPlugin(useGSAP);

const num = (value: number) => value.toLocaleString('de-DE');

/** Change vs. the previous period as a small status-coloured label (the only place green/red appears here). */
function Delta({ now, before }: { now: number; before: number | undefined }) {
  if (before === undefined || before === 0) return <span className="text-faint">Neu aufgezeichnet</span>;
  const change = Math.round(((now - before) / before) * 100);
  const tone = change > 0 ? 'text-pos' : change < 0 ? 'text-neg' : 'text-mute';
  return <span className={tone}>{change > 0 ? '+' : ''}{change} % <span className="text-faint">zur Vorwoche</span></span>;
}

function KpiCard({ label, value, footer, spark, to }: { label: string; value: string; footer: ReactNode; spark: (number | null)[]; to: string }) {
  return (
    <Link to={to} className="js-tile card group flex flex-col !p-5 text-body hover:no-underline">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] text-mute">{label}</span>
        <span className="arrow-btn"><span className="inline-block rotate-[135deg]"><Icon name="arrowLeft" size={14} /></span></span>
      </div>
      <div className="mt-3 text-[34px] font-light leading-none tracking-[-0.03em] text-ink tabular-nums">{value}</div>
      <div className="mt-2 text-[12.5px]">{footer}</div>
      <div className="mt-auto pt-3"><Sparkline values={spark} height={44} /></div>
    </Link>
  );
}

export function Overview() {
  const { guild } = useGuild();
  const root = useRef<HTMLDivElement>(null);
  const week = useApi<InsightsResponse>(`/guilds/${guild.id}/insights?range=7`).data;
  const count = (...types: number[]) => guild.channels.filter((c) => types.includes(c.type)).length;
  const days = week?.history.days ?? [];
  const totals = week?.history.totals;
  const previous = week?.history.previous ?? undefined;

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.js-tile', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.04, ease: 'power3.out', delay: 0.1, clearProps: 'transform' });
      gsap.utils.toArray<HTMLElement>('.js-count').forEach((el) => {
        const target = Number(el.dataset.value);
        const state = { n: 0 };
        gsap.to(state, { n: target, duration: 1.2, ease: 'power3.out', delay: 0.15, onUpdate: () => { el.textContent = num(Math.round(state.n)); } });
      });
    });
    return () => mm.revert();
  }, { scope: root, dependencies: [guild.id, Boolean(week)], revertOnUpdate: true });

  return (
    <div ref={root}>
      <PageHeader
        kicker="Übersicht"
        media={<GuildIcon guild={guild} className="h-12 w-12 shrink-0 rounded-[14px] text-lg ring-1 ring-white/10" />}
        title={guild.name}
        description="Der Stand deines Servers auf einen Blick. Wähle unten ein Modul, um es einzurichten."
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* The one accent surface on this page. */}
        <div className="js-tile card card-hero relative flex flex-col overflow-hidden md:col-span-2">
          <div className="flex items-center gap-2 text-[13px] text-accent-text">
            <span className="h-1.5 w-1.5 rounded-full bg-pos shadow-[0_0_8px_var(--pos)]" /> Nexo ist aktiv
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-1">
            <span className="js-count text-[56px] font-extralight leading-none tracking-[-0.04em] text-ink tabular-nums" data-value={guild.memberCount}>{num(guild.memberCount)}</span>
            <span className="pb-1.5 text-[15px] text-body">Mitglieder</span>
          </div>
          <p className="mt-2 text-[13px] text-[var(--accent-text-muted)]">
            {totals ? <>+{num(totals.joins)} Beitritte · −{num(totals.leaves)} Austritte in den letzten 7 Tagen</> : 'Verlauf wird ab jetzt täglich aufgezeichnet.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-[12.5px]">
            {([['Textkanäle', count(CHANNEL_TYPES.text, CHANNEL_TYPES.announcement, CHANNEL_TYPES.forum)], ['Sprachkanäle', count(CHANNEL_TYPES.voice, CHANNEL_TYPES.stage)], ['Rollen', guild.roles.length]] as const).map(([label, value]) => (
              <span key={label} className="rounded-[999px] border border-white/10 bg-white/[.04] px-3 py-1 text-body"><b className="font-medium text-ink">{value}</b> {label}</span>
            ))}
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-6">
            <Link to="insights" className="btn btn-primary hover:no-underline">Statistiken öffnen</Link>
            <Link to="welcome" className="btn btn-secondary hover:no-underline">Willkommen einrichten</Link>
          </div>
        </div>

        <KpiCard label="Nachrichten · 7 Tage" value={totals ? num(totals.messages) : '–'} to="insights?tab=activity"
          footer={totals ? <Delta now={totals.messages} before={previous?.messages} /> : <span className="text-faint">Noch keine Daten</span>}
          spark={days.map((d) => d.messages)} />
        <KpiCard label="Aktive Mitglieder · Ø pro Tag" value={totals ? num(totals.activeAvg) : '–'} to="insights?tab=activity"
          footer={totals ? <Delta now={totals.activeAvg} before={previous?.activeAvg} /> : <span className="text-faint">Noch keine Daten</span>}
          spark={days.map((d) => d.activeMembers)} />
      </section>

      {GROUPS.map((group) => (
        <section key={group} className="mt-10">
          <h2 className="mb-3 text-[13px] font-medium text-mute">{group}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MODULES.filter((m) => m.group === group).map((m) => (
              <Link key={m.id} to={m.id}
                className="js-tile group relative flex items-center gap-3.5 rounded-2xl border border-white/[.06] bg-surface p-4 text-body transition duration-300 hover:border-white/[.12] hover:bg-raised hover:no-underline">
                <IconTile name={m.icon} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14.5px] font-medium">{m.label}</h3>
                  <p className="mt-0.5 truncate text-[12.5px] text-mute">{m.description}</p>
                </div>
                <span className="arrow-btn opacity-0 transition group-hover:opacity-100"><span className="inline-block rotate-[135deg]"><Icon name="arrowLeft" size={14} /></span></span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
