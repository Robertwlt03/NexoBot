// Card: the box every settings group and list sits in.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Actions, Badge, Card, Field, Switch, TextInput } from '../../src/components/ui';
import { ICON_PATHS } from '../../src/icons';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Layout/Karte',
  component: Card,
  decorators: [withStage],
  parameters: {
    ...componentParameters(),
    docs: {
      description: {
        component: 'Die Fläche, in der jede Einstellungsgruppe, Liste oder Statistik steht. Titel und Beschreibung oben, rechts optional ein Schalter oder Knopf (`right`). `disabled` blendet den Inhalt ab, etwa solange ein Modul ausgeschaltet ist. Mehrere Karten stehen in `grid gap-5` untereinander oder nebeneinander.',
      },
    },
  },
  args: { title: 'Willkommensnachricht', description: 'Wird gesendet, wenn jemand dem Server beitritt.', icon: 'welcome', disabled: false },
  argTypes: { right: { control: false }, children: { control: false }, icon: { control: 'select', options: Object.keys(ICON_PATHS) } },
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Mit Formularfeld und Aktionen am Ende. */
export const MitFormular: Story = {
  name: 'Mit Formular',
  args: {
    right: <Switch checked onChange={() => undefined} label="Aktiv" />,
    children: (
      <>
        <Field label="Kanal-Text" hint="Platzhalter wie {user} werden ersetzt."><TextInput value="Willkommen, {user}!" onChange={() => undefined} /></Field>
        <Actions><button type="button" className="btn btn-primary">Speichern</button></Actions>
      </>
    ),
  },
};

/** Nur Titel und Inhalt. */
export const Einfach: Story = { args: { icon: undefined, description: undefined, children: <p>Inhalt der Karte.</p> } };

/** Ausgeschaltet: der Inhalt ist abgeblendet und nicht bedienbar. */
export const Ausgeschaltet: Story = { args: { disabled: true, right: <Badge>Aus</Badge>, children: <p>Das Modul ist ausgeschaltet.</p> } };
