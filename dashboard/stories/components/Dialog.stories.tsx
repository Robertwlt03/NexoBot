// Modal and the confirmation dialog for destructive actions.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { useConfirm } from '../../src/components/ConfirmDialog';
import { Modal } from '../../src/components/ui';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Rückmeldung/Dialog',
  component: Modal,
  decorators: [withStage],
  parameters: {
    ...componentParameters(),
    // The dialog covers the whole window, so the docs page shows each example in its own frame.
    docs: {
      story: { inline: false, height: '420px' },
      description: {
        component: [
          '`Modal` legt einen Dialog über die Seite: Titel, Inhalt und Knöpfe unten (`footer`). Klick auf den dunklen Hintergrund ruft `onClose`. `wide` für breite Inhalte wie Vorschauen.',
          '',
          'Für Löschen und Zurücksetzen nicht selbst bauen, sondern `useConfirm()` aus `ConfirmDialog.tsx`: `const { confirm, dialog } = useConfirm();`, `{dialog}` einmal in die Seite setzen und `confirm({ title, text, confirmLabel, onConfirm })` aufrufen. Der Knopf ist rot, wartet auf `onConfirm` und zeigt solange „Einen Moment …“.',
        ].join('\n'),
      },
    },
  },
  args: {
    title: 'Kanal ändern',
    onClose: fn(),
    wide: false,
    children: <p className="muted">Nexo postet die Begrüßungen ab jetzt in #willkommen.</p>,
    footer: <><button type="button" className="btn btn-secondary">Abbrechen</button><button type="button" className="btn btn-primary">Übernehmen</button></>,
  },
  argTypes: { children: { control: false }, footer: { control: false } },
} satisfies Meta<typeof Modal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};

/** Rückfrage vor dem Löschen über `useConfirm()`. */
export const Bestaetigung: Story = {
  name: 'Bestätigung (useConfirm)',
  render: function Render() {
    const { confirm, dialog } = useConfirm();
    return (
      <>
        <button type="button" className="btn btn-danger" onClick={() => confirm({
          title: 'Event löschen?', text: 'Das Herbst-Event und alle Teilnahmen werden gelöscht.', confirmLabel: 'Löschen',
          onConfirm: () => new Promise((resolve) => setTimeout(resolve, 800)),
        })}>Event löschen</button>
        {dialog}
      </>
    );
  },
};
