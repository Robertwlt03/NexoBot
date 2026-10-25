// Brand parts: the logo, the Bernis coins and the icon set.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { COIN_TIERS } from '../../../src/shared/coins';
import { CoinIcon } from '../../src/components/CoinIcon';
import { NexoLogo } from '../../src/components/NexoLogo';
import { Icon, IconTile } from '../../src/icons';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Marke',
  component: NexoLogo,
  subcomponents: { CoinIcon, Icon, IconTile },
  decorators: [withStage],
  parameters: {
    ...componentParameters(['mode']),
    docs: {
      description: {
        component: [
          'Feste Markenteile; sie folgen nicht der Farbvorlage.',
          '',
          '- `NexoLogo`: der Holztaler mit dem Roboter. Groß mit `animated` (schwebt, blinzelt) und `followPointer` (Augen folgen der Maus); klein in Seitenleiste und Avatar mit `animated={false}`. Die Größe kommt über `className`, zum Beispiel `w-24`.',
          '- `CoinIcon`: die Bernis-Münzen in vier Stufen (`tier`: platinum, gold, silver, bronze), Größe über `size`.',
          '- `Icon`: Linien-Icons aus `icons.tsx` (`name`, `size`), in Knöpfen 16 px. `IconTile` ist die Kachel im Seitenkopf. Alle Namen stehen unter Grundlagen → Icons.',
        ].join('\n'),
      },
    },
  },
  args: { className: 'w-40', animated: true, followPointer: true, title: 'Nexo' },
} satisfies Meta<typeof NexoLogo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Logo: Story = {};

/** Die Größen in Seitenleiste, Avatar und Favicon. */
export const Klein: Story = {
  render: () => <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}><NexoLogo className="w-16" animated={false} /><NexoLogo className="w-9" animated={false} /><NexoLogo className="w-6" animated={false} /></div>,
};

/** Bernis-Münzen in drei Größen. */
export const Muenzen: Story = {
  name: 'Münzen',
  render: () => (
    <div style={{ display: 'grid', gap: 14 }}>
      {[48, 24, 16].map((size) => (
        <div key={size} style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          {COIN_TIERS.map(({ tier, label }) => <span key={tier} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><CoinIcon tier={tier} size={size} />{size === 48 ? label : null}</span>)}
        </div>
      ))}
    </div>
  ),
};

/** Icon und Icon-Kachel. */
export const Icons: Story = {
  render: () => <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}><Icon name="gift" /><Icon name="coins" size={16} /><IconTile name="welcome" size={52} /></div>,
};
