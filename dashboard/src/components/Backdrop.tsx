/// <reference types="vite/client" />
// Page header backdrop: the same board on every page (walnut, Douglas fir in light mode; assets/wood/CREDITS.md), with the page's own icon and a
// vine burnt into the wood on the right, the leaves touched with moss. Over the text column the wood is washed toward
// the page colour (--scrim, measured for 4.5:1 text), right of it the wood shows; it fades out downwards.
import type { ReactNode } from 'react';
import walnut from '../assets/wood/walnut.webp';
import fir from '../assets/wood/fir.webp';
import { Engraving } from './Engraving';

/** Absolute layer at the top of a scroll area, visible right away. `art` = the page's nav icon (24px grid paths). */
export function PageBackdrop({ art, column = 1040 }: { art?: ReactNode; column?: number }) {
  const textEnd = `calc(max(40px, 50% - ${column / 2}px) + 780px)`;
  // Washed toward --scrim-color: the page colour on walnut, the fir's own light honey in the light mode (styles.css).
  const tone = 'var(--scrim-color, var(--bg-main))';
  const wash = `linear-gradient(90deg, color-mix(in srgb, ${tone} var(--scrim), transparent) ${textEnd}, color-mix(in srgb, ${tone} 18%, transparent) calc(${textEnd} + 320px))`;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden"
      style={{ maskImage: 'linear-gradient(to bottom, #000 45%, transparent)' }}>
      {/* Walnut in the dark mode, Douglas fir in the light mode (styles.css switches them). */}
      <img src={walnut} alt="" fetchPriority="high" className="wood-dark absolute inset-0 h-full w-full object-cover" />
      <img src={fir} alt="" className="wood-light absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ background: wash }} />
      {/* Right of the text column; on narrow screens a small version in the corner. */}
      <Engraving art={art} width={`min(600px, max(220px, calc(100% - ${textEnd} + 140px)))`} />
    </div>
  );
}
