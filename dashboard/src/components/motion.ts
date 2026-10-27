// Small GSAP entrance for dashboard elements; skipped when the user prefers reduced motion.
import type { RefObject } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/**
 * The motion scale in GSAP's units (seconds, GSAP ease names); the same as --dur-* and --ease-* in tailwind.css
 * (tests/designScale.test.ts keeps them equal). fast: hover and colour, base: toggles, moving markers, closing,
 * slow: entrances, long: charts drawing and numbers counting. enter for arriving and moving, exit for leaving, pop for
 * rewards and dialogs, nudge only for the save bar's "not yet" shake. step: delay between items entering one by one.
 */
export const MOTION = {
  fast: 0.15, base: 0.25, slow: 0.4, long: 0.8,
  enter: 'power3.out', exit: 'power2.in', pop: 'back.out(1.6)', loop: 'sine.inOut', nudge: 'elastic.out(1.2, 0.3)',
  step: 0.04,
} as const;

/** Fades the element up on mount, staggered by its position among its siblings. */
export function useEnter(ref: RefObject<HTMLElement | null>, vars: gsap.TweenVars = {}) {
  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const index = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      gsap.from(el, { y: 14, opacity: 0, duration: MOTION.slow, ease: MOTION.enter, delay: Math.min(index, 6) * MOTION.step, clearProps: 'transform,opacity', ...vars });
    });
    return () => mm.revert();
  }, { scope: ref });
}
