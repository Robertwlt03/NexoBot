import { useContext, useRef } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { useGSAP } from '@gsap/react';
import { UserContext } from '../api';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { NexoLogo } from '../components/NexoLogo';
import { LINKS } from '../../../src/config/links';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, useGSAP);

const FEATURES: { icon: IconName; title: string; text: string; wide?: boolean }[] = [
  { icon: 'shield', title: 'Moderation & AutoMod', wide: true, text: 'Spam, Links, Einladungen und Schimpfwörter filtert Discords eigener AutoMod – auch wenn Nexo mal offline ist. Fälle, Verwarnungen und Notizen siehst du gesammelt im Browser.' },
  { icon: 'wave', title: 'Willkommen', text: 'Begrüßung und Abschied mit Live-Vorschau, dazu eine Auto-Rolle.' },
  { icon: 'level', title: 'Leveling', text: 'XP fürs Schreiben, Rollen als Belohnung und eine Bestenliste.' },
  { icon: 'ticket', title: 'Tickets & Bewerbungen', text: 'Support-Panel mit Transkripten, Bewerbungen prüfst du direkt im Dashboard.' },
  { icon: 'gift', title: 'Giveaways', text: 'Starten, vorzeitig beenden, neu auslosen – ohne einen Befehl.' },
  { icon: 'music', title: 'Musik', text: 'Warteschlange, Buttons und 24/7-Modus über Lavalink.' },
];

const MORE = ['Verifizierung', 'Reaktionsrollen', 'Geburtstage', 'Zählspiel', 'Join-to-Create', 'Server-Statistiken', 'Logging', 'Economy', 'Meldungen', 'Commands sperren'];

const STEPS = [
  { title: 'Einladen', text: 'Klick auf „Nexo einladen“ und wähl deinen Server aus.' },
  { title: 'Anmelden', text: 'Discord meldet dich gleich mit an – du landest direkt im Dashboard.' },
  { title: 'Einrichten', text: 'Module anschalten, Kanäle wählen, speichern. Nexo legt sofort los.' },
];

const container = 'mx-auto w-full max-w-6xl px-5 md:px-8';

