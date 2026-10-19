import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_THEME, THEME_PRESETS, contrast, normalizeTheme, themeVariables, themeWarnings } from '../src/shared/theme.js';

test('every preset reads well on the dark and the light surfaces', () => {
  for (const preset of THEME_PRESETS) {
    for (const mode of ['dark', 'light'] as const) {
      const theme = { preset: preset.id, primary: preset.primary, secondary: preset.secondary, mode };
      assert.deepEqual(themeWarnings(theme), [], `${preset.name} ${mode}`);
      const vars = themeVariables(theme);
      assert.ok(contrast(vars['--accent'], vars['--accent-ink']) >= 4.5, `${preset.name} ${mode}: text on accent`);
      if (mode === 'light') assert.ok(contrast(vars['--accent-text'], '#fffaf3') >= 4.5, `${preset.name}: accent text on the light surface`);
    }
  }
});

test('normalizeTheme accepts presets and valid custom colours, rejects the rest', () => {
  assert.deepEqual(normalizeTheme({ preset: 'smaragd' }), { preset: 'smaragd', primary: '#34d399', secondary: '#5eead4', mode: 'dark' });
  assert.equal(normalizeTheme({ preset: 'smaragd', mode: 'light' }).mode, 'light');
  assert.equal(normalizeTheme({ preset: 'smaragd', mode: 'neon' }).mode, 'dark');
  assert.deepEqual(normalizeTheme({ preset: 'custom', primary: '#FF8800', secondary: '#112233' }), { preset: 'custom', primary: '#ff8800', secondary: '#112233', mode: 'dark' });
  assert.deepEqual(normalizeTheme({ preset: 'custom', primary: 'red', secondary: '#112233' }), DEFAULT_THEME);
  assert.deepEqual(normalizeTheme(null), DEFAULT_THEME);
});

test('a dark custom primary triggers a contrast warning', () => {
  assert.ok(themeWarnings({ preset: 'custom', primary: '#1e1b4b', secondary: '#67e8f9', mode: 'dark' }).length > 0);
});

test('multi-series chart palette: four colours that stay distinguishable (also with red-green colour blindness)', async () => {
  const { chartPalette, distances } = await import('../src/shared/theme.js');
  for (const preset of THEME_PRESETS) {
    const palette = chartPalette({ preset: preset.id, primary: preset.primary, secondary: preset.secondary, mode: 'dark' });
    assert.equal(palette.length, 4, preset.name);
    for (let i = 0; i < palette.length - 1; i += 1) {
      // Same floors as the data-viz palette validator: normal vision ΔE ≥ 15, colour-blind ΔE ≥ 6 (legends/tooltips add a second cue).
      const d = distances(palette[i], palette[i + 1]);
      assert.ok(d.normal >= 15 && d.protan >= 6 && d.deutan >= 6, `${preset.name}: ${palette[i]} vs ${palette[i + 1]} ${JSON.stringify(d)}`);
    }
  }
});
