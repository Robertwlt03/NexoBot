// Charts of the statistics pages; colours follow the member's colour scheme.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Chart, Heatmap, HorizontalBars, Sparkline } from '../../src/components/charts';
import { componentParameters, withStage } from './stage';

const days = Array.from({ length: 30 }, (_, i) => i);
const wave = (base: number, amp: number) => days.map((i) => Math.round(base + Math.sin(i / 3) * amp + i * amp / 10));
const labels = days.map((i) => `${i + 1}.10.`);
const longLabels = days.map((i) => `${i + 1}.10.2026`);
const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const hours = Array.from({ length: 24 }, (_, h) => String(h));

const meta = {
  title: 'Komponenten/Diagramme',
  component: Chart,
  subcomponents: { Sparkline, Heatmap, HorizontalBars },
  decorators: [withStage],
  parameters: {
    ...componentParameters(['scheme', 'mode', 'device']),
    docs: {
      description: {
        component: [
          'Selbst gezeichnete SVG-Diagramme der Statistik-Seiten. Die Farben kommen aus der Farbvorlage des Mitglieds (`useChartTheme`); probier oben andere Vorlagen und Hell/Dunkel. Jedes Diagramm in einer Karte hat „Als Tabelle“ und zeigt beim Überfahren oder mit der Tastatur die Werte.',
          '',
          '- `Chart`: Verlauf über Tage. `kind` ist `line`, `bars` (mehrere Reihen nebeneinander) oder `stacked`. `labels` stehen an der Achse, `longLabels` im Tooltip. Höchstens vier Reihen; mehr fasst man zu „Andere“ zusammen.',
          '- `Sparkline`: kleiner Verlauf ohne Achsen, etwa in Kennzahlen.',
          '- `Heatmap`: Wochentag × Stunde.',
          '- `HorizontalBars`: Rangliste; `ordinal` färbt die Balken in Stufen (für Reihenfolgen wie Altersgruppen).',
        ].join('\n'),
      },
    },
  },
  args: { title: 'Mitgliederentwicklung', kind: 'line', labels, longLabels, series: [{ name: 'Mitglieder', values: wave(1200, 30) }] },
  argTypes: { labels: { control: false }, longLabels: { control: false }, series: { control: false }, format: { control: false } },
} satisfies Meta<typeof Chart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Linie: Story = {};

/** Zwei Reihen als Balken. */
export const Balken: Story = {
  args: { title: 'Beitritte und Austritte', kind: 'bars', series: [{ name: 'Beitritte', values: wave(12, 5) }, { name: 'Austritte', values: wave(6, 3) }] },
};

/** Gestapelt: Anteile pro Tag. */
export const Gestapelt: Story = {
  args: { title: 'Nachrichten nach Kanal', kind: 'stacked', series: [{ name: '#allgemein', values: wave(300, 60) }, { name: '#gaming', values: wave(160, 40) }, { name: 'Andere', values: wave(80, 20) }] },
};

/** Kleiner Verlauf ohne Achsen. */
export const Mini: Story = { name: 'Sparkline', render: () => <div style={{ width: 220 }}><Sparkline values={wave(40, 12)} /></div> };

/** Aktivität nach Wochentag und Stunde. */
export const Waerme: Story = {
  name: 'Heatmap',
  render: () => (
    <Heatmap title="Aktivität nach Uhrzeit" rows={weekdays} cols={hours} unit="Nachrichten"
      values={weekdays.map((_, d) => hours.map((_, h) => Math.round(Math.max(0, Math.sin((h - 6) / 4) * 40 + (d >= 5 ? 20 : 0)))))}
      cellLabel={(row, col) => `${weekdays[row]} ${col}–${col + 1} Uhr`} />
  ),
};

/** Rangliste. */
export const Rangliste: Story = {
  name: 'Horizontale Balken',
  render: () => (
    <HorizontalBars title="Aktivste Kanäle" unit="Nachrichten"
      items={[{ key: 'a', label: '#allgemein', value: 4210 }, { key: 'b', label: '#gaming', value: 2380 }, { key: 'c', label: '#memes', value: 1904, detail: '12 %' }, { key: 'd', label: '#musik', value: 610 }]} />
  ),
};
