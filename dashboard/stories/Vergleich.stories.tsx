// One page in all twelve colour schemes side by side. The page is picked on the page itself (kept in the story's
// args, so it stays in the address); light/dark and desktop/phone come from the toolbar.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { THEME_PRESETS } from '../../src/shared/theme';
import { PAGE_GROUPS, pageByKey } from './pages';
import { PageFrame, frameStyles, useFramesLoading, type Device } from './frames';

interface Args { seite: string }

function Comparison({ seite, globals, onPage }: Args & { globals: { mode: string; device: Device }; onPage: (seite: string) => void }) {
  const page = pageByKey(seite);
  const device = globals.device ?? 'desktop';
  const scale = device === 'phone' ? 0.42 : 0.26;
  const { cover, onLoad } = useFramesLoading(THEME_PRESETS.length);
  return (
    <div className="sb-board">
      <style>{frameStyles}</style>
      {cover}
      <h1>{page.label} in allen Farbvorlagen</h1>
      <p className="sb-lead">Modus und Gerät stellst du oben in der Leiste um. Ein Klick öffnet eine Vorlage groß.</p>
      <div className="sb-bar">
        <label>Seite{' '}
          <select className="sb-select" value={seite} onChange={(e) => onPage(e.target.value)}>
            {PAGE_GROUPS.map((group) => (
              <optgroup key={group.title} label={group.title}>
                {group.pages.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      <div className="sb-row" style={{ marginTop: 22 }}>
        {THEME_PRESETS.map((preset) => (
          <PageFrame key={preset.id} page={page} label={preset.name} scale={scale} device={device} globals={{ scheme: preset.id, mode: globals.mode }} onLoad={onLoad} />
        ))}
      </div>
    </div>
  );
}

export default {
  title: 'Vergleich',
  tags: ['!autodocs'],
  // Shows every colour scheme itself, so the scheme switch would change nothing.
  parameters: { ownDevice: true, switches: ['mode', 'device'] },
  args: { seite: 'server-uebersicht' },
  argTypes: { seite: { control: false } },
} satisfies Meta<Args>;

export const AlleFarbvorlagen: StoryObj<Args> = {
  name: 'Alle Farbvorlagen',
  // Storybook's hooks only work in the render function itself, not in a component below it.
  render: function Render(args, { globals }) {
    const [, updateArgs] = useArgs<Args>();
    return <Comparison onPage={(seite) => updateArgs({ seite })} key={`${args.seite}-${globals.device}`} {...args} globals={globals as { mode: string; device: Device }} />;
  },
};
