// The companions ("Begleiter"): every species and the four evolution stages, drawn with the bot's code.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PET_SPECIES, type PetData } from '../../../src/shared/cosmetics';
import { PET_STAGE_CARE, PET_STAGE_NAMES } from '../../../src/shared/pets';
import { PetPortrait } from '../../src/me/PetCare';
import { componentParameters, withStage } from './stage';

const COLORS: Record<PetData['species'], string> = {
  fox: '#E8833A', owl: '#9C7A5B', cat: '#8E95A3', axolotl: '#F7A1C4', dragon: '#4FB477', bunny: '#E9DCCB', penguin: '#2F3A56', panda: '#F5F2EA', frog: '#5DBB63',
};
const tile = { display: 'grid', justifyItems: 'center', gap: 6, padding: 10, borderRadius: 14, background: 'rgb(0 0 0 / .2)', fontSize: 12.5, color: 'var(--text-muted)' } as const;

const meta = {
  title: 'Komponenten/Profil/Begleiter',
  component: PetPortrait,
  decorators: [withStage],
  parameters: {
    ...componentParameters(['scheme']),
    docs: {
      description: {
        component: [
          '- `PetPortrait`: zeichnet ein Tier mit demselben Code wie der Bot (`drawPet` in `src/shared/pets.ts`) auf ein Canvas, in seiner Form und Laune. `size` ist die Kantenlänge in Pixeln.',
          '- Formen: Babyform (rundlich, große Augen, Eierschale als Hut), Jugendform (Halstuch), Erwachsenenform (Halsband mit Goldmarke und Funkeln) und Kronenform (Krone und goldene Aura), ab 0, 5, 15 und 40 Pflegetagen. Ein Pflegetag ist eine Fütterung; Futter gibt es nur für alle drei Tagesaufgaben.',
          '- `hungry`: nach zwei Tagen ohne Futter hängen die Lider und eine Träne läuft; das Tier wächst dann nicht weiter.',
          '- Die Karte „Begleiter“ (`PetCareCard`) mit Füttern-Knopf steht auf der Seite „Profil“.',
        ].join('\n'),
      },
    },
  },
  args: { pet: { species: 'fox', color: COLORS.fox }, stage: 2, hungry: false, size: 140 },
} satisfies Meta<typeof PetPortrait>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Einzeln: Story = {};

/** Ein Tier durch alle vier Formen, rechts hungrig. */
export const Formen: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {PET_STAGE_NAMES.map((name, i) => (
        <div key={name} style={tile}><PetPortrait pet={args.pet} stage={i + 1} hungry={false} size={130} />{name} · ab {PET_STAGE_CARE[i]} Tagen</div>
      ))}
      <div style={tile}><PetPortrait pet={args.pet} stage={2} hungry size={130} />Hungrig</div>
    </div>
  ),
};

/** Alle Arten in der Erwachsenenform. */
export const AlleArten: Story = {
  name: 'Alle Arten',
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
      {PET_SPECIES.map((species) => (
        <div key={species} style={tile}><PetPortrait pet={{ species, color: COLORS[species] }} stage={3} hungry={false} size={110} />{species}</div>
      ))}
    </div>
  ),
};
