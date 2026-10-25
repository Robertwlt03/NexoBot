// Channel and role pickers: they list the channels and roles of the current server (GuildContext).
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { ChannelSelect, Field, MultiChannelSelect, MultiRoleSelect, RoleSelect } from '../../src/components/ui';
import { componentParameters, withGuild, withStage } from './stage';

const meta = {
  title: 'Komponenten/Formular/Kanal und Rolle',
  component: ChannelSelect,
  subcomponents: { RoleSelect, MultiChannelSelect, MultiRoleSelect },
  decorators: [withStage, withGuild],
  parameters: {
    ...componentParameters(),
    docs: {
      description: {
        component: [
          'Auswahl von Kanälen und Rollen des Servers. Die Komponenten lesen die Liste selbst aus dem `GuildContext` (auf jeder Server-Seite vorhanden); hier kommen die Beispieldaten des ersten Beispielservers.',
          '',
          '- `ChannelSelect`: ein Kanal, nach Kategorie gruppiert. `kind` ist `text`, `voice` oder `category`; `allowNone` erlaubt „keiner“ (`null`).',
          '- `RoleSelect`: eine Rolle; `assignableOnly` zeigt nur Rollen, die Nexo vergeben darf.',
          '- `MultiChannelSelect` und `MultiRoleSelect`: mehrere, als Chips mit ×; `max` begrenzt die Anzahl.',
          '',
          'Gespeichert werden immer die IDs.',
        ].join('\n'),
      },
    },
  },
  args: { value: null, onChange: fn(), kind: 'text', allowNone: true, placeholder: 'Kanal auswählen' },
} satisfies Meta<typeof ChannelSelect>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Ein Textkanal. */
export const Kanal: Story = {
  render: function Render(args) {
    const [, update] = useArgs();
    return <Field label="Kanal"><ChannelSelect {...args} onChange={(value) => { args.onChange(value); update({ value }); }} /></Field>;
  },
};

/** Ein Sprachkanal. */
export const Sprachkanal: Story = { ...Kanal, args: { kind: 'voice', placeholder: 'Sprachkanal auswählen' } };

/** Eine Rolle. */
export const Rolle: Story = {
  render: function Render() {
    const [{ role = null }, update] = useArgs<{ role?: string | null }>();
    return <Field label="Rolle beim Beitritt"><RoleSelect value={role} onChange={(value) => update({ role: value })} assignableOnly /></Field>;
  },
};

/** Mehrere Kanäle und Rollen. */
export const Mehrere: Story = {
  render: function Render() {
    const [{ channels = [], roles = [] }, update] = useArgs<{ channels?: string[]; roles?: string[] }>();
    return (
      <div style={{ display: 'grid', gap: 18, maxWidth: 560 }}>
        <Field label="Ausgenommene Kanäle"><MultiChannelSelect value={channels} onChange={(value) => update({ channels: value })} /></Field>
        <Field label="Ausgenommene Rollen" hint="Höchstens 5."><MultiRoleSelect value={roles} onChange={(value) => update({ roles: value })} max={5} /></Field>
      </div>
    );
  },
};
