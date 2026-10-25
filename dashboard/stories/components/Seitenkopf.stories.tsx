// PageHeader: the header at the top of every dashboard page.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PageHeader } from '../../src/components/ui';
import { ICON_PATHS } from '../../src/icons';
import { componentParameters, withRouter, withStage } from './stage';

const meta = {
  title: 'Komponenten/Layout/Seitenkopf',
  component: PageHeader,
  decorators: [withStage, withRouter],
  parameters: {
    ...componentParameters(['scheme', 'mode', 'device']),
    docs: {
      description: {
        component: 'Der Kopf jeder Dashboard-Seite, genau einer pro Seite. Die kleine Zeile über dem Titel ist die Gruppe des Moduls aus der Seitenleiste (aus `modules/registry.ts`); mit `kicker` setzt du sie selbst. Links steht die Icon-Kachel (`icon`) oder eigene Grafik (`media`), rechts die Aktionen der Seite.',
      },
    },
  },
  args: {
    icon: 'welcome',
    title: 'Willkommen',
    description: 'Begrüße neue Mitglieder mit einer Nachricht und einer Karte.',
  },
  argTypes: { actions: { control: false }, media: { control: false }, icon: { control: 'select', options: Object.keys(ICON_PATHS) } },
} satisfies Meta<typeof PageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {};

/** Mit Aktionen rechts, zum Beispiel Vorschau und Test. */
export const MitAktionen: Story = {
  name: 'Mit Aktionen',
  args: {
    actions: (
      <>
        <button type="button" className="btn btn-secondary">Vorschau</button>
        <button type="button" className="btn btn-primary">Testnachricht senden</button>
      </>
    ),
  },
};

/** Eigene Gruppenzeile statt der aus der Navigation. */
export const EigeneGruppe: Story = { name: 'Eigene Gruppe', args: { kicker: 'Mein Profil', icon: 'coins', title: 'Shop', description: 'Hintergründe, Rahmen und Abzeichen für deine Profilkarte.' } };
