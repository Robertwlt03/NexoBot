import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_THEME, THEME_PRESETS, contrast, normalizeTheme, themeVariables } from '../src/shared/theme.js';

test('every theme: readable text on its accent buttons, and on the light surface for light themes', () => {
  for (const preset of THEME_PRESETS) {
    const vars = themeVariables(normalizeTheme({ preset: preset.id }));
    assert.ok(contrast(vars['--accent'], vars['--accent-ink']) >= 4.5, `${preset.name}: text on accent`);
    if (preset.mode === 'light') assert.ok(contrast(vars['--accent-text'], '#fffaf3') >= 4.5, `${preset.name}: accent text on the light surface`);
  }
});

test('normalizeTheme takes a theme id; older colour presets and custom colours become the wood theme of their mode', () => {
  assert.deepEqual(normalizeTheme({ preset: 'cyberpunk' }), { preset: 'cyberpunk', primary: '#22d3ee', secondary: '#f472b6', mode: 'dark' });
  assert.equal(normalizeTheme({ preset: 'cyberpunk', mode: 'light' }).mode, 'dark');
  assert.equal(normalizeTheme({ preset: 'eiche' }).mode, 'light');
  assert.equal(normalizeTheme({ preset: 'smaragd', mode: 'light' }).preset, 'eiche');
  assert.equal(normalizeTheme({ preset: 'custom', primary: '#FF8800', secondary: '#112233', mode: 'dark' }).preset, 'walnuss');
  assert.deepEqual(normalizeTheme(null), DEFAULT_THEME);
});

test('multi-series chart palette: four colours that stay distinguishable (also with red-green colour blindness)', async () => {
  const { chartPalette, distances } = await import('../src/shared/theme.js');
  for (const preset of THEME_PRESETS) {
    const { mode } = preset;
    const palette = chartPalette(normalizeTheme({ preset: preset.id }));
    assert.equal(palette.length, 4, preset.name);
    // On the light cards every mark reaches 3:1 (WCAG 1.4.11).
    if (mode === 'light') for (const color of palette) assert.ok(contrast(color, '#f2e2c7') >= 3, `${preset.name} light: ${color}`);
    for (let i = 0; i < palette.length - 1; i += 1) {
      // Same floors as the data-viz palette validator: normal vision ΔE ≥ 15, colour-blind ΔE ≥ 6 (legends/tooltips add a second cue).
      const d = distances(palette[i], palette[i + 1]);
      assert.ok(d.normal >= 15 && d.protan >= 6 && d.deutan >= 6, `${preset.name} ${mode}: ${palette[i]} vs ${palette[i + 1]} ${JSON.stringify(d)}`);
    }
  }
});
