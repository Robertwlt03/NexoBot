// The toolbar switches, built from Storybook's own components so they look native: the colour scheme is a select with
// swatches, light/dark and desktop/phone are pairs of toggle buttons that show both options.
// A story lists in `parameters.switches` the switches that change something on it; the others are hidden there.
// On a phone the switches shrink to icons and Storybook's zoom and isolation buttons are hidden, so everything fits.
// The manager bundle compiles JSX to React.createElement, so React has to be in scope.
import React, { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { BrowserIcon, MobileIcon, MoonIcon, SunIcon } from '@storybook/icons';
import { Select, Separator, ToggleButton } from 'storybook/internal/components';
import { addons, types, useGlobals, useParameter, useStorybookApi } from 'storybook/manager-api';
import { THEME_PRESETS } from '../src/shared/theme';

const NARROW = '(max-width: 640px)';
const narrowQuery = window.matchMedia(NARROW);
const useNarrow = () => useSyncExternalStore((onChange) => {
  narrowQuery.addEventListener('change', onChange);
  return () => narrowQuery.removeEventListener('change', onChange);
}, () => narrowQuery.matches);

// Fewer buttons: the editor link, tag filter, "new story", "modified stories" and the context menus only help while coding. Zoom and isolation mode
// do not fit next to our switches on a phone.
const hide = (selectors: string[]) => `${selectors.join(', ')} { display: none !important; }`;
const label = (text: string) => `[aria-label="${text}"]`;
const frameStyle = document.createElement('style');
frameStyle.textContent = hide([
  label('Open in editor'), '[aria-label$="tag filter"]', '[aria-label$="tag filters"]',
  label('Create a new story'), label('Show modified stories since last commit'), label('Open context menu'),
]) + ` @media ${NARROW} { ${hide([label('Open in isolation mode'), label('Change zoom level')])} }`;
document.head.append(frameStyle);

addons.setConfig({ showPanel: false });

// The addon panel (controls, actions, accessibility) only has content on the component stories (`parameters.panel`).
const panelStyle = document.createElement('style');
document.head.append(panelStyle);

/** Opens the panel on component stories and closes it, with its button, everywhere else. */
function PanelSync() {
  const api = useStorybookApi();
  const panel = useParameter<boolean>('panel', false);
  useEffect(() => {
    api.togglePanel(panel);
    panelStyle.textContent = panel ? '' : hide([label('Show addon panel'), label('Hide addon panel')]);
  }, [api, panel]);
  return null;
}

const ORDER = ['scheme', 'mode', 'device'];
/** The switches the open story lists in `parameters.switches` (all three by default, see preview.tsx). */
const useSwitches = () => useParameter<string[]>('switches', ORDER);
/** A separator goes only between our switches: in front of one when an earlier one is shown too. */
const followsAnother = (switches: string[], name: string) => ORDER.slice(0, ORDER.indexOf(name)).some((other) => switches.includes(other));

const Swatch = ({ colors }: { colors: string[] }) => (
  <span style={{ display: 'inline-flex' }}>
    {colors.map((color, i) => <span key={color + i} style={{ width: 12, height: 12, borderRadius: '50%', background: color, boxShadow: '0 0 0 1px rgba(0,0,0,.2)', marginLeft: i ? -4 : 0 }} />)}
  </span>
);

/** A choice from a list: the current scheme with its colours, the list shows all twelve. */
function SchemePicker() {
  const [globals, updateGlobals] = useGlobals();
  const narrow = useNarrow();
  if (!useSwitches().includes('scheme')) return null;
  const current = THEME_PRESETS.find((p) => p.id === globals.scheme) ?? THEME_PRESETS[0];
  return (
    <>
      {/* Select keeps its choice internally; the key resets it when the scheme comes from the address. */}
      <Select key={current.id} ariaLabel="Farbvorlage" tooltip="Farbvorlage" size="small" padding="small"
        icon={<Swatch colors={[current.primary, current.secondary]} />} showSelectedOptionTitle={!narrow}
        defaultOptions={[current.id]} onSelect={(scheme) => updateGlobals({ scheme })}
        options={THEME_PRESETS.map((p) => ({ value: p.id, title: p.name, icon: <Swatch colors={[p.primary, p.secondary]} /> }))}>
        {narrow ? null : 'Farbvorlage'}
      </Select>
    </>
  );
}

/** A switch between two states: both options are visible, the active one is pressed. */
function Pair({ caption, name, options }: { caption: string; name: string; options: { value: string; label: string; icon: ReactNode }[] }) {
  const [globals, updateGlobals] = useGlobals();
  const narrow = useNarrow();
  const switches = useSwitches();
  if (!switches.includes(name)) return null;
  const value = globals[name] ?? options[0].value;
  return (
    <>
      {followsAnother(switches, name) && <Separator />}
      <div role="group" aria-label={caption} style={{ display: 'flex', gap: 2 }}>
        {options.map((option) => (
          <ToggleButton key={option.value} pressed={option.value === value} size="small" padding={narrow ? 'small' : 'medium'} variant="ghost"
            ariaLabel={`${caption}: ${option.label}`} onClick={() => updateGlobals({ [name]: option.value })}>
            {option.icon}{!narrow && option.label}
          </ToggleButton>
        ))}
      </div>
    </>
  );
}

addons.register('nexo/toolbar', () => {
  addons.add('nexo/panel', { type: types.TOOL, title: 'Panel', render: () => <PanelSync /> });
  addons.add('nexo/scheme', { type: types.TOOL, title: 'Farbvorlage', render: () => <SchemePicker /> });
  addons.add('nexo/mode', {
    type: types.TOOL, title: 'Modus',
    render: () => <Pair caption="Modus" name="mode"
      options={[{ value: 'dark', label: 'Dunkel', icon: <MoonIcon /> }, { value: 'light', label: 'Hell', icon: <SunIcon /> }]} />,
  });
  addons.add('nexo/device', {
    type: types.TOOL, title: 'Gerät',
    render: () => <Pair caption="Gerät" name="device"
      options={[{ value: 'desktop', label: 'Desktop', icon: <BrowserIcon /> }, { value: 'phone', label: 'Handy', icon: <MobileIcon /> }]} />,
  });
});
