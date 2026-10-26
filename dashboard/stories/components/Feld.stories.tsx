// Field and the plain inputs that go into it.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { ColorInput, Field, NumberInput, Select, TextArea, TextInput } from '../../src/components/ui';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Formular/Feld und Eingaben',
  component: Field,
  subcomponents: { TextInput, NumberInput, TextArea, Select, ColorInput },
  decorators: [withStage],
  parameters: {
    ...componentParameters(),
    docs: {
      description: {
        component: [
          '`Field` beschriftet eine Eingabe: Titel darüber, Hinweis (`hint`) oder Fehler (`error`) darunter. Darin steht genau eine Eingabe.',
          '',
          'Alle Eingaben sind kontrolliert: Sie bekommen `value` und melden Änderungen über `onChange` mit dem neuen Wert (nicht dem Event).',
          '',
          '- `TextInput`: einzeilig, optional `maxLength`.',
          '- `NumberInput`: Zahlen mit `min`, `max` und `step`.',
          '- `TextArea`: mehrzeilig. Mit `variables` erscheinen Platzhalter-Chips wie `{user}`, die ein Klick an der Cursorstelle einfügt.',
          '- `Select`: Auswahl aus festen Optionen (`{ value, label }`).',
          '- `ColorInput`: Farbwähler plus Hex-Feld.',
        ].join('\n'),
      },
    },
  },
  args: { label: 'Begrüßung', hint: 'Höchstens 120 Zeichen.', error: null, children: null },
  argTypes: { children: { control: false }, error: { control: 'text' } },
} satisfies Meta<typeof Field>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Einzeiliger Text. */
export const Text: Story = {
  render: function Render(args) {
    const [{ text = 'Willkommen auf dem Server!' }, update] = useArgs<{ text?: string }>();
    return <Field {...args}><TextInput value={text} onChange={(value) => update({ text: value })} maxLength={120} /></Field>;
  },
};

/** Mit Fehlermeldung. */
export const MitFehler: Story = {
  name: 'Mit Fehler',
  args: { label: 'Kanal-Name', hint: undefined, error: 'Der Name darf keine Leerzeichen enthalten.' },
  render: (args) => <Field {...args}><TextInput value="mein kanal" onChange={() => undefined} /></Field>,
};

/** Zahl mit Grenzen. */
export const Zahl: Story = {
  args: { label: 'XP pro Nachricht', hint: 'Zwischen 1 und 50.' },
  render: function Render(args) {
    const [{ amount = 15 }, update] = useArgs<{ amount?: number }>();
    return <Field {...args}><NumberInput value={amount} onChange={(value) => update({ amount: value })} min={1} max={50} /></Field>;
  },
};

/** Mehrzeilig mit Platzhalter-Chips. */
export const MitPlatzhaltern: Story = {
  name: 'Mehrzeilig mit Platzhaltern',
  args: { label: 'Nachricht', hint: 'Klick auf einen Platzhalter fügt ihn ein.' },
  render: function Render(args) {
    const [{ message = 'Hey {user}, willkommen auf {server}!' }, update] = useArgs<{ message?: string }>();
    return <Field {...args}><TextArea value={message} onChange={(value) => update({ message: value })} variables={['{user}', '{server}', '{memberCount}']} /></Field>;
  },
};

/** Auswahl aus festen Optionen. */
export const Auswahl: Story = {
  args: { label: 'Sprache', hint: undefined },
  render: function Render(args) {
    const [{ language = 'de' }, update] = useArgs<{ language?: string }>();
    return (
      <Field {...args}>
        <Select value={language} onChange={(value) => update({ language: value })} options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'Englisch' }]} />
      </Field>
    );
  },
};

/** Farbe mit Hex-Feld. */
export const Farbe: Story = {
  args: { label: 'Akzentfarbe', hint: 'Für Karten und Banner.' },
  render: function Render(args) {
    const [{ color = '#8FB36B' }, update] = useArgs<{ color?: string }>();
    return <Field {...args}><ColorInput value={color} onChange={(value) => update({ color: value })} /></Field>;
  },
};
