// Coins flying when the balance changes: into the wallet pill when you earn, starting where you last clicked (the
// claim button); out of it when you spend, tossed up and dropping away below the pill (the buy button usually sat in
// a dialog that is gone by then). Reduced motion: nothing flies, the number still counts.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { splitCoins, type CoinTier } from '../../../src/shared/coins';
import { CoinIcon } from '../components/CoinIcon';
import { reducedMotion } from './api';

/** Where the last click happened (the source or target of a flight); stale after a few seconds. */
let lastPointer: { x: number; y: number; at: number } | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (event) => { lastPointer = { x: event.clientX, y: event.clientY, at: Date.now() }; }, { capture: true, passive: true });
}

interface Flight { id: number; coins: CoinTier[]; earning: boolean; from: { x: number; y: number }; to: { x: number; y: number } }

export function useCoinFlight(balance: number, pill: RefObject<HTMLElement | null>) {
  const previous = useRef(balance);
  const [flight, setFlight] = useState<Flight | null>(null);
  useEffect(() => {
    const delta = balance - previous.current;
    previous.current = balance;
    const box = pill.current?.getBoundingClientRect();
    // The layout has a pill in the side menu and one in the top bar; only the one on screen catches the coins.
    const visible = box && box.width > 0 && box.right > 0 && box.left < window.innerWidth && pill.current!.checkVisibility?.() !== false;
    if (!delta || !visible || reducedMotion()) return;
    const pillPoint = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const fresh = lastPointer && Date.now() - lastPointer.at < 8000;
    const page = delta < 0 ? { x: pillPoint.x, y: pillPoint.y + 150 }
      : fresh ? { x: lastPointer!.x, y: lastPointer!.y } : { x: window.innerWidth / 2, y: window.innerHeight * 0.6 };
    // Up to six coins in the metals of the amount, the biggest first.
    const tiers = splitCoins(delta).map((part) => part.tier);
    const coins = Array.from({ length: Math.min(6, 3 + tiers.length) }, (_, i) => tiers[i % tiers.length]);
    setFlight({ id: Date.now(), coins, earning: delta > 0, from: delta > 0 ? page : pillPoint, to: delta > 0 ? pillPoint : page });
  }, [balance, pill]);
  const done = useCallback(() => setFlight(null), []);
  return { flight, done };
}

interface Point { x: number; y: number }

/**
 * One coin's flight as a quadratic Bézier: from `from` (fanned out by `spread`) to `to`, bulging upwards like a
 * toss. The control point is clamped inside the viewport, and since a Bézier stays within its control points, the
 * whole flight stays on screen (the pill sits right at the top, where a plain "up and over" would leave it).
 */
export function coinPath(from: Point, to: Point, spread: number, viewport: { w: number; h: number }) {
  const margin = 16;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const start = { x: clamp(from.x + spread, margin, viewport.w - margin), y: clamp(from.y, margin, viewport.h - margin) };
  const end = { x: clamp(to.x, margin, viewport.w - margin), y: clamp(to.y, margin, viewport.h - margin) };
  const lift = Math.min(180, Math.hypot(end.x - start.x, end.y - start.y) * 0.35 + 40);
  const control = {
    x: clamp((start.x + end.x) / 2 + spread * 2, margin, viewport.w - margin),
    y: clamp(Math.min(start.y, end.y) - lift, margin, viewport.h - margin),
  };
  const at = (t: number): Point => ({
    x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
    y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
  });
  return { start, end, control, at };
}