export function Landing() {
  const user = useContext(UserContext);
  const root = useRef<HTMLDivElement>(null);
  const loginFailed = new URLSearchParams(location.search).get('error') === 'login';

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const q = gsap.utils.selector(root);

      // Hero entrance
      // `.js-intro` elements start hidden in CSS (no flash before the animation); autoAlpha reveals them.
      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(q('.js-nav'), { y: -24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6 })
        .fromTo(q('.js-kicker'), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5 }, '-=0.3')
        .fromTo(q('.js-word'), { yPercent: 110, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.8, stagger: 0.08 }, '-=0.2')
        // DrawSVG hides the round line caps at 0%, so no dot shows at the right end before drawing.
        .fromTo(q('.js-underline'), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.9, ease: 'power2.inOut' }, '-=0.3')
        .set(q('.js-underline-svg'), { autoAlpha: 1 }, '<')
        .fromTo(q('.js-hero-fade'), { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.08 }, '-=0.7')
        .fromTo(q('.js-chat'), { x: 40, rotate: 3, autoAlpha: 0 }, { x: 0, rotate: 0, autoAlpha: 1, duration: 0.9 }, 0.35)
        .fromTo(q('.js-robot'), { scale: 0.4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1, ease: 'back.out(1.6)' }, 0.6)
        .fromTo(q('.js-chip'), { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, stagger: 0.12, ease: 'back.out(2)' }, 1);

      // Chat window plays a little welcome → reply → level-up story on loop
      gsap.timeline({ repeat: -1, repeatDelay: 1.5, delay: 1.2 })
        .fromTo(q('.js-msg'), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, stagger: 1.1, ease: 'power2.out' })
        .fromTo(q('.js-xp'), { width: '8%' }, { width: '72%', duration: 1.1, ease: 'power2.inOut' }, '-=0.2')
        .to(q('.js-msg'), { autoAlpha: 0, y: -8, duration: 0.4, stagger: 0.05 }, '+=2.6');

      // Floating chips follow the pointer a little
      const chips = q('.js-chip');
      const movers = chips.map((chip, i) => ({
        x: gsap.quickTo(chip, 'x', { duration: 0.8, ease: 'power3' }),
        y: gsap.quickTo(chip, 'y', { duration: 0.8, ease: 'power3' }),
        depth: (i + 1) * 10,
      }));
      const onMove = (event: PointerEvent) => {
        const dx = event.clientX / window.innerWidth - 0.5;
        const dy = event.clientY / window.innerHeight - 0.5;
        movers.forEach((m) => { m.x(dx * m.depth); m.y(dy * m.depth); });
      };
      window.addEventListener('pointermove', onMove);
      chips.forEach((chip, i) => gsap.to(chip, { yPercent: i % 2 ? 18 : -18, duration: 2.2 + i * 0.4, yoyo: true, repeat: -1, ease: 'sine.inOut' }));

      // Module marquee
      gsap.to(q('.js-marquee'), { xPercent: -50, duration: 32, ease: 'none', repeat: -1 });

      // Scroll reveals
      gsap.set(q('.js-reveal'), { opacity: 0, y: 40 });
      ScrollTrigger.batch(q('.js-reveal'), {
        start: 'top 85%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: 'power3.out', overwrite: true }),
      });
      gsap.from(q('.js-step-line'), { scaleX: 0, transformOrigin: 'left center', ease: 'none', scrollTrigger: { trigger: q('.js-steps')[0], start: 'top 75%', end: 'bottom 60%', scrub: true } });
      gsap.from(q('.js-cta-robot'), { y: 60, rotate: -12, opacity: 0, duration: 1, ease: 'back.out(1.4)', scrollTrigger: { trigger: q('.js-cta')[0], start: 'top 80%' } });

      return () => window.removeEventListener('pointermove', onMove);
    });
    return () => mm.revert();
  }, { scope: root });

  if (user) return <Navigate to="/servers" replace />;

  return (
    <div ref={root} className="min-h-full overflow-x-hidden bg-[#111214] text-dc-text [background-image:radial-gradient(rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:24px_24px]">
      {/* Nav */}
      <header className="js-nav js-intro sticky top-0 z-30 border-b border-white/5 bg-[#111214]/75 backdrop-blur-md">
        <div className={`${container} flex h-16 items-center gap-6`}>
          <a href="/dashboard/" className="flex items-center gap-2.5 text-white hover:no-underline">
            <NexoLogo className="h-9 w-auto" animated={false} />
            <span className="font-display text-lg font-semibold tracking-tight">Nexo</span>
          </a>
          <nav className="ml-auto hidden items-center gap-6 text-sm text-dc-muted md:flex">
            <a className="text-dc-muted transition hover:text-white hover:no-underline" href="#funktionen">Funktionen</a>
            <a className="text-dc-muted transition hover:text-white hover:no-underline" href="#start">So geht's</a>
            <a className="text-dc-muted transition hover:text-white hover:no-underline" href={LINKS.supportServer} target="_blank" rel="noreferrer">Support</a>
            <a className="text-dc-muted transition hover:text-white hover:no-underline" href={LINKS.repository} target="_blank" rel="noreferrer">GitHub</a>
          </nav>
          <a href="/dashboard/auth/login" className="ml-auto rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 hover:bg-white/5 hover:no-underline md:ml-0">
            Anmelden
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-blurple/20 blur-[120px]" />
        <div className={`${container} relative grid grid-cols-1 items-center gap-16 pb-20 pt-14 md:pt-24 lg:grid-cols-[1.05fr_1fr]`}>
          <div>
            <p className="js-kicker js-intro mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.03] px-3 py-1 text-xs font-medium uppercase tracking-[.14em] text-dc-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-[#23a55a]" /> Discord-Bot · kostenlos · auf Deutsch
            </p>
            <h1 className="font-display text-[clamp(2.6rem,6.5vw,4.6rem)] font-bold leading-[1.02] tracking-[-0.03em] text-white">
              <span className="block overflow-hidden pb-1"><span className="js-word js-intro inline-block">Ein&nbsp;Bot.</span></span>
              <span className="relative inline-block overflow-hidden pb-4">
                <span className="js-word js-intro inline-block">Alle</span>{' '}
                <span className="js-word js-intro inline-block text-nexo-cyan">Funktionen.</span>
                <svg className="js-underline-svg js-intro absolute bottom-0 left-0 h-4 w-full" viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true">
                  <path className="js-underline" d="M3 15 C 70 5, 170 3, 297 11" fill="none" stroke="#7c5cff" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="js-hero-fade js-intro mt-7 max-w-xl text-lg leading-relaxed text-dc-muted">
              Moderation, Willkommen, Leveling, Tickets und mehr. Lade Nexo ein, richte alles im Browser ein – fertig. Kein einziger Befehl nötig.
            </p>
            {loginFailed && (
              <p className="js-hero-fade js-intro mt-6 max-w-xl rounded-lg border border-[#da373c]/40 bg-[#da373c]/10 px-4 py-3 text-sm text-[#ffb4b4]">
                Die Anmeldung hat nicht geklappt. Bitte versuch es noch einmal.
              </p>
            )}
            <div className="js-hero-fade js-intro mt-9 flex flex-wrap gap-3">
              <a href="/dashboard/auth/invite" className="group inline-flex items-center gap-2.5 rounded-xl bg-blurple px-6 py-3.5 font-semibold text-white shadow-[0_10px_30px_-10px_rgba(88,101,242,.8)] transition hover:-translate-y-0.5 hover:bg-[#4752c4] hover:no-underline">
                <span className="transition group-hover:rotate-90"><Icon name="plus" size={18} /></span> Nexo einladen
              </a>
              <a href="/dashboard/auth/login" className="inline-flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/[.03] px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/35 hover:no-underline">
                <DiscordLogo /> Mit Discord anmelden
              </a>
            </div>
            <dl className="js-hero-fade js-intro m-0 mt-10 flex flex-wrap gap-x-10 gap-y-4">
              {[['36', 'Commands'], ['19', 'Module im Dashboard'], ['0 €', 'für immer kostenlos']].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-display text-2xl font-semibold text-white">{value}</dt>
                  <dd className="m-0 text-sm text-dc-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Discord preview */}
          <div className="relative mx-auto mt-20 w-full max-w-md lg:mr-0 lg:mt-0">
            <NexoLogo className="js-robot js-intro absolute -right-4 -top-28 z-20 w-44 drop-shadow-[0_20px_40px_rgba(124,92,255,.45)] sm:w-52" followPointer />
            <div className="js-chat js-intro relative z-10 overflow-hidden rounded-2xl border border-white/10 bg-dc-main shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]">
              <div className="flex items-center gap-2 border-b border-black/30 px-4 py-3 text-sm font-semibold text-white">
                <span className="text-dc-muted"><Icon name="hash" size={18} /></span> willkommen
              </div>
              <div className="flex min-h-[340px] flex-col gap-4 p-4 pb-12">
                <ChatMessage bot name="Nexo">
                  <div className="mt-1 rounded border-l-4 border-nexo-violet bg-dc-panel px-3 py-2.5">
                    <div className="text-sm font-semibold text-white">Willkommen, Lena!</div>
                    <div className="mt-0.5 text-sm text-dc-text">Schön, dass du auf <b className="text-white">Gaming Lounge</b> bist. Du bist Mitglied <b className="text-white">#128</b>.</div>
                  </div>
                </ChatMessage>
                <ChatMessage name="Lena" initial="L" color="bg-[#eb459e]">
                  <div className="text-sm text-dc-text">danke, freu mich auf euch!</div>
                </ChatMessage>
                <ChatMessage bot name="Nexo">
                  <div className="mt-1 rounded-lg bg-dc-panel px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-white"><span className="text-nexo-cyan"><Icon name="level" size={16} /></span> <b>Lena</b> ist auf <b>Level 5</b> aufgestiegen</div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
                      <div className="js-xp h-full w-[72%] rounded-full bg-gradient-to-r from-nexo-violet to-nexo-cyan" />
                    </div>
                  </div>
                </ChatMessage>
              </div>
            </div>
            <Chip className="-left-8 bottom-4" icon="check" tone="text-[#23a55a]">Rolle „Mitglied“ vergeben</Chip>
            <Chip className="-bottom-6 -right-4" icon="ticket" tone="text-nexo-cyan">Ticket #0042 erstellt</Chip>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="border-y border-white/5 bg-white/[.02] py-4">
        <div className="overflow-hidden">
          <div className="js-marquee flex w-max whitespace-nowrap">
            {[...MORE, ...FEATURES.map((f) => f.title), ...MORE, ...FEATURES.map((f) => f.title)].map((label, i) => (
              <span key={i} className="flex items-center gap-10 pr-10 font-display text-sm font-medium uppercase tracking-[.12em] text-dc-muted">
                {label}<span className="h-1.5 w-1.5 rotate-45 bg-nexo-violet" />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section id="funktionen" className={`${container} scroll-mt-20 py-24`}>
        <div className="js-reveal max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[.14em] text-nexo-cyan">Funktionen</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">Alles, was dein Server braucht. An einem Ort.</h2>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title}
              className={`js-reveal group relative overflow-hidden rounded-2xl border border-white/[.07] bg-dc-panel/70 p-7 transition duration-300 hover:-translate-y-1 hover:border-nexo-violet/50 ${feature.wide ? 'md:col-span-2' : ''}`}>
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-nexo-violet/0 blur-3xl transition duration-500 group-hover:bg-nexo-violet/25" />
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e1f22] text-white ring-1 ring-white/10 transition duration-300 group-hover:-rotate-6 group-hover:text-nexo-cyan">
                <Icon name={feature.icon} size={24} />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold text-white">{feature.title}</h3>
              <p className="mt-2 max-w-lg leading-relaxed text-dc-muted">{feature.text}</p>
            </article>
          ))}
        </div>
        <div className="js-reveal mt-8 flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm text-dc-muted">Und außerdem:</span>
          {MORE.map((label) => (
            <span key={label} className="rounded-full border border-white/10 px-3 py-1 text-sm text-dc-text transition hover:border-nexo-cyan/60 hover:text-white">{label}</span>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section id="start" className="scroll-mt-20 border-t border-white/5 bg-[#0c0d0f] py-24">
        <div className={container}>
          <div className="js-reveal max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[.14em] text-nexo-cyan">So geht's</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-white md:text-5xl">In drei Schritten startklar.</h2>
          </div>
          <div className="js-steps relative mt-16 grid grid-cols-1 gap-10 md:grid-cols-3">
            <div className="js-step-line absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-nexo-violet via-nexo-cyan to-transparent md:block" />
            {STEPS.map((step, i) => (
              <div key={step.title} className="js-reveal relative">
                <span className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-[#0c0d0f] font-display text-xl font-bold text-white">{i + 1}</span>
                <h3 className="mt-6 font-display text-xl font-semibold text-white">{step.title}</h3>
                <p className="mt-2 max-w-xs leading-relaxed text-dc-muted">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={`${container} js-cta py-24`}>
        <div className="relative overflow-hidden rounded-3xl bg-blurple px-8 py-14 md:px-14">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:18px_18px]" />
          <div className="relative grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">Bereit für deinen Server?</h2>
              <p className="mt-3 max-w-lg text-white/80">Einladen, anmelden, einrichten – in unter zwei Minuten. Fragen? Komm auf unseren Support-Server.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="/dashboard/auth/invite" className="rounded-xl bg-white px-6 py-3.5 font-semibold text-blurple transition hover:-translate-y-0.5 hover:no-underline">Nexo einladen</a>
                <a href={LINKS.supportServer} target="_blank" rel="noreferrer" className="rounded-xl border border-white/40 px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/10 hover:no-underline">Support-Server</a>
              </div>
            </div>
            <NexoLogo className="js-cta-robot mx-auto w-48 md:w-60" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className={`${container} flex flex-col gap-4 py-8 text-sm text-dc-muted md:flex-row md:items-center`}>
          <div className="flex items-center gap-2 text-white"><NexoLogo className="h-7 w-auto" animated={false} /><span className="font-display font-semibold">Nexo</span></div>
          <p className="md:ml-6">Nexo liest beim Anmelden nur deinen Discord-Namen und deine Serverliste.</p>
          <div className="flex gap-5 md:ml-auto">
            <a className="text-dc-muted hover:text-white hover:no-underline" href={LINKS.supportServer} target="_blank" rel="noreferrer">Support</a>
            <a className="text-dc-muted hover:text-white hover:no-underline" href={LINKS.repository} target="_blank" rel="noreferrer">GitHub</a>
            <span>Basiert auf TitanBot · MIT</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ChatMessage({ bot, name, initial, color, children }: { bot?: boolean; name: string; initial?: string; color?: string; children: ReactNode }) {
  return (
    <div className="js-msg js-intro flex gap-3">
      {bot
        ? <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1a1540]"><NexoLogo className="w-8" animated={false} /></span>
        : <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-white ${color}`}>{initial}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
          {name}
          {bot && <span className="rounded bg-blurple px-1 py-px text-[10px] font-semibold uppercase leading-tight text-white">App</span>}
          <span className="ml-1 text-xs font-normal text-dc-muted">Heute um 18:42</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Chip({ className, icon, tone, children }: { className: string; icon: IconName; tone: string; children: ReactNode }) {
  return (
    <div className={`js-chip js-intro absolute z-20 hidden items-center gap-2 rounded-xl border border-white/10 bg-[#1e1f22]/95 px-3.5 py-2.5 text-sm font-medium text-white shadow-xl backdrop-blur sm:flex ${className}`}>
      <span className={tone}><Icon name={icon} size={16} /></span>{children}
    </div>
  );
}

function DiscordLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.2a18.4 18.4 0 0 0-5.6 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.9 19.9 0 0 0 6 3l1.3-2a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2a19.8 19.8 0 0 0 6-3c.5-5.1-.8-9.6-3.6-13.6zM8 15.3c-1.2 0-2.2-1.1-2.2-2.4S6.8 10.5 8 10.5s2.2 1.1 2.2 2.4-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4z" />
    </svg>
  );
}
