/// <reference types="vite/client" />
// Page header backdrops: a warm photo per page (Unsplash, see assets/backdrops/CREDITS.md) behind the top of the
// page, washed toward the page colour on the left so the title stays readable, and faded out downwards.

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

/**
 * Absolute layer at the top of a scroll area, visible right away (no fade-in). Over the text column the photo is
 * covered by the page colour (--scrim, enough for 4.5:1 on every photo); right of it the photo opens up. `column` is
 * the max width of the page content, so the clear part starts where the header text ends at any screen width.
 */
export function PageBackdrop({ photo, column = 1040 }: { photo: string; column?: number }) {
  const textEnd = `calc(max(40px, 50% - ${column / 2}px) + 780px)`;
  const wash = `linear-gradient(90deg, color-mix(in srgb, var(--bg-main) var(--scrim), transparent) ${textEnd}, color-mix(in srgb, var(--bg-main) 25%, transparent) calc(${textEnd} + 360px))`;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden"
      style={{ maskImage: 'linear-gradient(to bottom, #000 45%, transparent)' }}>
      {/* No key: on page change the old photo stays until the new one is decoded, so there is never an empty band. */}
      <img src={photo} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0" style={{ background: wash }} />
    </div>
  );
}
