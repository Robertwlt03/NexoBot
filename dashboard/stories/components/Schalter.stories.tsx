// Switch and SwitchRow: turning features on and off.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { Switch, SwitchRow } from '../../src/components/ui';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Formular/Schalter',
  component: Switch,
  subcomponents: { SwitchRow },
  decorators: [withStage],
  parameters: {
    ...componentParameters(),
    docs: { description: { component: '`Switch` schaltet etwas sofort an oder aus. Allein (etwa rechts im Kartenkopf) braucht er ein `label` für Screenreader. `SwitchRow` ist die Zeile mit Titel, Beschreibung und Schalter für Listen von Optionen; den Namen für Screenreader übernimmt sie selbst.' } },
  },
  args: { checked: true, disabled: false, label: 'Modul aktiv', onChange: fn() },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Klick schaltet um; `onChange` meldet den neuen Zustand. */
export const Standard: Story = {
  render: function Render(args) {
    const [, update] = useArgs();
    return <Switch {...args} onChange={(value) => { args.onChange(value); update({ checked: value }); }} />;
  },
};

export const Deaktiviert: Story = { args: { disabled: true } };

/** Zeilen mit Titel und Beschreibung. */
export const Zeilen: Story = {
  render: function Render() {
    const [{ dm = true, ping = false }, update] = useArgs<{ dm?: boolean; ping?: boolean }>();
    return (
      <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
        <SwitchRow title="Per DM begrüßen" description="Schickt neuen Mitgliedern zusätzlich eine Direktnachricht." checked={dm} onChange={(value) => update({ dm: value })} />
        <SwitchRow title="Mitglied erwähnen" description="Pingt das neue Mitglied in der Nachricht an." checked={ping} onChange={(value) => update({ ping: value })} />
      </div>
    );
  },
};
