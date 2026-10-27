import { useMemo, useState } from 'react';
import {
  BADGE_GLYPHS, COSMETIC_SLOTS, PRICE_BANDS, RARITIES, RARITY_LABELS, SLOT_LABELS, emptyEquipped,
} from '../../../src/shared/cosmetics';
import type {
  BackgroundData, BackgroundScene, CosmeticItem, CosmeticSlot, EffectData, FontData, FrameData, ItemAvailability, LayoutData, LevelupData, PetData, Rarity, SlotData, StickerData, XpBarData,
} from '../../../src/shared/cosmetics';
import type { ShopEvent } from '../../../src/web/dto/profile';
import { useApi, useUser } from '../api';
import { useConfirm } from '../components/ConfirmDialog';
import { CardGlyph, LevelUpPreview, ProfileCardPreview } from '../components/ProfileCardPreview';
import {
  Badge, ColorInput, Empty, Field, Modal, Notice, NumberInput, PageHeader, Select, Spinner, Switch, SwitchRow, TableWrap, TextArea, TextInput,
} from '../components/ui';
import { Icon } from '../icons';
import { equipItem, num, resolveCosmetics, useMutation } from '../me/api';
import { ItemVisual, Bernis, RarityLabel } from '../me/visuals';

// ---------- Labels ----------

const opts = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export const AVAILABILITY_LABELS: Record<ItemAvailability, string> = { shop: 'Shop', blackmarket: 'Black Market', event: 'Event', achievement: 'Erfolg', ranking: 'Rangliste', season: 'Saisonpfad' };
const KIND_LABELS: Record<BackgroundData['kind'], string> = { solid: 'Einfarbig', gradient: 'Verlauf', pattern: 'Muster', aurora: 'Polarlicht', mesh: 'Mesh', scene: 'Szene (illustriert)' };
const SCENE_LABELS: Record<BackgroundScene, string> = { pixel: 'Pixelabenteuer', 'neon-city': 'Neonstadt', 'moon-ninja': 'Mondschein-Ninja', dungeon: 'Kerker', orbital: 'Orbitalstation', 'pirate-cove': 'Piratenbucht' };
const PATTERN_LABELS: Record<BackgroundData['pattern'], string> = { none: 'Keins', dots: 'Punkte', grid: 'Raster', waves: 'Wellen', stars: 'Sterne', hex: 'Waben', diagonal: 'Diagonal', circuit: 'Platine' };
const FRAME_LABELS: Record<FrameData['style'], string> = { solid: 'Einfach', gradient: 'Verlauf', glow: 'Glühen', double: 'Doppelt', dashed: 'Gestrichelt', neon: 'Neon', crown: 'Krone', vine: 'Ranke', fire: 'Flammen', laurel: 'Lorbeer', blossom: 'Blüten', crystal: 'Eiszacken', lightning: 'Blitze' };
const XP_LABELS: Record<XpBarData['style'], string> = { solid: 'Einfarbig', gradient: 'Verlauf', striped: 'Gestreift', segmented: 'Segmente', glow: 'Glühen', pixel: 'Pixel', wave: 'Welle', flame: 'Flammen', vine: 'Ranke', comet: 'Komet' };
const FONT_LABELS: Record<FontData['font'], string> = { inter: 'Inter', unbounded: 'Unbounded', caveat: 'Caveat (Handschrift)' };
const EFFECT_LABELS: Record<EffectData['effect'], string> = { sparkles: 'Funkeln', snow: 'Schnee', confetti: 'Konfetti', aurora: 'Polarlicht', scanlines: 'Scanlines', stardust: 'Sternenstaub', embers: 'Glut', hearts: 'Herzen', leaves: 'Fallendes Laub', bubbles: 'Seifenblasen', fireflies: 'Glühwürmchen', petals: 'Blütenblätter' };
const LEVELUP_LABELS: Record<LevelupData['style'], string> = { classic: 'Klassisch', minimal: 'Minimal', neon: 'Neon', royal: 'Königlich', retro: 'Retro' };
const LAYOUT_LABELS: Record<LayoutData['layout'], string> = { classic: 'Klassisch', compact: 'Kompakt', centered: 'Zentriert', split: 'Geteilt', banner: 'Banner', mirror: 'Gespiegelt', minimal: 'Minimal' };
const PET_LABELS: Record<PetData['species'], string> = {
  fox: 'Fuchs', owl: 'Eule', cat: 'Katze', axolotl: 'Axolotl', dragon: 'Drache', bunny: 'Hase', penguin: 'Pinguin', panda: 'Panda', frog: 'Frosch',
  butterfly: 'Schmetterling', chicken: 'Huhn', dog: 'Hund', wolf: 'Wolf', horse: 'Pferd', turtle: 'Schildkröte', koi: 'Koi', snail: 'Schnecke', hedgehog: 'Igel',
  bat: 'Fledermaus', squirrel: 'Eichhörnchen', hamster: 'Hamster', bee: 'Biene', octopus: 'Oktopus', jellyfish: 'Qualle', seahorse: 'Seepferdchen', crab: 'Krabbe',
  snake: 'Schlange', chameleon: 'Chamäleon', sloth: 'Faultier', raccoon: 'Waschbär', sparrow: 'Spatz', parrot: 'Papagei', mushroom: 'Pilz', slime: 'Schleim',
  ghost: 'Gespenst', golem: 'Golem', salamander: 'Salamander', whale: 'Wal', bear: 'Bär',
};
const CORNER_LABELS: Record<StickerData['corner'], string> = { tl: 'Oben links', tr: 'Oben rechts', bl: 'Unten links', br: 'Unten rechts', avatar: 'Auf dem Avatar' };

