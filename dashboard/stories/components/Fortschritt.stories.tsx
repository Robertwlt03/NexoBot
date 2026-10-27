// Meter: one progress bar for quests, season, pets and goals.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Meter } from '../../src/components/ui';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Rückmeldung/Fortschritt',
  component: Meter,
  decorators: [withStage],
  parameters: {
    ...componentParameters(),
    docs: { description: { component: 'Der einzige Fortschrittsbalken im Dashboard: Tagesaufgaben, Saisonpfad, Gemeinschaftsziele, Pflegetage der Begleiter und das Tageslimit. `value` und `max` geben den Stand, `label` benennt den Balken für Screenreader. Solange etwas läuft, ist der Balken in der Akzentfarbe; mit `done` wird er grün (Erfolg). Die Zahl dazu steht immer als Text daneben, der Balken ersetzt sie nicht.' } },
  },
  args: { value: 6, max: 10, label: 'Tagesaufgabe' },
  render: (args) => <div style={{ maxWidth: 360 }}><Meter {...args} /></div>,
} satisfies Meta<typeof Meter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Laufend: Story = {};
/** Ziel erreicht. */
export const Geschafft: Story = { args: { value: 10, done: true, label: 'Gemeinschaftsziel' } };
