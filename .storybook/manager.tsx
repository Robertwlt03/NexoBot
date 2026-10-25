// Our own toolbar instead of Storybook's default dropdown buttons: a labelled colour-scheme picker with swatches and
// two segmented switches (Modus, Gerät) that show both options, so it is clear what is a choice and what a switch.
// The manager bundle compiles JSX to React.createElement, so React has to be in scope.
import React, { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { addons, types, useGlobals } from 'storybook/manager-api';
import { THEME_PRESETS } from '../src/shared/theme';

const ui = {
  caption: { fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.6, whiteSpace: 'nowrap' } as CSSProperties,
  group: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', height: 40 } as CSSProperties,
  pill: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid rgba(128,128,128,.35)', background: 'rgba(128,128,128,.08)', color: 'inherit', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as CSSProperties,
};

const Swatch = ({ colors, size = 12 }: { colors: string[]; size?: number }) => (
  <span style={{ display: 'inline-flex' }}>
    {colors.map((color, i) => <span key={color + i} style={{ width: size, height: size, borderRadius: '50%', background: color, border: '1.5px solid rgba(0,0,0,.25)', marginLeft: i ? -4 : 0 }} />)}
  </span>
);

/** A choice from a list: shows the current scheme with its colours and opens the list on click. */
function SchemePicker() {
  const [globals, updateGlobals] = useGlobals();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = THEME_PRESETS.find((p) => p.id === globals.scheme) ?? THEME_PRESETS[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [open]);

  return (
    <div ref={ref} style={{ ...ui.group, position: 'relative' }}>
      <span style={ui.caption}>Farbvorlage</span>
      <button type="button" style={ui.pill} aria-haspopup="listbox" aria-expanded={open} title="Farbvorlage wählen: gilt für alle Seiten" onClick={() => setOpen(!open)}>
        <Swatch colors={[current.primary, current.secondary]} />
        {current.name}
        <span aria-hidden style={{ opacity: 0.6, fontSize: 10 }}>▼</span>
      </button>
      {open && (
        <div role="listbox" aria-label="Farbvorlage" style={{ position: 'absolute', top: 40, left: 10, zIndex: 100, minWidth: 230, padding: 6, borderRadius: 12, background: 'var(--sb-popover, #fff)', color: '#222', boxShadow: '0 12px 32px rgba(0,0,0,.25)', border: '1px solid rgba(0,0,0,.1)' }}>
          {THEME_PRESETS.map((preset) => {
            const active = preset.id === current.id;
            return (
              <button key={preset.id} type="button" role="option" aria-selected={active}
                onClick={() => { updateGlobals({ scheme: preset.id }); setOpen(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '7px 10px', border: 0, borderRadius: 8, background: active ? 'rgba(30,167,253,.12)' : 'transparent', color: 'inherit', font: 'inherit', fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left' }}>
                <Swatch colors={[preset.primary, preset.secondary]} size={14} />
                <span style={{ flex: 1 }}>{preset.name}</span>
                {active && <span aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A switch between two states: both options are visible, the active one is highlighted. */
function Segmented({ caption, name, options, hint }: {
  caption: string; name: string; hint: string; options: { value: string; label: string; icon: ReactNode }[];
}) {
  const [globals, updateGlobals] = useGlobals();
  const value = globals[name] ?? options[0].value;
  return (
    <div style={ui.group}>
      <span style={ui.caption}>{caption}</span>
      <div role="radiogroup" aria-label={caption} title={hint} style={{ display: 'inline-flex', height: 30, padding: 2, borderRadius: 9, background: 'rgba(128,128,128,.14)', border: '1px solid rgba(128,128,128,.3)' }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button key={option.value} type="button" role="radio" aria-checked={active} onClick={() => updateGlobals({ [name]: option.value })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 11px', border: 0, borderRadius: 7, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: active ? '#1ea7fd' : 'transparent', color: active ? '#fff' : 'inherit', boxShadow: active ? '0 1px 3px rgba(0,0,0,.25)' : 'none' }}>
              <span aria-hidden>{option.icon}</span>{option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

addons.register('nexo/toolbar', () => {
  addons.add('nexo/scheme', { type: types.TOOL, title: 'Farbvorlage', render: () => <SchemePicker /> });
  addons.add('nexo/mode', {
    type: types.TOOL, title: 'Modus',
    render: () => <Segmented caption="Modus" name="mode" hint="Hell oder dunkel: gilt für alle Seiten"
      options={[{ value: 'dark', label: 'Dunkel', icon: '☾' }, { value: 'light', label: 'Hell', icon: '☀' }]} />,
  });
  addons.add('nexo/device', {
    type: types.TOOL, title: 'Gerät',
    render: () => <Segmented caption="Gerät" name="device" hint="Desktop (1280 px) oder Handy (390 px): gilt für alle Seiten"
      options={[{ value: 'desktop', label: 'Desktop', icon: '🖥' }, { value: 'phone', label: 'Handy', icon: '📱' }]} />,
  });
});
