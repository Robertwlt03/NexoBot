// Storybook's frame in Nexo's look (walnut, moss, Inter and Unbounded) and our own toolbar instead of the default
// dropdown buttons: a colour-scheme picker with swatches and two switches (Modus, Gerät) that show both options.
// A story lists in `parameters.switches` the switches that change something on it; the others are hidden there.
// On a phone the toolbar shrinks to icons and Storybook's own tools are hidden, so everything fits the screen.
// The manager bundle compiles JSX to React.createElement, so React has to be in scope.
import React, { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { BrowserIcon, MobileIcon, MoonIcon, SunIcon } from '@storybook/icons';
import { addons, types, useGlobals, useParameter } from 'storybook/manager-api';
import { create } from 'storybook/theming/create';
import { THEME_PRESETS } from '../src/shared/theme';

const brand = {
  walnut: '#16110c', deep: '#100b07', card: '#231a13', line: 'rgba(243, 235, 224, .09)',
  cream: '#f3ebe0', muted: '#ae9e87', moss: '#8fb36b', amber: '#e8a33d',
};
const fonts = { base: '"Inter Variable", Inter, system-ui, sans-serif', display: '"Unbounded Variable", Unbounded, "Inter Variable", sans-serif' };

addons.setConfig({
  showPanel: false,
  theme: create({
    base: 'dark',
    brandTitle: `<span style="display:inline-flex;align-items:center;gap:10px;font-family:${fonts.display.replaceAll('"', "'")};font-weight:700;font-size:17px;color:${brand.cream}"><img src="/dashboard/nexo.svg" width="30" height="30" alt="">Nexo</span>`,
    brandTarget: '_self',
    colorPrimary: brand.amber,
    colorSecondary: brand.moss,
    appBg: brand.walnut,
    appContentBg: brand.deep,
    appPreviewBg: brand.deep,
    appBorderColor: brand.line,
    appBorderRadius: 12,
    fontBase: fonts.base,
    textColor: brand.cream,
    textMutedColor: brand.muted,
    textInverseColor: brand.walnut,
    barBg: brand.walnut,
    barTextColor: brand.muted,
    barHoverColor: brand.moss,
    barSelectedColor: brand.moss,
    inputBg: brand.card,
    inputBorder: brand.line,
    inputTextColor: brand.cream,
    inputBorderRadius: 10,
  }),
});

const NARROW = '(max-width: 640px)';
const narrowQuery = window.matchMedia(NARROW);
const useNarrow = () => useSyncExternalStore((onChange) => {
  narrowQuery.addEventListener('change', onChange);
  return () => narrowQuery.removeEventListener('change', onChange);
}, () => narrowQuery.matches);

// Fewer buttons: the addon panel is empty (every setting sits in the toolbar or on the page), and the editor link,
// tag filter, "new story", "modified stories" and the context menus only help while coding. Zoom and isolation mode
// do not fit next to our switches on a phone.
const hide = (selectors: string[]) => `${selectors.join(', ')} { display: none !important; }`;
const label = (text: string) => `[aria-label="${text}"]`;
const frameStyle = document.createElement('style');
frameStyle.textContent = hide([
  label('Show addon panel'), label('Open in editor'), '[aria-label$="tag filter"]', '[aria-label$="tag filters"]',
  label('Create a new story'), label('Show modified stories since last commit'), label('Open context menu'),
]) + ` @media ${NARROW} { ${hide([label('Open in isolation mode'), label('Change zoom level')])} }`;
document.head.append(frameStyle);

/** True when the open story lists this switch in `parameters.switches` (all three by default, see preview.tsx). */
const useSwitch = (name: string) => useParameter<string[]>('switches', ['scheme', 'mode', 'device']).includes(name);

const ui = {
  group: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', height: 40, flex: 'none' } as CSSProperties,
  caption: { fontSize: 12, fontWeight: 500, color: brand.muted, whiteSpace: 'nowrap' } as CSSProperties,
  pill: { display: 'inline-flex', alignItems: 'center', gap: 8, height: 30, padding: '0 12px 0 8px', borderRadius: 999, border: `1px solid ${brand.line}`, background: brand.card, color: brand.cream, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as CSSProperties,
};

const Swatch = ({ colors, size = 14 }: { colors: string[]; size?: number }) => (
  <span style={{ display: 'inline-flex' }}>
    {colors.map((color, i) => <span key={color + i} style={{ width: size, height: size, borderRadius: '50%', background: color, boxShadow: `0 0 0 2px ${brand.card}`, marginLeft: i ? -5 : 0 }} />)}
  </span>
);

/**
 * A choice from a list: shows the current scheme with its colours and opens the list on click. The list is rendered
 * into the page body, because the toolbar clips everything that sticks out of it.
 */
function SchemePicker() {
  const [globals, updateGlobals] = useGlobals();
  const narrow = useNarrow();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const current = THEME_PRESETS.find((p) => p.id === globals.scheme) ?? THEME_PRESETS[0];
  const open = anchor !== null;

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      const target = event.target as Node;
      if (!list.current?.contains(target) && !button.current?.contains(target)) setAnchor(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setAnchor(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); window.removeEventListener('resize', close); };
  }, [open]);

  if (!useSwitch('scheme')) return null;
  const left = anchor ? Math.max(8, Math.min(anchor.left, window.innerWidth - 238)) : 0;
  const top = anchor ? anchor.bottom + 6 : 0;
  return (
    <div style={ui.group}>
      {!narrow && <span style={ui.caption}>Farbvorlage</span>}
      <button ref={button} type="button" style={narrow ? { ...ui.pill, padding: '0 10px' } : ui.pill} aria-haspopup="listbox" aria-expanded={open} aria-label={`Farbvorlage: ${current.name}`}
        title="Farbvorlage wählen" onClick={() => setAnchor(open ? null : button.current!.getBoundingClientRect())}>
        <Swatch colors={[current.primary, current.secondary]} />
        {!narrow && current.name}
        <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.6, transform: open ? 'rotate(180deg)' : undefined }}><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && createPortal(
        <div ref={list} role="listbox" aria-label="Farbvorlage" style={{ position: 'fixed', top, left, zIndex: 1000, width: 230, maxHeight: `calc(100vh - ${top + 12}px)`, overflowY: 'auto', padding: 6, borderRadius: 14,
          background: brand.card, color: brand.cream, border: `1px solid ${brand.line}`, boxShadow: '0 18px 40px -12px rgba(0,0,0,.6)', fontFamily: fonts.base }}>
          {THEME_PRESETS.map((preset) => {
            const active = preset.id === current.id;
            return (
              <button key={preset.id} type="button" role="option" aria-selected={active}
                onClick={() => { updateGlobals({ scheme: preset.id }); setAnchor(null); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', border: 0, borderRadius: 9, background: active ? 'rgba(143, 179, 107, .16)' : 'transparent', color: 'inherit', font: 'inherit', fontSize: 13, fontWeight: active ? 650 : 500, cursor: 'pointer', textAlign: 'left' }}>
                <Swatch colors={[preset.primary, preset.secondary]} />
                <span style={{ flex: 1 }}>{preset.name}</span>
                {active && <span aria-hidden style={{ color: brand.moss }}>✓</span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** A switch between two states: both options are visible, the active one is highlighted. */
function Segmented({ caption, name, options }: { caption: string; name: string; options: { value: string; label: string; icon: ReactNode }[] }) {
  const [globals, updateGlobals] = useGlobals();
  const narrow = useNarrow();
  if (!useSwitch(name)) return null;
  const value = globals[name] ?? options[0].value;
  return (
    <div style={ui.group}>
      {!narrow && <span style={ui.caption}>{caption}</span>}
      <div role="radiogroup" aria-label={caption} style={{ display: 'inline-flex', height: 30, padding: 3, gap: 2, borderRadius: 999, background: brand.card, border: `1px solid ${brand.line}` }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button key={option.value} type="button" role="radio" aria-checked={active} aria-label={option.label} title={`${caption}: ${option.label}`} onClick={() => updateGlobals({ [name]: option.value })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: narrow ? '0 9px' : '0 12px', border: 0, borderRadius: 999, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background .15s, color .15s',
                background: active ? brand.moss : 'transparent', color: active ? brand.walnut : brand.muted }}>
              {option.icon}{!narrow && option.label}
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
    render: () => <Segmented caption="Modus" name="mode"
      options={[{ value: 'dark', label: 'Dunkel', icon: <MoonIcon size={13} /> }, { value: 'light', label: 'Hell', icon: <SunIcon size={13} /> }]} />,
  });
  addons.add('nexo/device', {
    type: types.TOOL, title: 'Gerät',
    render: () => <Segmented caption="Gerät" name="device"
      options={[{ value: 'desktop', label: 'Desktop', icon: <BrowserIcon size={13} /> }, { value: 'phone', label: 'Handy', icon: <MobileIcon size={13} /> }]} />,
  });
});
