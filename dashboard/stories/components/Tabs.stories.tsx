// Tabs and Pager: switching between views and paging through lists.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { Pager, Tabs } from '../../src/components/ui';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Layout/Tabs und Seiten',
  component: Tabs,
  subcomponents: { Pager },
  decorators: [withStage],
  parameters: {
    ...componentParameters(['scheme', 'mode', 'device']),
    docs: { description: { component: '`Tabs` wechselt zwischen Ansichten derselben Seite; der Hintergrund gleitet zum aktiven Reiter, `count` zeigt eine Zahl daneben. Zu viele Reiter scrollen am Handy seitlich. `Pager` blättert unter Listen und Tabellen und erscheint erst ab zwei Seiten.' } },
  },
  args: {
    value: 'aktivitaet',
    onChange: fn(),
    items: [{ id: 'ueberblick', label: 'Überblick' }, { id: 'aktivitaet', label: 'Aktivität', count: 12 }, { id: 'mitglieder', label: 'Mitglieder' }],
  },
} satisfies Meta<typeof Tabs<string>>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Klick auf einen Reiter wechselt ihn; `onChange` meldet die neue `id`. */
export const Standard: Story = {
  render: function Render(args) {
    const [, update] = useArgs();
    return <Tabs {...args} onChange={(value) => { args.onChange(value); update({ value }); }} />;
  },
};

/** Blättern unter einer Liste. */
export const Blaettern: Story = {
  name: 'Blättern (Pager)',
  render: function Render() {
    const [{ page = 2 }, update] = useArgs<{ page?: number }>();
    return <Pager page={page} pages={7} onPage={(next) => update({ page: next })} />;
  },
};
