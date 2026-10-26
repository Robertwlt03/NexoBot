// SaveBar: appears as soon as a settings page has unsaved changes.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { SaveBar } from '../../src/components/ui';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Rückmeldung/Speicherleiste',
  component: SaveBar,
  decorators: [withStage],
  parameters: {
    ...componentParameters(['scheme', 'mode', 'device']),
    docs: {
      story: { inline: false, height: '160px' },
      description: { component: 'Die Leiste unten auf Einstellungsseiten, wie bei Discord: Sie gleitet herein, sobald `dirty` wahr ist, und verschwindet nach dem Speichern. Auf Modul-Seiten nicht selbst einbauen: `SettingsPage` mit `useSettings` bringt sie mit. Schalte `dirty` unten in den Controls um.' },
    },
  },
  args: { dirty: true, saving: false, onSave: fn(), onReset: fn() },
} satisfies Meta<typeof SaveBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ungespeichert: Story = {};
export const Speichert: Story = { args: { saving: true } };
