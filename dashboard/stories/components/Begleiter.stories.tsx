// The companions ("Begleiter"): every species with its own line of four forms, drawn with the bot's code.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PET_SPECIES, RARITY_LABELS, type PetData, type Rarity } from '../../../src/shared/cosmetics';
import { PET_FORM_NAMES, PET_STAGE_CARE, PET_STAGE_NAMES } from '../../../src/shared/pets';
import { PetPortrait } from '../../src/me/PetCare';
import { componentParameters, withStage } from './stage';

const COLORS: Record<PetData['species'], string> = {
  fox: '#E8833A', owl: '#9C7A5B', cat: '#8E95A3', axolotl: '#F7A1C4', dragon: '#4FB477', bunny: '#E9DCCB', penguin: '#2F3A56', panda: '#F5F2EA', frog: '#5DBB63',
  butterfly: '#7C9CFF', chicken: '#F5F0E6', dog: '#C98A4B', wolf: '#8A93A3', horse: '#B07A4A', turtle: '#6B8E4E', koi: '#F97316', snail: '#D97757', hedgehog: '#8B6B4A',
  bat: '#6B5B8A', squirrel: '#C2703D', hamster: '#E9B872', bee: '#FBBF24', octopus: '#E26D8A', jellyfish: '#A78BFA', seahorse: '#F59E0B', crab: '#E5484D',
  snake: '#4FB477', chameleon: '#7ED957', sloth: '#A88B6A', raccoon: '#8A8F99', sparrow: '#A0764A', parrot: '#34D399', mushroom: '#E5484D', slime: '#5EEAD4',
  ghost: '#E5E7EB', golem: '#9CA3AF', salamander: '#2B2B33', whale: '#3B82F6', bear: '#8B5E3C',
};
const tile = { display: 'grid', justifyItems: 'center', gap: 4, padding: 8, borderRadius: 14, background: 'rgb(0 0 0 / .2)', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' } as const;

const meta = {
  title: 'Komponenten/Profil/Begleiter',
  component: PetPortrait,
  decorators: [withStage],
  parameters: {
    ...componentParameters(['scheme']),
    docs: {
      description: {
        component: [
          '- `PetPortrait`: zeichnet ein Tier mit demselben Code wie der Bot (`drawPet` in `src/shared/petArt.ts`) auf ein Canvas, in seiner Form und Laune. `size` ist die Kantenlänge in Pixeln.',
          '- Jede Art hat eine eigene Linie aus vier Formen (Babyform, Jugendform, Erwachsenenform, Kronenform), oft vom Ei, der Larve oder der Kaulquappe bis zu einem Fantasiewesen. Die Namen stehen in `PET_FORM_NAMES`.',
          '- Ein Pflegetag ist eine Fütterung; Futter gibt es nur für alle drei Tagesaufgaben. Wie viele Pflegetage eine Form braucht, hängt von der Seltenheit ab (`PET_STAGE_CARE`).',
          '- `hungry`: nach einem verpassten Tag ist das Tier traurig (Lider hängen, eine Träne, etwas grauer). Es behält seine Form, aber der Weg zur nächsten beginnt neu.',
          '- Die Karte „Begleiter“ (`PetCareCard`) mit Füttern-Knopf steht auf der Seite „Profil“.',
        ].join('\n'),
      },
    },
  },
  args: { pet: { species: 'fox', color: COLORS.fox }, stage: 3, hungry: false, size: 140 },
} satisfies Meta<typeof PetPortrait>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Einzeln: Story = {};

/** Eine Linie durch alle vier Formen, darunter jede Form traurig. */
export const Formen: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 150px))', gap: 12 }}>
      {[false, true].flatMap((sad) => PET_STAGE_NAMES.map((name, i) => (
        <div key={`${name}${sad}`} style={tile}>
          <PetPortrait pet={args.pet} stage={i + 1} hungry={sad} size={120} />
          <b style={{ color: 'var(--text-strong)' }}>{PET_FORM_NAMES[args.pet.species][i]}</b>
          {name}{sad ? ' · traurig' : ''}
        </div>
      )))}
    </div>
  ),
};

/** Alle 39 Linien mit ihren vier Formen. */
export const AlleLinien: Story = {
  name: 'Alle Linien',
  render: () => (
    <div style={{ display: 'grid', gap: 10 }}>
      {PET_SPECIES.map((species) => (
        <div key={species} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 130px))', gap: 8 }}>
          {PET_FORM_NAMES[species].map((name, i) => (
            <div key={name} style={tile}><PetPortrait pet={{ species, color: COLORS[species] }} stage={i + 1} hungry={false} size={96} />{name}</div>
          ))}
        </div>
      ))}
    </div>
  ),
};

/** Wie viele Pflegetage jede Form je nach Seltenheit braucht. */
export const Dauer: Story = {
  render: () => (
    <table className="table" style={{ maxWidth: 560 }}>
      <thead><tr><th>Seltenheit</th>{PET_STAGE_NAMES.slice(1).map((name) => <th key={name}>{name} ab</th>)}</tr></thead>
      <tbody>
        {(Object.keys(PET_STAGE_CARE) as Rarity[]).map((rarity) => (
          <tr key={rarity}><td>{RARITY_LABELS[rarity]}</td>{PET_STAGE_CARE[rarity].slice(1).map((days) => <td key={days}>{days} Tagen</td>)}</tr>
        ))}
      </tbody>
    </table>
  ),
};
