// Live page previews for the overviews: each page runs in its own iframe at real size (desktop 1280 px or phone
// 390 px wide) and is scaled down, so media queries and layouts behave exactly like in the browser.
import { pageFrameUrl, type PageEntry } from './pages';

export const DEVICES = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
} as const;
export type Device = keyof typeof DEVICES;

/** Opens one page large in Storybook (same look as the overview). */
function openPage(key: string, globals: { scheme: string; mode: string }) {
  const top = window.top ?? window;
  top.location.href = `${top.location.pathname}?path=/story/seiten--${key}&globals=scheme:${globals.scheme};mode:${globals.mode}`;
}

export function PageFrame({ page, label, scale, device, globals }: {
  page: PageEntry; label?: string; scale: number; device: Device; globals: { scheme: string; mode: string };
}) {
  const size = DEVICES[device];
  return (
    <figure className="sb-frame">
      <figcaption>{label ?? page.label}</figcaption>
      <button type="button" className="sb-frame-window" style={{ width: size.width * scale, height: size.height * scale }}
        onClick={() => openPage(page.key, globals)} title={`${page.label} groß öffnen`}>
        <iframe src={pageFrameUrl(page.key, globals)} title={page.label} loading="lazy" tabIndex={-1}
          style={{ width: size.width, height: size.height, transform: `scale(${scale})` }} />
      </button>
    </figure>
  );
}

export const frameStyles = `
.sb-board { min-height: 100vh; padding: 28px 32px 60px; background: var(--bg-app); color: var(--text); font-family: var(--font); }
.sb-board h1 { font-family: var(--font-display); font-size: 30px; margin: 0; }
.sb-board .sb-lead { margin: 6px 0 0; color: var(--text-muted); max-width: 900px; }
.sb-bar { display: flex; flex-wrap: wrap; gap: 18px; align-items: center; margin: 18px 0 8px; color: var(--text-muted); font-size: 13px; }
.sb-bar input[type=range] { width: 180px; accent-color: var(--accent); }
.sb-group { margin-top: 30px; }
.sb-group h2 { font-family: var(--font-display); font-size: 17px; margin: 0 0 12px; color: var(--text-strong); }
.sb-row { display: flex; flex-wrap: wrap; gap: 22px; align-items: flex-start; }
.sb-frame { margin: 0; display: grid; gap: 7px; }
.sb-frame figcaption { font-size: 13px; font-weight: 600; color: var(--text-strong); }
.sb-frame-window { position: relative; overflow: hidden; padding: 0; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--bg-main); cursor: zoom-in; box-shadow: 0 10px 30px -18px rgba(0,0,0,.6); transition: border-color .15s, transform .15s; }
.sb-frame-window:hover { border-color: var(--accent); transform: translateY(-2px); }
.sb-frame-window iframe { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; pointer-events: none; background: var(--bg-main); }
`;
