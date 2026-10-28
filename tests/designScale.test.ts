import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// The dashboard's scales (tailwind.css, Storybook "Grundlagen"): every font size, corner, spacing step, ease and
// duration on the pages is one of the named steps. A line marked `design-scale: ignore` (and the line after it) is
// skipped, for things that copy someone else's metrics, like the Discord previews.
const root = new URL('../dashboard/src/', import.meta.url).pathname;
// Illustrations and staged effects keep their own sizes and timing (the landing page keeps Tailwind's defaults).
const ART = /Landing|EventScene|EventIcon|ProductStage|Celebration|NexoLogo|CoinFlight/;

function files(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path, ext) : path.endsWith(ext) ? [path] : [];
  });
}
/** Every checked line of the dashboard's components, with its place. */
function lines(): { at: string; line: string }[] {
  return files(root, '.tsx').filter((path) => !ART.test(path)).flatMap((path) => {
    let skip = false;
    return readFileSync(path, 'utf8').split('\n').flatMap((line, i) => {
      const ignored = skip || line.includes('design-scale: ignore');
      skip = line.includes('design-scale: ignore');
      return ignored ? [] : [{ at: `${relative(root, path)}:${i + 1}`, line }];
    });
  });
}
const START = String.raw`(?<=[\s"'\`:{(])`;
const END = String.raw`(?=[\s"'\`}]|$)`;
const SPACE_STEPS = new Set(['0', 'px', '0.5', '1', '1.5', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24', '32', 'auto']);

const RULES: { name: string; pattern: RegExp; allowed?: (match: RegExpMatchArray) => boolean }[] = [
  { name: 'font size outside the type scale', pattern: new RegExp(`${START}text-(\\[[\\d.]+(?:px|rem)\\]|xs|sm|base|lg|[2-9]?xl)${END}`, 'g') },
  {
    name: 'corner outside the radius scale',
    pattern: new RegExp(`${START}rounded(?:-[trblse]{1,2})?(?:-([\\w\\[\\]().-]+))?${END}`, 'g'),
    allowed: (m) => ['full', 'none', 'tag', 'control', 'box', 'panel', 'pill'].includes(m[1] ?? ''),
  },
  { name: 'letter spacing outside the scale', pattern: new RegExp(`${START}tracking-(?!tight|caps|headline|normal)[\\w\\[\\].-]+${END}`, 'g') },
  { name: 'line height outside the scale', pattern: new RegExp(`${START}leading-\\[[^\\]]+\\]${END}`, 'g') },
  { name: 'font weight outside the scale', pattern: new RegExp(`${START}font-(?:thin|extralight|extrabold|black)${END}`, 'g') },
  { name: 'duration outside the motion scale', pattern: new RegExp(`${START}duration-(?!fast|base|slow|long)[\\w\\[\\]]+${END}`, 'g') },
  { name: 'ease outside the motion scale', pattern: new RegExp(`${START}ease-(?!enter|exit|pop|loop|linear)[\\w\\[\\](),.-]+${END}`, 'g') },
  {
    name: 'spacing off the grid',
    pattern: new RegExp(`${START}-?(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y)-([\\w.\\[\\]]+)${END}`, 'g'),
    allowed: (m) => SPACE_STEPS.has(m[1]) || /^\[[\d.]+em\]$/.test(m[1]),
  },
  { name: 'GSAP duration outside MOTION', pattern: /\bduration: (?:\w+ \? 0 : )?(?:0?\.\d+|[1-9][\d.]*)\b/g },
  { name: 'GSAP ease outside MOTION', pattern: /\bease: '(?!none')[^']+'/g },
];

test('the dashboard pages use only the named type, corner, spacing and motion steps', () => {
  const problems: string[] = [];
  for (const { at, line } of lines()) {
    if (at.startsWith('components/motion.ts')) continue;
    for (const rule of RULES) {
      for (const match of line.matchAll(rule.pattern)) {
        // An option value that only looks like a class (the welcome card's avatar shape 'rounded').
        if (/value: '$/.test(line.slice(0, match.index))) continue;
        if (!rule.allowed?.(match)) problems.push(`${at} ${rule.name}: ${match[0]}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('the shared component styles read sizes, corners and durations from the scales', () => {
  const css = readFileSync(join(root, 'styles.css'), 'utf8').split('\n');
  const start = css.findIndex((line) => line.startsWith('@layer base'));
  // Discord's own look, the scrollbar, Cyberpunk's cut shapes and the endless event loops keep their own values.
  const own = /\.preview|\.embed|\.mention|::-webkit-scrollbar|data-theme="cyberpunk"|theme-sample|cyber-hud|\.rail-|event-|@keyframes|spin |skeleton-pulse|holo-spin/;
  const grid = new Set([0, 1, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48]);
  const problems: string[] = [];
  css.slice(start).forEach((line, i) => {
    if (own.test(line)) return;
    const at = `styles.css:${start + i + 1}`;
    for (const m of line.matchAll(/font-size: ([^;]+)/g)) if (!/var\(--text-|clamp\(var\(--text-|[\d.]+em/.test(m[1])) problems.push(`${at} font-size ${m[1]}`);
    for (const m of line.matchAll(/border-radius: ([^;]+)/g)) if (!/^(var\(--radius-\w+\)|50%|0|inherit|[\d.]+% \/ [\d.]+%)$/.test(m[1])) problems.push(`${at} border-radius ${m[1]}`);
    for (const m of line.matchAll(/transition: ([^;]+)/g)) if (/\d+m?s\b/.test(m[1])) problems.push(`${at} transition ${m[1]}`);
    for (const m of line.matchAll(/(?:padding|gap|margin(?:-\w+)?|row-gap): ([^;]+)/g)) {
      for (const px of m[1].matchAll(/(\d+)px/g)) if (!grid.has(Number(px[1]))) problems.push(`${at} spacing ${m[0]}`);
    }
  });
  assert.deepEqual(problems, []);
});

test('GSAP and CSS share one motion scale', () => {
  const tw = readFileSync(join(root, 'tailwind.css'), 'utf8');
  const motion = readFileSync(join(root, 'components/motion.ts'), 'utf8');
  for (const step of ['fast', 'base', 'slow', 'long']) {
    const css = Number(tw.match(new RegExp(`--dur-${step}: (\\d+)ms`))![1]) / 1000;
    const gsap = Number(motion.match(new RegExp(`\\b${step}: ([\\d.]+)`))![1]);
    assert.equal(gsap, css, `MOTION.${step} = ${gsap}s, --dur-${step} = ${css}s`);
  }
});
