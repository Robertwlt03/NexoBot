import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_THEME, THEME_PRESETS, contrast, normalizeTheme, themeVariables, themeWarnings } from '../src/shared/theme.js';

test('every preset reads well on the dark surface', () => {
  for (const preset of THEME_PRESETS) {
    const theme = { preset: preset.id, primary: preset.primary, secondary: preset.secondary };
    assert.deepEqual(themeWarnings(theme), [], preset.name);
    const vars = themeVariables(theme);
    assert.ok(contrast(vars['--accent'], vars['--accent-ink']) >= 4.5, `${preset.name}: text on accent`);
  }
});

test('normalizeTheme accepts presets and valid custom colours, rejects the rest', () => {
  assert.deepEqual(normalizeTheme({ preset: 'smaragd' }), { preset: 'smaragd', primary: '#34d399', secondary: '#5eead4' });
  assert.deepEqual(normalizeTheme({ preset: 'custom', primary: '#FF8800', secondary: '#112233' }), { preset: 'custom', primary: '#ff8800', secondary: '#112233' });
  assert.deepEqual(normalizeTheme({ preset: 'custom', primary: 'red', secondary: '#112233' }), DEFAULT_THEME);
  assert.deepEqual(normalizeTheme(null), DEFAULT_THEME);
});

test('a dark custom primary triggers a contrast warning', () => {
  assert.ok(themeWarnings({ preset: 'custom', primary: '#1e1b4b', secondary: '#67e8f9' }).length > 0);
});