export function CoinFlight({ flight, pill, onDone }: { flight: Flight | null; pill: RefObject<HTMLElement | null>; onDone: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!flight || !layer.current) return;
    const coins = [...layer.current.querySelectorAll<HTMLElement>('.js-flying-coin')];
    const viewport = { w: window.innerWidth, h: window.innerHeight };
    const tl = gsap.timeline({ onComplete: onDone });
    coins.forEach((coin, i) => {
      const spread = (i - (coins.length - 1) / 2) * 16;
      // Spent coins scatter as they drop; earned ones all meet in the pill.
      const to = flight.earning ? flight.to : { x: flight.to.x + spread * 3, y: flight.to.y };
      const path = coinPath(flight.from, to, spread, viewport);
      const spin = (i % 2 ? -1 : 1) * 260;
      const progress = { t: 0 };
      gsap.set(coin, { x: path.start.x, y: path.start.y, scale: 0.5, opacity: 0 });
      // One smooth tween along the curve: grows towards the middle, shrinks into the pill, fades in and out.
      tl.to(progress, {
        t: 1, duration: 0.8, ease: 'power1.inOut',
        onUpdate: () => {
          const { t } = progress;
          const p = path.at(t);
          gsap.set(coin, { x: p.x, y: p.y, rotation: spin * t, scale: 0.55 + Math.sin(Math.PI * t) * 0.6, opacity: Math.min(1, t * 6, (1 - t) * 6) });
        },
      }, i * 0.07);
    });
    // The pill bounces as coins arrive, or gives a little squeeze as they leave.
    if (pill.current) {
      if (flight.earning) tl.to(pill.current, { scale: 1.12, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }, '>-0.15');
      else tl.to(pill.current, { scale: 0.9, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' }, 0);
    }
    return () => {
      tl.kill();
      if (pill.current) gsap.set(pill.current, { scale: 1 });
    };
    // Runs once per flight; onDone and pill are stable.
  }, [flight?.id]);
  if (!flight) return null;
  return createPortal(
    <div ref={layer} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[80]">
      {flight.coins.map((tier, i) => (
        <span key={`${flight.id}-${i}`} className="js-flying-coin absolute left-0 top-0 -ml-3 -mt-3 block h-6 w-6 opacity-0 drop-shadow-[0_4px_6px_rgba(0,0,0,.45)]">
          <CoinIcon tier={tier} className="h-6 w-6" />
        </span>
      ))}
    </div>,
    document.body,
  );
}

// ---------- First gold / platinum coin ----------

const MILESTONES: { tier: CoinTier; at: number; title: string; text: string; tint: string }[] = [
  { tier: 'platinum', at: 1_000_000, title: 'Deine erste Platinmünze!', text: '100 Gold sind 1 Platin – dein Konto zählt jetzt in Platin.', tint: '#C9D6E6' },
  { tier: 'gold', at: 10_000, title: 'Deine erste Goldmünze!', text: '100 Silber sind 1 Gold – dein Konto zählt jetzt in Gold.', tint: '#F2C14E' },
];
const seenKey = (userId: string) => `nexo:coin-milestone:${userId}`;

/**
 * The highest coin milestone just reached for the first time (only when the balance rises past it while you watch,
 * never on page load); remembered per member in this browser so it shows once.
 */
export function useCoinMilestone(balance: number, userId: string | undefined) {
  const previous = useRef(balance);
  const [milestone, setMilestone] = useState<(typeof MILESTONES)[number] | null>(null);
  useEffect(() => {
    const before = previous.current;
    previous.current = balance;
    if (!userId || balance <= before) return;
    const reached = MILESTONES.find((m) => before < m.at && balance >= m.at);
    if (!reached) return;
    let seen = 0;
    try { seen = Number(localStorage.getItem(seenKey(userId)) ?? 0); } catch { /* storage blocked: celebrate anyway */ }
    if (seen >= reached.at) return;
    try { localStorage.setItem(seenKey(userId), String(reached.at)); } catch { /* ignore */ }
    // After the coins have landed in the pill.
    const timer = window.setTimeout(() => setMilestone(reached), reducedMotion() ? 0 : 900);
    return () => window.clearTimeout(timer);
  }, [balance, userId]);
  const close = useCallback(() => setMilestone(null), []);
  return { milestone, close };
}
