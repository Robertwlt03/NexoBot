/// <reference types="vite/client" />
// Page header backdrops: a warm photo per page (Unsplash, see assets/backdrops/CREDITS.md) behind the top of the
// page, washed toward the page colour on the left so the title stays readable, and faded out downwards.
import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

// Only the URLs are bundled; each photo is fetched when its page is opened.
const PHOTOS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../assets/backdrops/*.webp', { eager: true, query: '?url', import: 'default' }))
    .map(([path, url]) => [path.split('/').pop()!.replace('.webp', ''), url]),
);

/** Photo for a route: the last path segment (server modules, member and owner pages), with a few special cases. */
export function photoFor(pathname: string): string {
  const parts = pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const seg = parts[parts.length - 1] ?? 'servers';
  if (parts[0] === 'owner') return PHOTOS[seg === 'blackmarket' ? 'ownerblackmarket' : seg] ?? PHOTOS.owner;
  if (/^\d{17,20}$/.test(seg)) return PHOTOS.overview;
  return PHOTOS[seg] ?? PHOTOS.servers;
}

// Wash toward the page colour (strong on the left, for the title) and fade out downwards; both follow the mode.
const WASH = 'linear-gradient(90deg, color-mix(in srgb, var(--bg-main) 92%, transparent) 0%, color-mix(in srgb, var(--bg-main) 62%, transparent) 45%, color-mix(in srgb, var(--bg-main) 20%, transparent) 100%)';
const FADE = { maskImage: 'linear-gradient(to bottom, #000 40%, transparent)' } as const;

/** Absolute layer at the top of a scroll area; the photo eases in on page change. */
export function PageBackdrop({ photo }: { photo: string }) {
  const ref = useRef<HTMLImageElement>(null);
  useGSAP(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(ref.current, { autoAlpha: 0, scale: 1.06 }, { autoAlpha: 1, scale: 1, duration: 1.2, ease: 'power2.out' });
  }, { dependencies: [photo] });
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[340px] overflow-hidden" style={FADE}>
      <img ref={ref} key={photo} src={photo} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0" style={{ background: WASH }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 90% at 90% 0%, var(--accent-soft), transparent 70%)' }} />
    </div>
  );
}