const SLOT_DEFAULTS: { [S in CosmeticSlot]: SlotData[S] } = {
  background: { kind: 'gradient', colors: ['#2a2160', '#0e0b24'], angle: 135, pattern: 'none' },
  accent: { color: '#a99bff' },
  nameStyle: { colors: ['#c4b5fd'], glow: false },
  frame: { style: 'solid', colors: ['#d4d4d8'], width: 4 },
  badge: { glyph: 'star', color: '#facc15' },
  title: { text: 'Neuer Titel', color: '#a5b4fc' },
  xpBar: { style: 'solid', colors: ['#a99bff'] },
  font: { font: 'unbounded' },
  effect: { effect: 'sparkles' },
  levelup: { style: 'classic', color: '#a99bff' },
  layout: { layout: 'centered' },
  sticker: { glyph: 'star', color: '#facc15', corner: 'tr' },
  pet: { species: 'fox', color: '#E8833A' },
};

/** A new item of `slot`, keeping the shared fields of `from`. */
function withSlot(slot: CosmeticSlot, from?: CosmeticItem): CosmeticItem {
  const common = from ?? { id: '', name: '', description: '', rarity: 'common' as Rarity, price: PRICE_BANDS.common[0], availability: 'shop' as ItemAvailability, eventId: null, achievementId: null, active: true };
  // Correlated union: data always matches slot here.
  return { ...common, slot, data: structuredClone(SLOT_DEFAULTS[slot]) } as CosmeticItem;
}

// ---------- Data editors ----------

function ColorList({ value, onChange, max = 4 }: { value: string[]; onChange: (value: string[]) => void; max?: number }) {
  return (
    <div className="stack gap-2">
      {value.map((color, i) => (
        <div key={i} className="flex items-center gap-2">
          <ColorInput value={color} onChange={(next) => onChange(value.map((c, j) => (j === i ? next : c)))} />
          {value.length > 1 && <button type="button" className="icon-btn" aria-label="Farbe entfernen" onClick={() => onChange(value.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button>}
        </div>
      ))}
      {value.length < max && <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => onChange([...value, value[value.length - 1] ?? '#a99bff'])}><Icon name="plus" size={14} /> Farbe</button>}
    </div>
  );
}

function GlyphPicker({ value, onChange }: { value: StickerData['glyph']; onChange: (glyph: StickerData['glyph']) => void }) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
      {BADGE_GLYPHS.map((glyph) => (
        <button key={glyph} type="button" title={glyph} aria-pressed={glyph === value} onClick={() => onChange(glyph)}
          className={`flex aspect-square cursor-pointer items-center justify-center rounded-lg border bg-transparent ${glyph === value ? 'border-accent text-ink ring-2 ring-accent/30' : 'border-line text-mute hover:border-control hover:text-ink'}`}>
          <CardGlyph glyph={glyph} size={20} />
        </button>
      ))}
    </div>
  );
}

