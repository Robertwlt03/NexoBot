// The small parts the pages are built from, in the toolbar's colour scheme: logo, coins, cards and notices,
// the profile card and the charts.
import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ProfileCardSubject, ResolvedCosmetics } from '../../src/shared/cosmetics';
import { COIN_TIERS } from '../../src/shared/coins';
import { NexoLogo } from '../src/components/NexoLogo';
import { CoinIcon } from '../src/components/CoinIcon';
import { ProfileCardPreview } from '../src/components/ProfileCardPreview';
import { Chart, Sparkline } from '../src/components/charts';
import { Badge, Card, Empty, Notice, Stats, Switch, Tabs } from '../src/components/ui';

const Sheet = ({ title, children }: { title: string; children: ReactNode }) => (
  <div style={{ minHeight: '100vh', padding: 'clamp(14px, 4vw, 32px)', background: 'var(--bg-main)', color: 'var(--text)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 22, alignContent: 'start' }}>
    <h1 style={{ fontSize: 26 }}>{title}</h1>
    {children}
  </div>
);
const Row = ({ children }: { children: ReactNode }) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center' }}>{children}</div>;

export default { title: 'Bausteine', parameters: { options: { showPanel: false } } } satisfies Meta;

/** Fixed brand colours and fixed sizes: only the background follows light/dark. */
const fixed = { switches: ['mode'] };

export const Logo: StoryObj = {
  parameters: fixed,
  render: () => (
    <Sheet title="Logo">
      <Row>
        <NexoLogo className="w-64" followPointer />
        <NexoLogo className="w-32" animated={false} />
        <NexoLogo className="w-16" animated={false} />
        <NexoLogo className="w-9" animated={false} />
      </Row>
      <p style={{ color: 'var(--text-muted)' }}>Animiert (folgt der Maus) und statisch in Seitenleisten-, Avatar- und Favicon-Größe. Die Risse sind durchsichtig.</p>
    </Sheet>
  ),
};

export const Muenzen: StoryObj = {
  name: 'Münzen',
  parameters: fixed,
  render: () => (
    <Sheet title="Bernis-Münzen">
      {[48, 24, 16].map((size) => (
        <Row key={size}>{COIN_TIERS.map(({ tier, label }) => <span key={tier} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><CoinIcon tier={tier} size={size} />{size === 48 ? label : null}</span>)}</Row>
      ))}
    </Sheet>
  ),
};

function CardsAndNotices() {
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  const [on, setOn] = useState(true);
  return (
    <Sheet title="Karten und Hinweise">
      <Stats items={[{ label: 'Mitglieder', value: '1.342', hint: '+166 im Zeitraum' }, { label: 'Nachrichten', value: '56.888' }, { label: 'Aktiv pro Tag', value: '128' }]} />
      <Tabs value={tab} onChange={setTab} items={[{ id: 'a', label: 'Überblick' }, { id: 'b', label: 'Aktivität', count: 12 }, { id: 'c', label: 'Mitglieder' }]} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <Card title="Willkommensnachricht" description="Wird gesendet, wenn jemand dem Server beitritt." right={<Switch checked={on} onChange={setOn} label="Aktiv" />}>
          <Row><Badge on>Aktiv</Badge><Badge>Aus</Badge></Row>
        </Card>
        <Card title="Leer"><Empty title="Noch leer">Im Shop findest du deine ersten Artikel.</Empty></Card>
      </div>
      <Notice>Hinweis: Änderungen gelten erst nach dem Speichern.</Notice>
      <Notice tone="warn">Achtung: Der Kanal ist für Nexo nicht sichtbar.</Notice>
      <Notice tone="danger" onRetry={() => undefined}>Die Daten konnten nicht geladen werden.</Notice>
    </Sheet>
  );
}

export const KartenUndHinweise: StoryObj = { name: 'Karten und Hinweise', render: () => <CardsAndNotices /> };

const subject: ProfileCardSubject = {
  name: 'Lena', username: 'lena', avatarUrl: null, bio: 'Spielt Vier gewinnt und sammelt Herbst-Sticker.', level: 24, xp: 900, xpNeeded: 1370, rank: 1, serverName: 'Nexo Café', balance: 4850,
};
const plain: ResolvedCosmetics = {
  background: null, accent: null, nameStyle: null, frame: null, badges: [], title: null, xpBar: null, font: null, effect: null, levelup: null, layout: null, sticker: null, pet: null,
};

export const Profilkarte: StoryObj = {
  parameters: fixed,
  render: () => (
    <Sheet title="Profilkarte">
      <div style={{ maxWidth: 760 }}><ProfileCardPreview subject={subject} cosmetics={plain} /></div>
      <p style={{ color: 'var(--text-muted)' }}>Ohne Artikel. Hintergründe, Rahmen und Begleiter zeigt der Shop auf der Seite „Shop“.</p>
    </Sheet>
  ),
};

const days = Array.from({ length: 30 }, (_, i) => i);
const wave = (base: number, amp: number) => days.map((i) => Math.round(base + Math.sin(i / 3) * amp + i * amp / 10));

export const Diagramme: StoryObj = {
  render: () => (
    <Sheet title="Diagramme">
      <Row><div style={{ width: 220 }}><Sparkline values={wave(20, 6)} /></div><div style={{ width: 220 }}><Sparkline values={wave(40, 12)} /></div></Row>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 20 }}>
        <Chart title="Mitgliederentwicklung" kind="line" labels={days.map((i) => `${i + 1}.10.`)} longLabels={days.map((i) => `${i + 1}.10.2026`)} series={[{ name: 'Mitglieder', values: wave(1200, 30) }]} />
        <Chart title="Beitritte und Austritte" kind="bars" labels={days.map((i) => `${i + 1}.10.`)} longLabels={days.map((i) => `${i + 1}.10.2026`)} series={[{ name: 'Beitritte', values: wave(12, 5) }, { name: 'Austritte', values: wave(6, 3) }]} />
      </div>
    </Sheet>
  ),
};
