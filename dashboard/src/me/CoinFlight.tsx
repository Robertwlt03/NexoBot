// Coins flying between the page and the wallet pill whenever the balance changes: into the pill when you earn,
// out of it when you spend, starting or ending where you last clicked (the buy or claim button). Reduced motion:
// nothing flies, the number still counts.
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
    const page = fresh ? { x: lastPointer!.x, y: lastPointer!.y } : { x: window.innerWidth / 2, y: window.innerHeight * 0.6 };
    // Up to six coins in the metals of the amount, the biggest first.
    const tiers = splitCoins(delta).map((part) => part.tier);
    const coins = Array.from({ length: Math.min(6, 3 + tiers.length) }, (_, i) => tiers[i % tiers.length]);
    setFlight({ id: Date.now(), coins, earning: delta > 0, from: delta > 0 ? page : pillPoint, to: delta > 0 ? pillPoint : page });
  }, [balance, pill]);
  const done = useCallback(() => setFlight(null), []);
  return { flight, done };
}

export function CoinFlight({ flight, pill, onDone }: { flight: Flight | null; pill: RefObject<HTMLElement | null>; onDone: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!flight || !layer.current) return;
    const coins = layer.current.querySelectorAll<HTMLElement>('.js-flying-coin');
    const tl = gsap.timeline({ onComplete: onDone });
    coins.forEach((coin, i) => {
      const spread = (i - (coins.length - 1) / 2) * 14;
      const lift = Math.min(160, Math.abs(flight.to.x - flight.from.x) * 0.25 + 60);
      tl.fromTo(coin, { x: flight.from.x + spread, y: flight.from.y, scale: 0.4, opacity: 0, rotation: -40 },
        { keyframes: [
          { x: (flight.from.x + flight.to.x) / 2 + spread, y: Math.min(flight.from.y, flight.to.y) - lift, scale: 1.1, opacity: 1, rotation: 0, duration: 0.35, ease: 'power2.out' },
          { x: flight.to.x, y: flight.to.y, scale: 0.55, opacity: 0.9, rotation: 30, duration: 0.4, ease: 'power2.in' },
          { opacity: 0, duration: 0.08 },
        ] }, i * 0.06);
    });
    // The pill gives a little bounce when the last coin lands (earning only).
    if (flight.earning && pill.current) tl.fromTo(pill.current, { scale: 1 }, { scale: 1.12, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }, '>-0.1');
    return () => { tl.kill(); };
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
