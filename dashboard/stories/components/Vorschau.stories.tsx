// Previews of what members see in Discord: a message with placeholders and the profile and level-up cards.
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ProfileCardSubject, ResolvedCosmetics } from '../../../src/shared/cosmetics';
import { LevelUpPreview, ProfileCardPreview } from '../../src/components/ProfileCardPreview';
import { MessagePreview } from '../../src/components/ui';
import { componentParameters, withStage } from './stage';

const subject: ProfileCardSubject = {
  name: 'Lena', username: 'lena', avatarUrl: null, bio: 'Spielt Vier gewinnt und sammelt Herbst-Sticker.', level: 24, xp: 900, xpNeeded: 1370, rank: 1, serverName: 'Nexo Café', balance: 4850,
};
const plain: ResolvedCosmetics = {
  background: null, accent: null, nameStyle: null, frame: null, badges: [], title: null, xpBar: null, font: null, effect: null, levelup: null, layout: null, sticker: null, pet: null,
};

const meta = {
  title: 'Komponenten/Discord/Vorschau',
  component: MessagePreview,
  subcomponents: { ProfileCardPreview, LevelUpPreview },
  decorators: [withStage],
  parameters: {
    ...componentParameters(['mode']),
    docs: {
      description: {
        component: [
          '- `MessagePreview`: zeigt eine Nachricht, die ein Admin einstellt, so wie sie in Discord ankommt. Platzhalter wie `{user}` werden mit `sample` ersetzt, `**fett**`, `*kursiv*` und `` `Code` `` wie in Discord dargestellt. Optional mit Embed (`embed`).',
          '- `ProfileCardPreview` und `LevelUpPreview`: zeichnen die Profil- und Level-up-Karte mit demselben Code wie der Bot (`src/shared/profileCard.ts`) auf ein Canvas. `cosmetics` sind die gekauften Artikel; ohne Artikel kommt das Grunddesign.',
        ].join('\n'),
      },
    },
  },
  args: {
    content: 'Hey **{user}**, willkommen auf *{server}*! Du bist Mitglied Nummer {memberCount}.',
    embed: { title: 'Schön, dass du da bist', description: 'Lies kurz die Regeln in #regeln.', color: '#8FB36B', footer: 'Nexo Café' },
    sample: { '{user}': '@Lena', '{server}': 'Nexo Café', '{memberCount}': '1.342' },
  },
} satisfies Meta<typeof MessagePreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Nachricht: Story = {};
export const OhneEmbed: Story = { name: 'Ohne Embed', args: { embed: null } };

/** Profilkarte ohne gekaufte Artikel. */
export const Profilkarte: Story = { render: () => <div style={{ maxWidth: 760 }}><ProfileCardPreview subject={subject} cosmetics={plain} /></div> };

/** Level-up-Karte mit Belohnung. */
export const LevelUp: Story = { name: 'Level-up', render: () => <div style={{ maxWidth: 760 }}><LevelUpPreview subject={subject} cosmetics={plain} level={25} reward={250} /></div> };
