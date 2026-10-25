// TableWrap: tables that stay readable on phones.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, TableWrap } from '../../src/components/ui';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Layout/Tabelle',
  component: TableWrap,
  decorators: [withStage],
  parameters: {
    ...componentParameters(['scheme', 'mode', 'device']),
    docs: { description: { component: 'Jede Tabelle steht in `TableWrap`. Du gibst nur `<thead>` und `<tbody>` hinein, die Komponente baut die Tabelle mit der Klasse `table`. Am Handy wird jede Zeile zu einem Block, und vor jedem Wert steht die Spaltenüberschrift; keine Spalte verschwindet hinter seitlichem Scrollen. Schalte oben auf „Handy“, um das zu sehen.' } },
  },
  args: {
    children: (
      <>
        <thead><tr><th>Mitglied</th><th>Level</th><th>Nachrichten</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Lena</td><td>24</td><td>3.120</td><td><Badge on>Aktiv</Badge></td></tr>
          <tr><td>Alex</td><td>19</td><td>2.004</td><td><Badge on>Aktiv</Badge></td></tr>
          <tr><td>Sam</td><td>7</td><td>412</td><td><Badge>Pausiert</Badge></td></tr>
        </tbody>
      </>
    ),
  },
  argTypes: { children: { control: false } },
} satisfies Meta<typeof TableWrap>;
export default meta;

export const Standard: StoryObj<typeof meta> = {};
