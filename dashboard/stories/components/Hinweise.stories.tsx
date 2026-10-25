// Notice, Badge, Empty and Spinner: telling the member what is going on.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { Badge, Empty, Notice, Spinner } from '../../src/components/ui';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Rückmeldung/Hinweise',
  component: Notice,
  subcomponents: { Badge, Empty, Spinner },
  decorators: [withStage],
  parameters: {
    ...componentParameters(),
    docs: {
      description: {
        component: [
          '- `Notice`: ein Hinweis im Seitenfluss. Ohne `tone` neutral, `warn` für Achtung, `danger` für Fehler. Mit `onRetry` erscheint „Erneut versuchen“ (für Ladefehler).',
          '- `Badge`: ein kleiner Zustand neben Titeln oder in Tabellen; `on` färbt ihn in der Akzentfarbe.',
          '- `Empty`: Platzhalter, wenn eine Liste noch leer ist, mit Titel und einem Satz, was zu tun ist.',
          '- `Spinner`: pulsierende Zeilen, solange Daten laden.',
        ].join('\n'),
      },
    },
  },
  args: { children: 'Änderungen gelten erst nach dem Speichern.' },
  argTypes: { tone: { control: 'inline-radio', options: ['neutral', 'warn', 'danger'], mapping: { neutral: undefined } } },
} satisfies Meta<typeof Notice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};
export const Achtung: Story = { args: { tone: 'warn', children: 'Der Kanal ist für Nexo nicht sichtbar.' } };
/** Ladefehler mit „Erneut versuchen“. */
export const Fehler: Story = { args: { tone: 'danger', children: 'Die Daten konnten nicht geladen werden.', onRetry: fn() } };

/** Zustände als Badge. */
export const Badges: Story = { render: () => <div style={{ display: 'flex', gap: 8 }}><Badge on>Aktiv</Badge><Badge>Aus</Badge><Badge on>3 neu</Badge></div> };

/** Leere Liste. */
export const Leer: Story = { render: () => <Empty title="Noch keine Tickets">Sobald jemand ein Ticket öffnet, erscheint es hier.</Empty> };

/** Während Daten laden. */
export const Laden: Story = { render: () => <Spinner /> };
