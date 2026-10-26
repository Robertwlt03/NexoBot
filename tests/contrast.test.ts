import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_PRESETS, contrast, mix, themeVariables } from '../src/shared/theme.js';

// Reads the mode tokens straight from the dashboard stylesheet, so a colour tweak there cannot silently drop below WCAG AA.
const css = readFileSync(new URL('../dashboard/src/styles.css', import.meta.url), 'utf8');
function tokens(selector: string): Record<string, string> {
  const block = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));
}
// Each theme's token block; Cyberpunk overrides the dark block, so it starts from it.
const SELECTORS = { walnuss: ':root, [data-mode="dark"]', eiche: '[data-mode="light"]', cyberpunk: '[data-theme="cyberpunk"], [data-theme="cyberpunk"] [data-mode="dark"]:not([data-theme])' } as const;
const MODES: Record<keyof typeof SELECTORS, Record<string, string>> = {
  walnuss: tokens(SELECTORS.walnuss),
  eiche: tokens(SELECTORS.eiche),
  cyberpunk: { ...tokens(SELECTORS.walnuss), ...tokens(SELECTORS.cyberpunk) },
};
const BACKGROUNDS = ['--bg-main', '--bg-sidebar', '--bg-card', '--bg-card-hover', '--bg-input'];

for (const [mode, t] of Object.entries(MODES)) {
  test(`${mode}: every text and status colour reads at 4.5:1 on every surface`, () => {
    for (const text of ['--text-strong', '--text', '--text-muted', '--text-faint', '--pos', '--neg', '--warning', '--rarity-rare', '--rarity-epic', '--rarity-legendary', '--rarity-mythic']) {
      for (const bg of BACKGROUNDS) {
        assert.ok(t[text] && t[bg], `${mode}: ${text} / ${bg} missing`);
        assert.ok(contrast(t[text], t[bg]) >= 4.5, `${mode}: ${text} on ${bg} = ${contrast(t[text], t[bg]).toFixed(2)}`);
      }
    }
  });
  test(`${mode}: form control borders reach 3:1`, () => {
    for (const bg of ['--bg-card', '--bg-input']) assert.ok(contrast(t['--border-input'], t[bg]) >= 3, `${mode}: border on ${bg}`);
  });
  test(`${mode}: button, chip, badge and tab bar outlines reach 2:1 on cards, page and sidebar`, () => {
    const block = css.slice(css.indexOf(`${SELECTORS[mode as keyof typeof SELECTORS]} {`)).split('}')[0];
    const ov = block.match(/--ov:\s*(\d+) (\d+) (\d+);/)!.slice(1).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    const alpha = Number(block.match(/--border-control:\s*rgb\(var\(--ov\) \/ ([\d.]+)\)/)![1]);
    for (const bg of ['--bg-card', '--bg-main', '--bg-sidebar']) assert.ok(contrast(mix(t[bg], `#${ov}`, alpha), t[bg]) >= 2, `${mode}: outline on ${bg}`);
  });
}

test('accent text of every theme reads at 4.5:1 on its page, sidebar and cards', () => {
  for (const preset of THEME_PRESETS) {
    const t = MODES[preset.id as keyof typeof MODES];
    assert.ok(t, `${preset.id}: no token block in styles.css`);
    const vars = themeVariables({ preset: preset.id, primary: preset.primary, secondary: preset.secondary, mode: preset.mode });
    for (const bg of ['--bg-main', '--bg-sidebar', '--bg-card']) {
      assert.ok(contrast(vars['--accent-text'], t[bg]) >= 4.5, `${preset.name}: accent text on ${bg}`);
      assert.ok(contrast(vars['--accent-text-muted'], t[bg]) >= 4.5, `${preset.name}: muted accent text on ${bg}`);
    }
  }
});

test('white text on the success button reads at 4.5:1', () => {
  const success = css.match(/--success:\s*(#[0-9a-f]{6});/i)?.[1];
  assert.ok(success && contrast('#ffffff', success) >= 4.5, `success ${success}`);
});
