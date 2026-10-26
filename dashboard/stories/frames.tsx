// Live page previews for the overviews: each page runs in its own iframe at real size (desktop 1280 px or phone
// 390 px wide) and is scaled down, so media queries and layouts behave exactly like in the browser.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { inTransition } from '../../.storybook/transition';

/** Colour scheme and light/dark of a preview. */
export interface Look { scheme: string; mode: 'dark' | 'light' }
import { pageFrameUrl, type PageEntry } from './pages';

export const DEVICES = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
} as const;
export type Device = keyof typeof DEVICES;

/** Opens a story in Storybook, keeping the toolbar's choices (scheme, mode, device). */
export function openStory(id: string, globals: { scheme: string; mode: string; device?: string }) {
  const top = window.top ?? window;
  top.location.href = `${top.location.pathname}?path=/story/${id}&globals=scheme:${globals.scheme};mode:${globals.mode};device:${globals.device ?? 'desktop'}`;
}

interface FrameWindow { __nexoSwitchLook?: (scheme: string, mode: 'dark' | 'light') => void }

/**
 * A preview running in an iframe loads once; later scheme and mode changes are handed to it directly (preview.tsx
 * __nexoSwitchLook), so it recolours in place instead of reloading or re-rendering, inside the page's crossfade
 * (transition.ts). Returns the iframe's fixed src.
 */
export function useLiveFrame(frame: RefObject<HTMLIFrameElement | null>, url: (look: Look) => string, look: Look) {
  const [src] = useState(() => url(look));
  const key = `${look.scheme}:${look.mode}`;
  // The look the preview shows now (the src's at first); compared with the last hand-over, not the first look, so
  // switching back to the starting look reaches the preview too.
  const shown = useRef(key);
  // Layout effect: queued in the same task as the switch, before the crossfade takes its snapshot.
  useLayoutEffect(() => {
    if (key === shown.current) return;
    shown.current = key;
    inTransition(() => (frame.current?.contentWindow as FrameWindow | null)?.__nexoSwitchLook?.(look.scheme, look.mode));
  }, [key]); // `look` itself is a new object on every render; `key` is its content
  return src;
}

/**
 * All previews load at once behind a cover and appear together when the last one is ready, so the overview does not
 * grow and shift while you read it. Returns the cover to render and the onLoad for each PageFrame.
 */
export function useFramesLoading(total: number) {
  const [loaded, setLoaded] = useState(0);
  const [ready, setReady] = useState(false);
  // A frame's load event comes before its data and entrance animation; give them a moment behind the cover.
  useEffect(() => {
    if (loaded < total) return;
    const timer = setTimeout(() => { setReady(true); window.scrollTo(0, 0); }, 800);
    return () => clearTimeout(timer);
  }, [loaded, total]);
  const onLoad = useCallback(() => setLoaded((n) => n + 1), []);
  const cover = ready ? null : (
    <div className="sb-loading" role="status">
      {/* Storybook's own spinner (its preview styles), so the cover looks like Storybook preparing a story. */}
      <div className="sb-loader" aria-hidden />
      <span>{Math.min(loaded, total)} von {total} Seiten geladen</span>
    </div>
  );
  return { cover, onLoad };
}

export function PageFrame({ page, label, scale, device, globals, onLoad }: {
  page: PageEntry; label?: string; scale: number; device: Device; globals: { scheme: string; mode: string }; onLoad?: () => void;
}) {
  const size = DEVICES[device];
  const frame = useRef<HTMLIFrameElement>(null);
  // Only scheme and mode go into the page; the device is this frame's size.
  // `still`: the preview skips its animations (preview.tsx), so 38 of them stay light to draw and switch.
  const src = useLiveFrame(frame, (look) => `${pageFrameUrl(page.key, look)}&still=1`, { scheme: globals.scheme, mode: globals.mode as Look['mode'] });
  return (
    <figure className="sb-frame">
      <figcaption>{label ?? page.label}</figcaption>
      <button type="button" className="sb-frame-window" style={{ width: size.width * scale, height: size.height * scale }}
        onClick={() => openStory(`seiten--${page.key}`, { ...globals, device })} title={`${page.label} groß öffnen`}>
        <iframe ref={frame} src={src} title={page.label} tabIndex={-1} onLoad={onLoad}
          style={{ width: size.width, height: size.height, transform: `scale(${scale})` }} />
      </button>
    </figure>
  );
}

export const frameStyles = `
.sb-board { min-height: 100vh; padding: 28px clamp(14px, 4vw, 32px) 60px; background: var(--bg-app); color: var(--text); font-family: var(--font); }
.sb-board h1 { font-family: var(--font-display); font-size: 30px; margin: 0; }
.sb-board .sb-lead { margin: 6px 0 0; color: var(--text-muted); max-width: 900px; }
.sb-bar { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; margin: 18px 0 8px; color: var(--text-muted); font-size: 13px; }
.sb-bar input[type=range] { width: 180px; accent-color: var(--accent); }
.sb-select { height: 34px; margin-left: 6px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--border-strong); background: var(--bg-card); color: var(--text-strong); font: inherit; font-size: 14px; }
.sb-group { margin-top: 30px; }
.sb-group h2 { font-family: var(--font-display); font-size: 17px; margin: 0 0 12px; color: var(--text-strong); }
.sb-row { display: flex; flex-wrap: wrap; gap: 22px; align-items: flex-start; }
/* Previews out of view are not drawn (38 full pages at 1280 px each held the overview at 30 frames per second). */
.sb-frame { margin: 0; display: grid; gap: 7px; content-visibility: auto; contain-intrinsic-size: auto 240px; }
.sb-frame figcaption { font-size: 13px; font-weight: 600; color: var(--text-strong); }
.sb-frame-window { position: relative; overflow: hidden; padding: 0; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--bg-main); cursor: zoom-in; box-shadow: 0 10px 30px -18px rgba(0,0,0,.6); transition: border-color .15s, transform .15s; }
.sb-frame-window:hover { border-color: var(--accent); transform: translateY(-2px); }
.sb-loading { position: fixed; inset: 0; z-index: 10; background: var(--bg-app); }
/* In Storybook's highlight blue (its colorSecondary, the colour of the active toolbar buttons). */
.sb-loading .sb-loader { border-color: rgba(2, 156, 253, .25); border-top-color: #029cfd; mix-blend-mode: normal; }
.sb-loading span { position: absolute; top: calc(50% + 30px); left: 0; right: 0; text-align: center; color: var(--text-muted); font: 13px/1.4 "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
.sb-frame-window iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; pointer-events: none; background: var(--bg-main); }
`;
