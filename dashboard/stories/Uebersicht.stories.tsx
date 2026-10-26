// The board: every dashboard page at once, grouped like the navigation. The toolbar's switches (colour scheme,
// light/dark, desktop/phone) change all previews together; a click opens a page large.
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PAGE_GROUPS, PAGES } from './pages';
import { DEVICES, PageFrame, frameStyles, useFramesLoading, type Device } from './frames';

function Board({ globals }: { globals: { scheme: string; mode: string; device: Device } }) {
  const device = globals.device ?? 'desktop';
  const [scale, setScale] = useState(device === 'phone' ? 0.42 : 0.24);
  const { cover, onLoad } = useFramesLoading(PAGES.length);
  return (
    <div className="sb-board">
      <style>{frameStyles}</style>
      {cover}
      <h1>Alle Seiten</h1>
      <p className="sb-lead">{PAGES.length} Seiten des Dashboards mit Beispieldaten. Farbvorlage, Modus und Gerät stellst du oben in der Leiste um, sie gelten für alle Vorschauen. Ein Klick öffnet eine Seite groß.</p>
      <div className="sb-bar">
        <label>Größe <input type="range" min={0.15} max={0.6} step={0.01} value={scale} onChange={(e) => setScale(Number(e.target.value))} /></label>
        <span>{device === 'phone' ? 'Handy' : 'Desktop'} · {DEVICES[device].width} px</span>
      </div>
      {PAGE_GROUPS.map((group) => (
        <section key={group.title} className="sb-group">
          <h2>{group.title}</h2>
          <div className="sb-row">
            {group.pages.map((page) => <PageFrame key={page.key} page={page} scale={scale} device={device} globals={globals} onLoad={onLoad} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

export default { title: 'Übersicht', tags: ['!autodocs'], parameters: { ownDevice: true } } satisfies Meta;

export const AlleSeiten: StoryObj = {
  name: 'Alle Seiten',
  render: (_args, { globals }) => <Board key={globals.device} globals={globals as { scheme: string; mode: string; device: Device }} />,
};
