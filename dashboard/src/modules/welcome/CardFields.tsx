// Property panels of the card editor: the selected layer and the background.

import type { ReactNode } from 'react';
import {
  CARD_FONT_KEYS, CARD_FONTS, CARD_MAX_TEXT, CARD_PLACEHOLDERS,
  type CardBackground, type CardLayer, type CardFontWeight, type TextLayer, type AvatarLayer,
} from '../../../../src/shared/welcomeCard';
import { ColorInput, Field, NumberInput, Select, SwitchRow, TextArea, TextInput } from '../../components/ui';

/** Number field that ignores an empty input instead of storing NaN. */
function Num({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <NumberInput value={value} min={min} max={max} onChange={(next) => { if (Number.isFinite(next)) onChange(next); }} />
    </Field>
  );
}

const Grid = ({ children }: { children: ReactNode }) => <div className="grid-2">{children}</div>;

export function LayerFields({ layer, onChange }: { layer: CardLayer; onChange: (layer: CardLayer) => void }) {
  // The patch always matches the layer's own type.
  const set = (patch: Partial<CardLayer>) => onChange({ ...layer, ...patch } as CardLayer);
  const opacity = 'opacity' in layer
    ? <Num label="Deckkraft (%)" value={layer.opacity} min={0} max={100} onChange={(value) => set({ opacity: value })} />
    : null;
  const color = 'color' in layer
    ? <Field label="Farbe"><ColorInput value={layer.color} onChange={(value) => set({ color: value })} /></Field>
    : null;
  const position = 'x' in layer && (
    <Grid>
      <Num label="X" value={layer.x} min={-1024} max={2048} onChange={(x) => set({ x })} />
      <Num label="Y" value={layer.y} min={-450} max={900} onChange={(y) => set({ y })} />
    </Grid>
  );

  switch (layer.type) {
    case 'text': {
      const setText = (patch: Partial<TextLayer>) => onChange({ ...layer, ...patch });
      return (
        <div className="stack">
          <Field label="Text" hint="Mehrere Zeilen sind möglich.">
            <TextArea rows={2} value={layer.text} maxLength={CARD_MAX_TEXT} variables={CARD_PLACEHOLDERS} onChange={(text) => setText({ text })} />
          </Field>
          <Grid>
            <Field label="Schrift">
              <Select value={layer.font} options={CARD_FONT_KEYS.map((key) => ({ value: key, label: CARD_FONTS[key].label }))} onChange={(font) => setText({ font })} />
            </Field>
            <Field label="Stärke">
              <Select value={String(layer.weight) as '400' | '700'} options={[{ value: '400', label: 'Normal' }, { value: '700', label: 'Fett' }]}
                onChange={(weight) => setText({ weight: Number(weight) as CardFontWeight })} />
            </Field>
            <Num label="Größe (px)" value={layer.size} min={8} max={200} onChange={(size) => setText({ size })} />
            <Field label="Ausrichtung">
              <Select value={layer.align} options={[{ value: 'left', label: 'Links' }, { value: 'center', label: 'Mitte' }, { value: 'right', label: 'Rechts' }]}
                onChange={(align) => setText({ align })} />
            </Field>
          </Grid>
          {color}
          <Num label="Max. Breite (px, 0 = frei)" value={layer.maxWidth} min={0} max={2048} onChange={(maxWidth) => setText({ maxWidth })} />
          {position}
          <SwitchRow title="Schatten" description="Macht Text auf hellen Bildern lesbarer." checked={layer.shadow} onChange={(shadow) => setText({ shadow })} />
        </div>
      );
    }
    case 'avatar': {
      const setAvatar = (patch: Partial<AvatarLayer>) => onChange({ ...layer, ...patch });
      return (
        <div className="stack">
          <Grid>
            <Field label="Form">
              <Select value={layer.shape} options={[{ value: 'circle', label: 'Kreis' }, { value: 'rounded', label: 'Abgerundet' }, { value: 'square', label: 'Quadrat' }]}
                onChange={(shape) => setAvatar({ shape })} />
            </Field>
            <Num label="Größe (px)" value={layer.size} min={16} max={1024} onChange={(size) => setAvatar({ size })} />
            <Num label="Rahmen (px)" value={layer.borderWidth} min={0} max={40} onChange={(borderWidth) => setAvatar({ borderWidth })} />
            <Field label="Rahmenfarbe"><ColorInput value={layer.borderColor} onChange={(borderColor) => setAvatar({ borderColor })} /></Field>
          </Grid>
          {position}
        </div>
      );
    }
    case 'rect':
      return (
        <div className="stack">
          <Grid>
            <Num label="Breite" value={layer.w} min={1} max={2048} onChange={(w) => set({ w })} />
            <Num label="Höhe" value={layer.h} min={1} max={2048} onChange={(h) => set({ h })} />
            <Num label="Ecken (px)" value={layer.radius} min={0} max={1024} onChange={(radius) => set({ radius })} />
            {opacity}
          </Grid>
          {color}
          {position}
        </div>
      );
    case 'circle':
      return (
        <div className="stack">
          <Grid>
            <Num label="Radius" value={layer.r} min={1} max={1024} onChange={(r) => set({ r })} />
            {opacity}
          </Grid>
          {color}
          {position}
        </div>
      );
    case 'line':
      return (
        <div className="stack">
          <Grid>
            <Num label="Start X" value={layer.x1} min={-1024} max={2048} onChange={(x1) => set({ x1 })} />
            <Num label="Start Y" value={layer.y1} min={-450} max={900} onChange={(y1) => set({ y1 })} />
            <Num label="Ende X" value={layer.x2} min={-1024} max={2048} onChange={(x2) => set({ x2 })} />
            <Num label="Ende Y" value={layer.y2} min={-450} max={900} onChange={(y2) => set({ y2 })} />
            <Num label="Stärke (px)" value={layer.width} min={1} max={100} onChange={(width) => set({ width })} />
            {opacity}
          </Grid>
          {color}
        </div>
      );
    case 'image':
      return (
        <div className="stack">
          <Field label="Bild-URL" hint="PNG, JPG, GIF oder WebP über https://, höchstens 5 MB.">
            <TextInput value={layer.url} maxLength={2000} placeholder="https://…" onChange={(url) => set({ url })} />
          </Field>
          <Grid>
            <Num label="Breite" value={layer.w} min={1} max={2048} onChange={(w) => set({ w })} />
            <Num label="Höhe" value={layer.h} min={1} max={2048} onChange={(h) => set({ h })} />
            <Num label="Ecken (px)" value={layer.radius} min={0} max={1024} onChange={(radius) => set({ radius })} />
            {opacity}
          </Grid>
          {position}
        </div>
      );
  }
}

