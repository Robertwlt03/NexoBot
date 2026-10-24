// "Unlocked!" moment after a purchase or gift, like a loot reveal in games: the item tile flips in on light rays
// in its rarity colour while confetti bursts out. Reduced motion: the same screen without movement.
import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { reducedMotion } from './api';

gsap.registerPlugin(useGSAP);

const CONFETTI = 46;

export function Celebration({ tint, kicker, title, text, tile, actions, onClose }: {
  /** Rarity colour of the item. */
  tint: string; kicker: string; title: string; text: ReactNode; tile: ReactNode; actions: ReactNode; onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    root.current?.querySelector<HTMLButtonElement>('.js-actions button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useGSAP(() => {
    if (reducedMotion()) return;
    const tl = gsap.timeline();
    tl.from('.js-veil', { autoAlpha: 0, duration: 0.25 })
      .from('.js-rays', { scale: 0.3, autoAlpha: 0, duration: 0.7, ease: 'power3.out' }, 0.05)
      .from('.js-tile', { scale: 0.35, rotateY: -100, autoAlpha: 0, duration: 0.9, ease: 'back.out(1.6)' }, 0.1)
      .from('.js-text > *', { y: 16, autoAlpha: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out' }, 0.55);
    gsap.to('.js-rays', { rotate: 360, duration: 40, ease: 'none', repeat: -1 });
    // Confetti: burst up and out, then drift down and fade.
    gsap.utils.toArray<HTMLElement>('.js-bit').forEach((bit) => {
      const x = gsap.utils.random(-320, 320);
      const y = gsap.utils.random(-340, -60);
      gsap.timeline({ delay: 0.25 + Math.random() * 0.15 })
        .fromTo(bit, { x: 0, y: 0, scale: 0, rotate: 0, autoAlpha: 1 }, { x, y, scale: 1, rotate: gsap.utils.random(-260, 260), duration: 0.8, ease: 'power3.out' })
        .to(bit, { y: y + gsap.utils.random(260, 420), x: x * 1.15, rotate: '+=180', autoAlpha: 0, duration: 1.6, ease: 'power1.in' });
    });
  }, { scope: root });

  const colours = [tint, '#F5C451', '#ffffff', '#8FB36B', '#E8A33D'];
  return (
    <div ref={root} data-mode="dark" role="dialog" aria-modal="true" aria-labelledby="celebration-title" className="fixed inset-0 z-[70] grid place-items-center overflow-hidden p-4">
      <button type="button" aria-label="Schließen" className="js-veil absolute inset-0 cursor-default border-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative flex w-full max-w-[380px] flex-col items-center text-center" style={{ '--tile': tint } as CSSProperties}>
        <div className="js-rays pointer-events-none absolute -top-[150px] left-1/2 -ml-[300px] h-[600px] w-[600px] rounded-full"
          style={{
            background: 'repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--tile) 22%, transparent) 0deg 7deg, transparent 7deg 20deg)',
            maskImage: 'radial-gradient(closest-side, #000 20%, transparent)',
          }} />
        <div className="pointer-events-none absolute -top-[40px] left-1/2 -ml-[180px] h-[360px] w-[360px] rounded-full blur-[70px]" style={{ background: 'color-mix(in srgb, var(--tile) 45%, transparent)' }} />
        <div className="pointer-events-none absolute left-1/2 top-[160px]" aria-hidden="true">
          {Array.from({ length: CONFETTI }, (_, i) => (
            <span key={i} className="js-bit absolute block" style={{
              width: i % 3 ? 8 : 6, height: i % 3 ? 4 : 6, borderRadius: i % 3 ? 1 : 999, background: colours[i % colours.length],
              opacity: 0, // shown by the animation; stays hidden with reduced motion
            }} />
          ))}
        </div>
        <div className="js-tile relative w-[220px] [perspective:900px]">{tile}</div>
        <div className="js-text relative mt-6 flex flex-col items-center">
          <p className="text-[12px] font-bold uppercase tracking-[.28em]" style={{ color: tint }}>{kicker}</p>
          <h2 id="celebration-title" className="mt-2 text-[26px] font-bold uppercase leading-tight tracking-[.02em] text-white">{title}</h2>
          <p className="mt-1.5 text-[14px] text-mute">{text}</p>
          <div className="js-actions mt-6 flex flex-wrap justify-center gap-2">{actions}</div>
        </div>
      </div>
    </div>
  );
}
