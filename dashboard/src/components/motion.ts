// Small GSAP entrance for dashboard elements; skipped when the user prefers reduced motion.
import type { RefObject } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/** Fades the element up on mount, staggered by its position among its siblings. */
export function useEnter(ref: RefObject<HTMLElement | null>, vars: gsap.TweenVars = {}) {
  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const index = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      gsap.from(el, { y: 14, opacity: 0, duration: 0.45, ease: 'power2.out', delay: Math.min(index, 6) * 0.05, clearProps: 'transform,opacity', ...vars });
    });
    return () => mm.revert();
  }, { scope: ref });
}
