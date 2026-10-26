// Stats: a row of number tiles.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stats } from '../../src/components/ui';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Layout/Kennzahlen',
  component: Stats,
  decorators: [withStage],
  parameters: {
    ...componentParameters(['scheme', 'mode', 'device']),
    docs: { description: { component: 'Eine Reihe Zahlenkacheln über einer Seite oder Karte: Übersicht, Ticket-Statistik, Zählspiel. Jede Kachel hat eine Beschriftung, den Wert und optional einen Hinweis darunter. Am Handy stehen die Kacheln zu zweit nebeneinander.' } },
  },
  args: {
    items: [
      { label: 'Mitglieder', value: '1.342', hint: '+166 im Zeitraum' },
      { label: 'Nachrichten', value: '56.888' },
      { label: 'Aktiv pro Tag', value: '128' },
      { label: 'Tickets offen', value: '4', hint: '2 seit über 24 h' },
    ],
  },
} satisfies Meta<typeof Stats>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};

/** Zwei Kacheln. */
export const Zwei: Story = { args: { items: [{ label: 'Gesamt', value: '2.410' }, { label: 'Heute', value: '37', hint: 'Rekord: 112' }] } };