function DataEditor({ item, onChange }: { item: CosmeticItem; onChange: (item: CosmeticItem) => void }) {
  switch (item.slot) {
    case 'background': {
      const set = (patch: Partial<BackgroundData>) => onChange({ ...item, data: { ...item.data, ...patch } });
      return (
        <div className="grid-2">
          <Field label="Art"><Select value={item.data.kind} onChange={(kind) => set({ kind, ...(kind === 'scene' ? { scene: item.data.scene ?? 'pixel' } : {}) })} options={opts(KIND_LABELS)} /></Field>
          {item.data.kind === 'scene' && (
            <Field label="Motiv" hint="Farben: Himmel, Landschaft, Licht, Details."><Select value={item.data.scene ?? 'pixel'} onChange={(scene) => set({ scene })} options={opts(SCENE_LABELS)} /></Field>
          )}
          <Field label="Muster" hint="Nur bei „Muster“."><Select value={item.data.pattern} onChange={(pattern) => set({ pattern })} options={opts(PATTERN_LABELS)} /></Field>
          <Field label="Winkel (Grad)"><NumberInput value={item.data.angle} onChange={(angle) => set({ angle })} min={0} max={360} /></Field>
          <Field label="Farben"><ColorList value={item.data.colors} onChange={(colors) => set({ colors })} /></Field>
        </div>
      );
    }
    case 'accent':
      return <Field label="Farbe"><ColorInput value={item.data.color} onChange={(color) => onChange({ ...item, data: { color } })} /></Field>;
    case 'nameStyle':
      return (
        <div className="stack">
          <Field label="Farben" hint="Ab zwei Farben ein Verlauf."><ColorList value={item.data.colors} onChange={(colors) => onChange({ ...item, data: { ...item.data, colors } })} max={3} /></Field>
          <SwitchRow title="Glühen" checked={item.data.glow} onChange={(glow) => onChange({ ...item, data: { ...item.data, glow } })} />
        </div>
      );
    case 'frame': {
      const set = (patch: Partial<FrameData>) => onChange({ ...item, data: { ...item.data, ...patch } });
      return (
        <div className="grid-2">
          <Field label="Stil"><Select value={item.data.style} onChange={(style) => set({ style })} options={opts(FRAME_LABELS)} /></Field>
          <Field label="Breite (px)"><NumberInput value={item.data.width} onChange={(width) => set({ width })} min={1} max={12} /></Field>
          <Field label="Farben"><ColorList value={item.data.colors} onChange={(colors) => set({ colors })} max={2} /></Field>
        </div>
      );
    }
    case 'badge':
      return (
        <div className="stack">
          <Field label="Symbol"><GlyphPicker value={item.data.glyph} onChange={(glyph) => onChange({ ...item, data: { ...item.data, glyph } })} /></Field>
          <Field label="Farbe"><ColorInput value={item.data.color} onChange={(color) => onChange({ ...item, data: { ...item.data, color } })} /></Field>
        </div>
      );
    case 'sticker': {
      const set = (patch: Partial<StickerData>) => onChange({ ...item, data: { ...item.data, ...patch } });
      return (
        <div className="stack">
          <Field label="Symbol"><GlyphPicker value={item.data.glyph} onChange={(glyph) => set({ glyph })} /></Field>
          <div className="grid-2">
            <Field label="Farbe"><ColorInput value={item.data.color} onChange={(color) => set({ color })} /></Field>
            <Field label="Ecke"><Select value={item.data.corner} onChange={(corner) => set({ corner })} options={opts(CORNER_LABELS)} /></Field>
          </div>
        </div>
      );
    }
    case 'pet':
      return (
        <div className="grid-2">
          <Field label="Tier"><Select value={item.data.species} onChange={(species) => onChange({ ...item, data: { ...item.data, species } })} options={opts(PET_LABELS)} /></Field>
          <Field label="Fellfarbe"><ColorInput value={item.data.color} onChange={(color) => onChange({ ...item, data: { ...item.data, color } })} /></Field>
        </div>
      );
    case 'title':
      return (
        <div className="grid-2">
          <Field label="Text"><TextInput value={item.data.text} onChange={(text) => onChange({ ...item, data: { ...item.data, text } })} maxLength={24} /></Field>
          <Field label="Farbe"><ColorInput value={item.data.color} onChange={(color) => onChange({ ...item, data: { ...item.data, color } })} /></Field>
        </div>
      );
    case 'xpBar':
      return (
        <div className="grid-2">
          <Field label="Stil"><Select value={item.data.style} onChange={(style) => onChange({ ...item, data: { ...item.data, style } })} options={opts(XP_LABELS)} /></Field>
          <Field label="Farben"><ColorList value={item.data.colors} onChange={(colors) => onChange({ ...item, data: { ...item.data, colors } })} max={3} /></Field>
        </div>
      );
    case 'font':
      return <Field label="Schrift"><Select value={item.data.font} onChange={(font) => onChange({ ...item, data: { font } })} options={opts(FONT_LABELS)} /></Field>;
    case 'effect':
      return <Field label="Effekt"><Select value={item.data.effect} onChange={(effect) => onChange({ ...item, data: { effect } })} options={opts(EFFECT_LABELS)} /></Field>;
    case 'levelup':
      return (
        <div className="grid-2">
          <Field label="Stil"><Select value={item.data.style} onChange={(style) => onChange({ ...item, data: { ...item.data, style } })} options={opts(LEVELUP_LABELS)} /></Field>
          <Field label="Farbe"><ColorInput value={item.data.color} onChange={(color) => onChange({ ...item, data: { ...item.data, color } })} /></Field>
        </div>
      );
    case 'layout':
      return <Field label="Layout"><Select value={item.data.layout} onChange={(layout) => onChange({ ...item, data: { layout } })} options={opts(LAYOUT_LABELS)} /></Field>;
  }
}