export function BackgroundFields({ value, onChange }: { value: CardBackground; onChange: (value: CardBackground) => void }) {
  const set = (patch: Partial<CardBackground>) => onChange({ ...value, ...patch });
  return (
    <div className="stack">
      <Field label="Art">
        <Select value={value.type} options={[{ value: 'color', label: 'Farbe' }, { value: 'gradient', label: 'Verlauf' }, { value: 'image', label: 'Bild' }]}
          onChange={(type) => set({ type })} />
      </Field>
      <Grid>
        <Field label={value.type === 'gradient' ? 'Farbe 1' : 'Farbe'}><ColorInput value={value.color} onChange={(color) => set({ color })} /></Field>
        {value.type === 'gradient' && <Field label="Farbe 2"><ColorInput value={value.color2} onChange={(color2) => set({ color2 })} /></Field>}
      </Grid>
      {value.type === 'gradient' && <Num label="Winkel (°)" value={value.angle} min={0} max={360} onChange={(angle) => set({ angle })} />}
      {value.type === 'image' && (
        <>
          <Field label="Bild-URL" hint="Wird auf 1024 × 450 zugeschnitten. PNG, JPG, GIF oder WebP, höchstens 5 MB.">
            <TextInput value={value.imageUrl ?? ''} maxLength={2000} placeholder="https://…" onChange={(imageUrl) => set({ imageUrl: imageUrl || null })} />
          </Field>
          <Num label="Abdunkeln (%)" value={value.dim} min={0} max={80} onChange={(dim) => set({ dim })} />
        </>
      )}
    </div>
  );
}
