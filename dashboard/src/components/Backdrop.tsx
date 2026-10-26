/// <reference types="vite/client" />
// Page header backdrop, the same on every page and made of the theme's material: walnut or golden oak with the page's
// icon and a vine burnt in (assets/wood/CREDITS.md), or for Cyberpunk a black grid with yellow hatching and the icon as a neon sign in target corners.
// Over the text column it is washed lightly (--scrim, measured for 4.5:1 text), right of it the material shows; it
// fades out downwards. styles.css switches the layers by data-theme and data-mode.
import type { ReactNode } from 'react';
import walnut from '../assets/wood/walnut.webp';
import oak from '../assets/wood/oak.webp';
import { CircuitArt } from './CircuitArt';
import { Engraving } from './Engraving';

/**
 * Absolute layer at the top of a scroll area, visible right away. `art` = the page's nav icon (24px grid paths), `label`
 * = the page name (the tag under the icon in Cyberpunk).
 */
export function PageBackdrop({ art, label, column = 1040 }: { art?: ReactNode; label?: string; column?: number }) {
  const textEnd = `calc(max(40px, 50% - ${column / 2}px) + 780px)`;
  // Washed toward --scrim-color: the page colour on walnut, the oak's own light golden in the light mode (styles.css).
  const tone = 'var(--scrim-color, var(--bg-main))';
  const artWidth = `min(600px, max(220px, calc(100% - ${textEnd} + 140px)))`;
  const wash = `linear-gradient(90deg, color-mix(in srgb, ${tone} var(--scrim), transparent) ${textEnd}, color-mix(in srgb, ${tone} 18%, transparent) calc(${textEnd} + 320px))`;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden"
      style={{ maskImage: 'linear-gradient(to bottom, #000 45%, transparent)' }}>
      {/* Cyberpunk: black grid, cyan glow, yellow hatching on a yellow base line. */}
      <div className="look-cyber cyber-grid absolute inset-0" />
      {/* Walnut in the dark mode, golden oak in the light mode (styles.css switches them). */}
      <img src={walnut} alt="" fetchPriority="high" className="wood-dark absolute inset-0 h-full w-full object-cover" />
      <img src={oak} alt="" className="wood-light absolute inset-0 h-full w-full object-cover" />
      {/* Uneven tone in the oak, like the light and dark patches in the walnut (styles.css .wood-shade). */}
      <div className="wood-light wood-shade absolute inset-0" />
      <div className="absolute inset-0" style={{ background: wash }} />
      {/* Right of the text column; on narrow screens a small version in the corner. */}
      <div className="look-wood absolute inset-0"><Engraving art={art} width={artWidth} /></div>
      <div className="look-cyber absolute inset-0"><CircuitArt art={art} label={label} width={artWidth} /></div>
    </div>
  );
}
