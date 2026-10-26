// Buttons (CSS classes, no component) and the Actions row that ends a card or form.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Actions } from '../../src/components/ui';
import { Icon } from '../../src/icons';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Aktionen/Knöpfe',
  component: Actions,
  decorators: [withStage],
  parameters: {
    ...componentParameters(),
    docs: {
      description: {
        component: [
          'Knöpfe sind keine eigene Komponente, sondern ein `<button>` mit den Klassen aus `styles.css`: immer `btn` plus eine Art.',
          '',
          '- `btn-primary`: die eine Hauptaktion einer Karte oder Seite (Speichern, Senden). Nimmt die Akzentfarbe der Farbvorlage.',
          '- `btn-secondary`: Nebenaktionen (Vorschau, Testen, Öffnen).',
          '- `btn-ghost`: leise Aktionen in Listen und Kopfzeilen (Bearbeiten, Mehr).',
          '- `btn-danger`: Löschen und Zurücksetzen; vorher mit `ConfirmDialog` nachfragen.',
          '- `btn-success`: Bestätigen in Discord-nahen Abläufen.',
          '- `btn-sm`: kleine Größe für Tabellen und Kartenköpfe.',
          '',
          'Icons kommen als `<Icon name="…" size={16} />` vor den Text. `Actions` stellt mehrere Knöpfe am Ende einer Karte oder eines Formulars in eine Reihe.',
        ].join('\n'),
      },
    },
  },
  args: { align: 'end', children: null },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof Actions>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Alle Arten nebeneinander. */
export const Arten: Story = {
  render: (args) => (
    <Actions {...args}>
      <button type="button" className="btn btn-primary">Speichern</button>
      <button type="button" className="btn btn-secondary">Vorschau</button>
      <button type="button" className="btn btn-ghost">Abbrechen</button>
      <button type="button" className="btn btn-success">Bestätigen</button>
      <button type="button" className="btn btn-danger">Löschen</button>
    </Actions>
  ),
};

/** `btn-sm` für Tabellenzeilen und Kartenköpfe. */
export const Klein: Story = {
  render: (args) => (
    <Actions {...args}>
      <button type="button" className="btn btn-secondary btn-sm">Bearbeiten</button>
      <button type="button" className="btn btn-ghost btn-sm">Mehr</button>
      <button type="button" className="btn btn-danger btn-sm">Entfernen</button>
    </Actions>
  ),
};

/** Mit Icon vor dem Text; reine Icon-Knöpfe brauchen ein `aria-label`. */
export const MitIcon: Story = {
  name: 'Mit Icon',
  render: (args) => (
    <Actions {...args}>
      <button type="button" className="btn btn-primary"><Icon name="plus" size={16} /> Neues Event</button>
      <button type="button" className="btn btn-secondary"><Icon name="refresh" size={16} /> Neu würfeln</button>
      <button type="button" className="btn btn-ghost btn-sm" aria-label="Schließen"><Icon name="x" size={16} /></button>
    </Actions>
  ),
};

/** Deaktiviert, solange nichts zu tun ist (zum Beispiel ohne Änderungen). */
export const Deaktiviert: Story = {
  render: (args) => (
    <Actions {...args}>
      <button type="button" className="btn btn-primary" disabled>Speichern</button>
      <button type="button" className="btn btn-secondary" disabled>Vorschau</button>
    </Actions>
  ),
};

/** `align="between"`: eine Aktion links, die anderen rechts. */
export const Verteilt: Story = {
  args: { align: 'between' },
  render: (args) => (
    <Actions {...args}>
      <button type="button" className="btn btn-danger">Zurücksetzen</button>
      <button type="button" className="btn btn-primary">Speichern</button>
    </Actions>
  ),
};
