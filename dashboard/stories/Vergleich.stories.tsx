// One page in all twelve colour schemes side by side. The page is picked in the controls below the preview;
// light/dark and desktop/phone come from the toolbar.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { THEME_PRESETS } from '../../src/shared/theme';
import { PAGES, pageByKey } from './pages';
import { PageFrame, frameStyles, type Device } from './frames';

interface Args { seite: string }

function Comparison({ seite, globals }: Args & { globals: { mode: string; device: Device } }) {
  const page = pageByKey(seite);
  const device = globals.device ?? 'desktop';
  const scale = device === 'phone' ? 0.42 : 0.26;
  return (
    <div className="sb-board">
      <style>{frameStyles}</style>
      <h1>{page.label} in allen Farbvorlagen</h1>
      <p className="sb-lead">Die Seite wählst du unten bei den Einstellungen, Modus und Gerät oben in der Leiste. Ein Klick öffnet die Vorlage groß.</p>
      <div className="sb-row" style={{ marginTop: 22 }}>
        {THEME_PRESETS.map((preset) => (
          <PageFrame key={preset.id} page={page} label={preset.name} scale={scale} device={device} globals={{ scheme: preset.id, mode: globals.mode }} />
        ))}
      </div>
    </div>
  );
}

export default {
  title: 'Vergleich',
  args: { seite: 'server-uebersicht' },
  argTypes: { seite: { name: 'Seite', options: PAGES.map((p) => p.key), control: { type: 'select', labels: Object.fromEntries(PAGES.map((p) => [p.key, p.label])) } } },
} satisfies Meta<Args>;

export const AlleFarbvorlagen: StoryObj<Args> = {
  name: 'Alle Farbvorlagen',
  render: (args, { globals }) => <Comparison {...args} globals={globals as { mode: string; device: Device }} />,
};