// ---------- Editor modal ----------

function ItemPreview({ item }: { item: CosmeticItem }) {
  const user = useUser();
  const draft = { ...item, id: item.id || 'preview' };
  const cosmetics = resolveCosmetics(equipItem(emptyEquipped(), draft), new Map([[draft.id, draft]]));
  const subject = {
    name: user?.globalName ?? user?.username ?? 'Nexo', username: user?.username ?? 'nexo', avatarUrl: user?.avatarUrl ?? null, bio: 'So sieht der Artikel auf einer Karte aus.',
    level: 12, xp: 640, xpNeeded: 1300, rank: 3, serverName: 'Vorschau', balance: 0,
  };
  return (
    <div className="flex items-center gap-3">
      <ItemVisual item={draft} className="w-24 shrink-0" />
      <div className="min-w-0 flex-1">
        {item.slot === 'levelup'
          ? <LevelUpPreview subject={subject} cosmetics={cosmetics} level={13} reward={98} />
          : <ProfileCardPreview subject={subject} cosmetics={cosmetics} className="w-full" />}
      </div>
    </div>
  );
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/;

function ItemEditor({ initial, isNew, events, onClose, onSaved }: { initial: CosmeticItem; isNew: boolean; events: ShopEvent[]; onClose: () => void; onSaved: () => void }) {
  const [item, setItem] = useState(initial);
  const { run, busy } = useMutation();
  const band = PRICE_BANDS[item.rarity];
  const idError = isNew && item.id && !ID_PATTERN.test(item.id) ? 'Nur Kleinbuchstaben, Ziffern und Bindestriche.' : null;
  const valid = ID_PATTERN.test(item.id) && item.name.trim() !== '' && Number.isInteger(item.price) && item.price >= 0
    && (item.availability !== 'event' || item.eventId !== null);
  const set = (patch: Partial<Pick<CosmeticItem, 'id' | 'name' | 'description' | 'rarity' | 'price' | 'availability' | 'eventId' | 'achievementId' | 'active'>>) => setItem((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    const saved = await run<CosmeticItem>(isNew ? '/owner/items' : `/owner/items/${item.id}`, isNew ? 'POST' : 'PUT', item, isNew ? 'Artikel angelegt.' : 'Artikel gespeichert.');
    if (saved) onSaved();
  };

  return (
    <Modal title={isNew ? 'Neuer Artikel' : `„${initial.name}“ bearbeiten`} onClose={onClose} footer={(
      <>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Abbrechen</button>
        <button type="button" className="btn btn-primary" disabled={!valid || busy} onClick={save}>{isNew ? 'Anlegen' : 'Speichern'}</button>
      </>
    )}>
      <ItemPreview item={item} />
      <div className="-mx-6 max-h-[52vh] overflow-y-auto border-t border-line px-6 pt-4">
        <div className="stack">
          <div className="grid-2">
            <Field label="Bereich">
              {isNew
                ? <Select value={item.slot} onChange={(slot) => setItem((prev) => withSlot(slot, prev))} options={COSMETIC_SLOTS.map((s) => ({ value: s, label: SLOT_LABELS[s] }))} />
                : <input className="input" value={SLOT_LABELS[item.slot]} disabled />}
            </Field>
            <Field label="ID" error={idError} hint={isNew ? 'Eindeutig, kann später nicht geändert werden.' : undefined}>
              {isNew ? <TextInput value={item.id} onChange={(id) => set({ id: id.toLowerCase() })} placeholder="bg-polarlicht" maxLength={41} /> : <input className="input" value={item.id} disabled />}
            </Field>
          </div>
          <Field label="Name"><TextInput value={item.name} onChange={(name) => set({ name })} maxLength={40} /></Field>
          <Field label="Beschreibung"><TextArea value={item.description} onChange={(description) => set({ description })} maxLength={140} rows={2} /></Field>
          <div className="grid-2">
            <Field label="Seltenheit"><Select value={item.rarity} onChange={(rarity) => set({ rarity })} options={RARITIES.map((r) => ({ value: r, label: RARITY_LABELS[r] }))} /></Field>
            <Field label="Preis (in Bronze)" hint={<>Entspricht <Bernis amount={item.price} nowrap />. Üblich für diese Seltenheit: <Bernis amount={band[0]} nowrap /> bis <Bernis amount={band[1]} nowrap />.</>}><NumberInput value={item.price} onChange={(price) => set({ price })} min={0} step={50} /></Field>
            <Field label="Erhältlich über">
              <Select value={item.availability} onChange={(availability) => set({ availability, eventId: availability === 'event' ? item.eventId ?? events[0]?.id ?? null : null })} options={opts(AVAILABILITY_LABELS)} />
            </Field>
            {item.availability === 'event' && (
              <Field label="Event"><Select value={item.eventId ?? ''} onChange={(eventId) => set({ eventId: eventId || null })} options={[{ value: '', label: '— Event wählen —' }, ...events.map((e) => ({ value: e.id, label: e.name }))]} /></Field>
            )}
            {item.availability === 'achievement' && (
              <Field label="Erfolg-ID"><TextInput value={item.achievementId ?? ''} onChange={(id) => set({ achievementId: id || null })} placeholder="first-win" /></Field>
            )}
          </div>
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-3 text-[12.5px] font-medium text-mute">Aussehen</p>
            <DataEditor item={item} onChange={setItem} />
          </div>
          <SwitchRow title="Aktiv" description="Inaktive Artikel verschwinden aus Shop und Black Market; wer sie besitzt, behält sie." checked={item.active} onChange={(active) => set({ active })} />
        </div>
      </div>
    </Modal>
  );
}

// ---------- Page ----------

export default function ItemsPage() {
  const { data, error, loading, reload } = useApi<CosmeticItem[]>('/owner/items');
  const events = useApi<ShopEvent[]>('/owner/events').data ?? [];
  const { run } = useMutation();
  const { confirm, dialog } = useConfirm();
  const [slot, setSlot] = useState<CosmeticSlot | ''>('');
  const [rarity, setRarity] = useState<Rarity | ''>('');
  const [availability, setAvailability] = useState<ItemAvailability | ''>('');
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [editing, setEditing] = useState<{ item: CosmeticItem; isNew: boolean } | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((item) => (!slot || item.slot === slot) && (!rarity || item.rarity === rarity) && (!availability || item.availability === availability)
      && (showInactive || item.active) && (!q || `${item.id} ${item.name}`.toLowerCase().includes(q)));
  }, [data, slot, rarity, availability, query, showInactive]);

  const deactivate = (item: CosmeticItem) => confirm({
    title: 'Artikel deaktivieren',
    text: `„${item.name}“ verschwindet aus Shop und Black Market. Wer ihn besitzt, behält ihn.`,
    confirmLabel: 'Deaktivieren',
    onConfirm: async () => { if (await run(`/owner/items/${item.id}`, 'DELETE', undefined, 'Artikel deaktiviert.')) reload(); },
  });
  const activate = async (item: CosmeticItem) => { if (await run(`/owner/items/${item.id}`, 'PUT', { ...item, active: true }, 'Artikel aktiviert.')) reload(); };

  return (
    <>
      <PageHeader kicker="Owner" title="Artikel" description="Der Katalog für Shop, Black Market, Events und Belohnungen."
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing({ item: withSlot('background'), isNew: true })}><Icon name="plus" size={16} /> Neuer Artikel</button>} />
      <div className="mb-4 grid grid-cols-2 items-center gap-3 md:grid-cols-[1fr_150px_150px_150px_auto]">
        <div className="col-span-2 md:col-span-1"><TextInput value={query} onChange={setQuery} placeholder="Name oder ID suchen …" /></div>
        <Select value={slot} onChange={setSlot} options={[{ value: '', label: 'Alle Bereiche' }, ...COSMETIC_SLOTS.map((s) => ({ value: s, label: SLOT_LABELS[s] }))]} />
        <Select value={rarity} onChange={setRarity} options={[{ value: '', label: 'Alle Seltenheiten' }, ...RARITIES.map((r) => ({ value: r, label: RARITY_LABELS[r] }))]} />
        <Select value={availability} onChange={setAvailability} options={[{ value: '', label: 'Überall' }, ...opts(AVAILABILITY_LABELS)]} />
        <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px]"><Switch checked={showInactive} onChange={setShowInactive} label="Inaktive zeigen" /> Inaktive</label>
      </div>
      {loading && !data && <Spinner />}
      {error && <Notice tone="danger" onRetry={reload}>{error}</Notice>}
      {data && rows.length === 0 && <Empty title="Keine Artikel">Passe die Filter an oder lege einen neuen Artikel an.</Empty>}
      {rows.length > 0 && (
        // Phones: one stacked card per item with every column visible; the table needs too much width there.
        <ul className="m-0 grid list-none gap-2.5 p-0 sm:hidden">
          {rows.map((item) => (
            <li key={item.id} className={`rounded-xl border border-line bg-tint p-3 ${item.active ? '' : 'opacity-55'}`}>
              <button type="button" className="flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left font-[inherit] text-body" onClick={() => setEditing({ item, isNew: false })}>
                <ItemVisual item={item} className="w-16 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium text-ink">{item.name}</span>
                  <span className="block break-all font-mono text-[11.5px] text-faint">{item.id}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
                    <span>{SLOT_LABELS[item.slot]}</span><span className="text-faint">·</span><RarityLabel rarity={item.rarity} />
                  </span>
                </span>
              </button>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className="flex flex-wrap items-center gap-2">
                  {item.price ? <Bernis amount={item.price} nowrap /> : <span className="text-faint">–</span>}
                  <span className="text-faint">{AVAILABILITY_LABELS[item.availability]}{item.eventId ? ` · ${events.find((e) => e.id === item.eventId)?.name ?? item.eventId}` : ''}</span>
                </span>
                {item.active ? <Badge tone="pos">Aktiv</Badge> : <Badge tone="off">Inaktiv</Badge>}
              </div>
              <div className="mt-2 flex gap-1">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ item, isNew: false })}>Bearbeiten</button>
                {item.active
                  ? <button type="button" className="btn btn-danger btn-sm" onClick={() => deactivate(item)}>Deaktivieren</button>
                  : <button type="button" className="btn btn-ghost btn-sm" onClick={() => activate(item)}>Aktivieren</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <TableWrap className="max-sm:hidden">
          <thead><tr><th>Artikel</th><th>Bereich</th><th>Seltenheit</th><th className="text-right">Preis</th><th>Erhältlich</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className={item.active ? '' : 'opacity-55'}>
                <td>
                  <button type="button" className="flex cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left font-[inherit] text-body" onClick={() => setEditing({ item, isNew: false })}>
                    <ItemVisual item={item} className="w-14 shrink-0 rounded-lg" />
                    <span className="min-w-0">
                      <span className="block break-words font-medium text-ink">{item.name}</span>
                      <span className="block break-all font-mono text-[11.5px] text-faint">{item.id}</span>
                    </span>
                  </button>
                </td>
                <td className="whitespace-nowrap">{SLOT_LABELS[item.slot]}</td>
                <td><RarityLabel rarity={item.rarity} /></td>
                <td className="text-right">{item.price ? <Bernis amount={item.price} nowrap /> : <span className="text-faint">–</span>}</td>
                <td className="whitespace-nowrap">{AVAILABILITY_LABELS[item.availability]}{item.eventId && <div className="faint">{events.find((e) => e.id === item.eventId)?.name ?? item.eventId}</div>}</td>
                <td>{item.active ? <Badge tone="pos">Aktiv</Badge> : <Badge tone="off">Inaktiv</Badge>}</td>
                <td className="whitespace-nowrap text-right">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ item, isNew: false })}>Bearbeiten</button>
                  {item.active
                    ? <button type="button" className="btn btn-danger btn-sm" onClick={() => deactivate(item)}>Deaktivieren</button>
                    : <button type="button" className="btn btn-ghost btn-sm" onClick={() => activate(item)}>Aktivieren</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      {editing && <ItemEditor key={editing.item.id || 'new'} initial={editing.item} isNew={editing.isNew} events={events} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {dialog}
    </>
  );
}
