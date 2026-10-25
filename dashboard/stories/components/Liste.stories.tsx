// TagInput: an editable list of short entries.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useArgs } from 'storybook/preview-api';
import { fn } from 'storybook/test';
import { TagInput } from '../../src/components/ui';
import { componentParameters, withStage } from './stage';

const meta = {
  title: 'Komponenten/Formular/Liste',
  component: TagInput,
  decorators: [withStage],
  parameters: {
    ...componentParameters(),
    docs: { description: { component: 'Eine bearbeitbare Liste kurzer Einträge, etwa gesperrte Wörter oder Quizfragen. Enter fügt den getippten Eintrag hinzu, × entfernt ihn. `max` begrenzt die Anzahl.' } },
  },
  args: { value: ['spam', 'werbung', 'discord.gg'], onChange: fn(), max: 20 },
} satisfies Meta<typeof TagInput>;
export default meta;

export const Standard: StoryObj<typeof meta> = {
  render: function Render(args) {
    const [, update] = useArgs();
    return <TagInput {...args} onChange={(value) => { args.onChange(value); update({ value }); }} />;
  },
};
