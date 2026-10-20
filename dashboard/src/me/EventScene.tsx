// Seasonal dressing for shop events. The banner gets one small flat scene on its right edge — a tree in autumn, a
// snowman by a pine in winter, a lit pumpkin under the moon at Halloween … — and the particles come out of that
// scene: leaves drop from the tree's crown, embers rise from the pumpkin, petals fall from the blossom branch.
// Flat shapes in a few muted tones, so the scene sits in the page instead of on it. All art is drawn here (no
// third-party assets). Reduced motion: everything stands still.
import type { CSSProperties, ReactNode } from 'react';
import type { ShopEvent } from '../../../src/web/dto/profile';
import type { GlyphName } from './visuals';

export type EventTheme = 'love' | 'carnival' | 'easter' | 'summer' | 'autumn' | 'halloween' | 'sale' | 'winter' | 'newyear' | 'party';

const BY_ID: Record<string, EventTheme> = {
  valentine: 'love', carnival: 'carnival', easter: 'easter', 'summer-sale': 'summer', autumn: 'autumn',
  halloween: 'halloween', 'black-friday': 'sale', christmas: 'winter', 'new-year': 'newyear',
};
// First match wins: "Sommer-Sale" is summer, not sale.
const BY_WORD: [RegExp, EventTheme][] = [
  [/valentin|liebe|love/, 'love'], [/fasching|karneval|fastnacht|carnival/, 'carnival'], [/ostern|easter|frühling|spring/, 'easter'],
  [/halloween|grusel|spuk/, 'halloween'], [/herbst|autumn|laub/, 'autumn'], [/winter|weihnacht|xmas|christmas|advent|schnee/, 'winter'],
  [/neujahr|silvester|new.?year/, 'newyear'], [/sommer|summer|sonne/, 'summer'], [/black.?friday|cyber|sale/, 'sale'],
];

export function eventTheme(event: Pick<ShopEvent, 'id' | 'name'>): EventTheme {
  const text = `${event.id} ${event.name}`.toLowerCase();
  return BY_ID[event.id] ?? BY_WORD.find(([pattern]) => pattern.test(text))?.[1] ?? 'party';
}

type Particle = 'leaf' | 'snow' | 'flake' | 'ember' | 'confetti' | 'mote' | 'heart' | 'petal' | 'streamer';

/**
 * Where particles start: 'scene' = inside the scene box (x/y in % of it), 'sky' = across the top of the banner.
 * `wind` = sideways drift over the whole way in px; `motion` = falling or rising.
 */
interface Emitter { area: 'scene' | 'sky'; kinds: Particle[]; motion: 'fall' | 'rise'; x: [number, number]; y: [number, number]; wind: [number, number]; count: number }

const sky = (kinds: Particle[], count: number): Emitter => ({ area: 'sky', kinds, motion: 'fall', x: [0, 100], y: [-6, -2], wind: [-40, 40], count });

export const EVENT_THEMES: Record<EventTheme, { tint: string; glyph: GlyphName; emit: Emitter }> = {
  love: { tint: '#fb7185', glyph: 'heart', emit: { area: 'scene', kinds: ['heart'], motion: 'rise', x: [45, 85], y: [55, 75], wind: [-90, 10], count: 10 } },
  carnival: { tint: '#c084fc', glyph: 'mask', emit: { area: 'scene', kinds: ['confetti', 'confetti', 'streamer'], motion: 'fall', x: [0, 100], y: [4, 16], wind: [-60, 30], count: 18 } },
  easter: { tint: '#86efac', glyph: 'egg', emit: { area: 'scene', kinds: ['petal'], motion: 'fall', x: [45, 92], y: [6, 30], wind: [-200, -60], count: 12 } },
  summer: { tint: '#fbbf24', glyph: 'sun', emit: { area: 'sky', kinds: ['mote'], motion: 'rise', x: [0, 100], y: [86, 100], wind: [-20, 20], count: 14 } },
  autumn: { tint: '#e0913a', glyph: 'leaf', emit: { area: 'scene', kinds: ['leaf'], motion: 'fall', x: [38, 96], y: [14, 52], wind: [-260, -70], count: 14 } },
  halloween: { tint: '#f97316', glyph: 'pumpkin', emit: { area: 'scene', kinds: ['ember'], motion: 'rise', x: [52, 74], y: [80, 88], wind: [-50, 10], count: 12 } },
  sale: { tint: '#facc15', glyph: 'tag', emit: sky(['confetti'], 10) },
  winter: { tint: '#8fd3ff', glyph: 'snowflake', emit: sky(['snow', 'snow', 'flake'], 26) },
  newyear: { tint: '#facc15', glyph: 'rocket', emit: sky(['confetti'], 20) },
  party: { tint: '#a78bfa', glyph: 'gift', emit: { area: 'scene', kinds: ['confetti'], motion: 'fall', x: [0, 100], y: [4, 16], wind: [-60, 30], count: 16 } },
};

const LEAF_COLOURS = ['#b0561f', '#8a3414', '#c98a2a', '#d9a441'];
const CONFETTI_COLOURS = ['#facc15', '#f472b6', '#60a5fa', '#e9e4dc', '#c084fc'];
const PETAL_COLOURS = ['#f7c6da', '#fbeaf1', '#f2a7c3'];
const HEART = 'M12 21C5 16.5 2 12.6 2 8.6 2 5.5 4.4 3 7.4 3c1.9 0 3.6 1 4.6 2.6C13 4 14.7 3 16.6 3 19.6 3 22 5.5 22 8.6c0 4-3 7.9-10 12.4Z';

function ParticleArt({ kind, size, colour }: { kind: Particle; size: number; colour: number }) {
  switch (kind) {
    case 'leaf': return <svg viewBox="-12 -12 24 24" style={{ width: size, height: size }}><path d="M0-11C7-6 7 5 0 11-7 5-7-6 0-11Z" fill={LEAF_COLOURS[colour % 4]} /><path d="M0-9V10" stroke="#00000030" strokeWidth="1.2" /></svg>;
    case 'snow': return <span className="block rounded-full bg-white/80" style={{ width: size / 3, height: size / 3 }} />;
    case 'flake': return <svg viewBox="0 0 24 24" style={{ width: size, height: size }}><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".8" /></svg>;
    case 'ember': return <span className="block rounded-full bg-[#ffb347] shadow-[0_0_6px_#f97316]" style={{ width: size / 4, height: size / 4 }} />;
    case 'confetti': return <span className="block rounded-[1px]" style={{ width: size / 2.5, height: size / 5, background: CONFETTI_COLOURS[colour % 5] }} />;
    case 'mote': return <span className="block rounded-full bg-[#ffe9a8]/60" style={{ width: size / 3.5, height: size / 3.5 }} />;
    case 'heart': return <svg viewBox="0 0 24 24" style={{ width: size * 0.75, height: size * 0.75 }}><path d={HEART} fill={colour % 2 ? '#e5536f' : '#f27b93'} /></svg>;
    case 'petal': return <svg viewBox="-6 -10 12 20" style={{ width: size * 0.5, height: size * 0.8 }}><path d="M0-9C5-5 5 5 0 9-5 5-5-5 0-9Z" fill={PETAL_COLOURS[colour % 3]} /></svg>;
    case 'streamer': return <svg viewBox="0 0 12 30" style={{ width: size * 0.45, height: size * 1.2 }}><path d="M6 1c5 3-5 6 0 9s-5 6 0 9-5 6 0 9" stroke={CONFETTI_COLOURS[colour % 5]} strokeWidth="2" fill="none" strokeLinecap="round" /></svg>;
  }
}

/** Stable pseudo-random 0–1, so the scene does not jump on re-render. */
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 97.13 + k * 13.7) * 43758.5453;
  return x - Math.floor(x);
};
const between = ([min, max]: [number, number], r: number) => min + (max - min) * r;

/**
 * Each particle is a column as tall as its container, so translateY(100%) is the container's height. It starts at
 * its spawn point, fades in, drifts with the wind and fades out before it leaves the banner.
 */
function Particles({ emit }: { emit: Emitter }) {
  return (
    <>
      {Array.from({ length: emit.count }, (_, i) => {
        const y = between(emit.y, rand(i, 3));
        const duration = 8 + rand(i, 1) * 8;
        return (
          <span key={i} className="event-particle" style={{
            left: `${between(emit.x, rand(i, 0))}%`, top: `${y}%`, '--dist': `${emit.motion === 'fall' ? 104 - y : -(y + 4)}%`,
            '--wind': `${between(emit.wind, rand(i, 8))}px`, '--dur': `${duration}s`, '--delay': `-${rand(i, 2) * duration}s`,
            '--t': 0.15 + rand(i, 9) * 0.6, '--o': 0.6 + rand(i, 6) * 0.4,
          } as CSSProperties}>
            <span className="event-sway" style={{ '--sway': `${6 + rand(i, 4) * 12}px`, '--spin': `${20 + rand(i, 5) * 50}deg` } as CSSProperties}>
              <ParticleArt kind={emit.kinds[i % emit.kinds.length]} size={10 + rand(i, 7) * 10} colour={i} />
            </span>
          </span>
        );
      })}
    </>
  );
}

// ---------- Scenes: 240×320, anchored bottom right ----------

/** Points along a quadratic curve, for garlands. */
const alongQuad = (p0: number[], p1: number[], p2: number[], n: number) => Array.from({ length: n }, (_, i) => {
  const t = (i + 0.5) / n;
  return [0, 1].map((k) => (1 - t) ** 2 * p0[k] + 2 * (1 - t) * t * p1[k] + t ** 2 * p2[k]);
});

function Garland({ colours }: { colours: string[] }) {
  const strands: [number[], number[], number[]][] = [[[-10, 14], [120, 74], [250, 22]], [[60, -6], [170, 64], [250, 70]]];
  return (
    <>
      {strands.map(([a, b, c], s) => (
        <g key={s}>
          <path d={`M${a[0]} ${a[1]}Q${b[0]} ${b[1]} ${c[0]} ${c[1]}`} stroke="#d9cdb8" strokeOpacity=".5" strokeWidth="1.2" fill="none" />
          {alongQuad(a, b, c, s ? 7 : 10).map(([x, y], i) => <path key={i} d={`M${x - 7} ${y}h14l-7 15Z`} fill={colours[(i + s * 2) % colours.length]} />)}
        </g>
      ))}
    </>
  );
}

/** Grass edge from x 0 to 240 at base y, blades up to `tall` px. */
const grass = (base: number, tall: number, seed: number) =>
  `M0 320V${base}${Array.from({ length: 40 }, (_, i) => `L${i * 6 + 3} ${base - tall * (0.4 + rand(i, seed) * 0.6)}L${i * 6 + 6} ${base}`).join('')}V320Z`;

const flower = (x: number, y: number, r: number, fill: string) => (
  <g key={`${x}-${y}`}>
    {[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * r} cy={y + Math.sin((a * Math.PI) / 180) * r} r={r} fill={fill} />)}
    <circle cx={x} cy={y} r={r * 0.55} fill="#e8b84a" />
  </g>
);

const burst = (cx: number, cy: number, r: number, colour: string, delay: number) => (
  <g key={`${cx}`} className="event-twinkle" style={{ animationDelay: `${delay}s` }} stroke={colour} strokeWidth="2.2" strokeLinecap="round">
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return <path key={i} d={`M${cx + Math.cos(a) * r * 0.4} ${cy + Math.sin(a) * r * 0.4}L${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`} />;
    })}
  </g>
);

const BAT = 'M12 3C10 1 8 1 7 2 5 0 2 0 0 3c2 0 3 1 3 3 2-1 3 0 4 2 1-2 3-2 5 1 2-3 4-3 5-1 1-2 2-3 4-2 0-2 1-3 3-3-2-3-5-3-7-1-1-1-3-1-5 1Z';
const MASK = 'M14 54c2-14 20-16 46-6 26-10 44-8 46 6 2 18-14 28-28 24-8-2-12-8-18-8s-10 6-18 8c-14 4-30-6-28-24Z';
const MASK_EYE = 'M30 58c6-8 18-6 22 2-6 6-18 6-22-2Z';
const swing = (x: number, delay: number): CSSProperties => ({ transformOrigin: `${x}px 0px`, transformBox: 'view-box', animationDelay: `${delay}s` });

function scene(theme: EventTheme, discount: number): ReactNode {
  switch (theme) {
    case 'autumn': {
      // Crown of foliage clumps in three tiers, drawn back to front and lit from above: each clump is its shadow tone
      // with the lit tone shifted up-left on top. Branches run into the crown and show again over the lowest tier.
      const tiers: [string, string, number[][]][] = [
        ['#5e250d', '#7c3314', [[118, 150, 28], [166, 160, 32], [214, 156, 30], [250, 140, 24]]],
        ['#7c3314', '#a8501c', [[100, 112, 30], [146, 118, 38], [196, 116, 40], [242, 104, 30]]],
        ['#a8501c', '#c97a2a', [[128, 74, 34], [176, 58, 40], [224, 72, 34]]],
      ];
      return (
        <>
          <path d="M118 320c16-8 102-10 122-4v4Z" fill="#7c3314" opacity=".55" />
          <path d="M174 320c10-4 15-16 15-34 0-30-2-58-6-90h17c-2 32-2 60 0 90 0 18 4 30 14 34Z" fill="#3a2617" />
          <path d="M192 206 150 150M196 200l4-84M200 206l38-58" stroke="#3a2617" strokeWidth="8" strokeLinecap="round" />
          {tiers.map(([shade, lit, clumps]) => clumps.map(([x, y, r]) => (
            <g key={`${x}-${y}`}><circle cx={x} cy={y} r={r} fill={shade} /><circle cx={x - r * 0.12} cy={y - r * 0.16} r={r * 0.84} fill={lit} /></g>
          )))}
          <path d="M193 206l-20-26M199 206l22-24" stroke="#3a2617" strokeWidth="6" strokeLinecap="round" />
        </>
      );
    }
    case 'winter':
      return (
        <>
          <path d="M0 294c60-26 160-30 240-12v38H0Z" fill="#dfe9f3" opacity=".22" />
          <path d="M196 136l24 44h-12l20 38h-14l22 42h-80l22-42h-14l20-38h-12Z" fill="#1d3a2c" /><rect x="192" y="260" width="8" height="18" fill="#3a2a1d" />
          <path d="M196 136l9 16-9-3-9 3Z" fill="#dfe9f3" />
          <path d="M0 304c70-18 170-20 240-6v22H0Z" fill="#dfe9f3" opacity=".32" />
          <path d="M96 236 78 226M124 236l18-12" stroke="#4a3426" strokeWidth="3" strokeLinecap="round" />
          <circle cx="110" cy="276" r="22" fill="#d7e3ef" /><circle cx="110" cy="240" r="15" fill="#d7e3ef" /><circle cx="110" cy="214" r="11" fill="#d7e3ef" />
          <rect x="101" y="190" width="18" height="14" rx="2" fill="#1d1d22" /><rect x="96" y="202" width="28" height="4" rx="2" fill="#1d1d22" />
          <path d="M98 226h24v6H98Z" fill="#b8333a" /><path d="M114 230l4 16h-6l-2-15Z" fill="#b8333a" />
          <path d="M110 215l12 3-12 2Z" fill="#e8862a" />
          {[[106, 211, 1.6], [114, 211, 1.6], [110, 238, 1.8], [110, 246, 1.8]].map(([x, y, r]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#1d1d22" />)}
        </>
      );
    case 'halloween':
      return (
        <>
          <circle cx="176" cy="70" r="34" fill="#efdcac" opacity=".85" /><circle cx="166" cy="62" r="6" fill="#dcc48d" opacity=".7" /><circle cx="186" cy="84" r="4" fill="#dcc48d" opacity=".7" />
          {[[112, 58, 1.4], [206, 120, 1], [136, 100, 0.8]].map(([x, y, k]) => <path key={x} d={BAT} fill="#0e0b09" transform={`translate(${x} ${y}) scale(${k * 1.4})`} />)}
          <path d="M0 302c70-24 170-26 240-8v26H0Z" fill="#0d0a08" opacity=".85" />
          <g stroke="#9c420a" strokeWidth="1.5">
            <ellipse cx="128" cy="270" rx="26" ry="30" fill="#c2561a" /><ellipse cx="172" cy="270" rx="26" ry="30" fill="#c2561a" />
            <ellipse cx="150" cy="270" rx="24" ry="32" fill="#dc6a1f" />
          </g>
          <path d="M148 240c-1-8 1-14 6-18l5 3c-4 4-5 9-5 15Z" fill="#4d6b2a" />
          <g fill="#ffcf4a"><path d="M128 266l8-11 4 13Z" /><path d="M172 266l-8-11-4 13Z" /><path d="M128 279q22 18 44 0l-5 2-3-3-5 5-4-4-5 5-5-5-4 4-5-5-3 3Z" /></g>
        </>
      );
    case 'newyear':
      return (
        <>
          {burst(110, 70, 34, '#e8b84a', 0)}{burst(196, 112, 26, '#f27b93', 1.1)}{burst(56, 140, 20, '#7dc4e8', 2.2)}
          {[[0, 250, 40], [36, 226, 34], [66, 262, 30], [92, 206, 40], [128, 240, 30], [154, 190, 36], [186, 232, 30], [212, 214, 28]].map(([x, y, w], b) => (
            <g key={x}>
              <rect x={x} y={y} width={w} height={320 - y} fill="#151a2c" />
              {Array.from({ length: Math.floor((320 - y) / 14) * 2 }, (_, i) => rand(b * 50 + i, 11) > 0.6 && (
                <rect key={i} x={x + 6 + (i % 2) * (w - 18)} y={y + 8 + Math.floor(i / 2) * 14} width="6" height="5" fill="#e8b84a" opacity=".6" />
              ))}
            </g>
          ))}
        </>
      );
    case 'summer':
      return (
        <>
          <g className="event-turn" style={{ transformOrigin: '150px 96px', transformBox: 'view-box' }} stroke="#f2b33d" strokeWidth="5" strokeLinecap="round">
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return <path key={i} d={`M${150 + Math.cos(a) * 52} ${96 + Math.sin(a) * 52}L${150 + Math.cos(a) * 64} ${96 + Math.sin(a) * 64}`} />;
            })}
          </g>
          <circle cx="150" cy="96" r="40" fill="#f2b33d" />
          <path d="M214 310c-6-50-4-104 8-150" stroke="#5a3d22" strokeWidth="9" strokeLinecap="round" fill="none" />
          <g fill="#2f6b3a">
            <path d="M222 160c-30-18-62-14-80 6 22-6 46-6 80-6Z" /><path d="M222 160c-20-30-50-40-74-34 24 6 46 18 74 34Z" />
            <path d="M222 160c4-30 22-52 46-58-14 16-28 36-46 58Z" /><path d="M222 160c-14 10-26 28-30 50 10-20 20-34 30-50Z" />
          </g>
          <path d="M0 294q20-8 40 0t40 0 40 0 40 0 40 0 40 0v26H0Z" fill="#3a9fd0" opacity=".35" />
          <path d="M0 306q20-8 40 0t40 0 40 0 40 0 40 0 40 0v14H0Z" fill="#3a9fd0" opacity=".55" />
        </>
      );
    case 'sale':
      // Tags swinging on strings from the top edge; the middle one carries the running discount.
      return (
        <>
          {[[96, 40, '%', 0], [150, 96, discount > 0 ? `−${discount}%` : '%', 0.8], [206, 58, '%', 1.6]].map(([x, len, label, delay]) => {
            const [cx, l] = [Number(x), Number(len)];
            return (
              <g key={cx} className="event-swing" style={swing(cx, Number(delay))}>
                <path d={`M${cx} 0V${l}`} stroke="#d9cdb8" strokeOpacity=".5" strokeWidth="1.2" />
                <path d={`M${cx} ${l}l20 14v46h-40v-46Z`} fill="#16130f" stroke="#e8b84a" strokeWidth="2" strokeLinejoin="round" />
                <circle cx={cx} cy={l + 12} r="3" fill="#e8b84a" />
                <text x={cx} y={l + 44} textAnchor="middle" fontSize={String(label).length > 2 ? 12 : 20} fontWeight="800" fill="#e8b84a" fontFamily="system-ui, sans-serif">{label}</text>
              </g>
            );
          })}
        </>
      );
    case 'love':
      return (
        <>
          {[[104, 120, '#e5536f', 0], [162, 86, '#f27b93', 1.2], [196, 150, '#c23656', 2.1]].map(([x, y, fill, delay]) => (
            <g key={String(fill)} className="event-bob" style={{ animationDelay: `${delay}s` }}>
              <path d={`M${Number(x)} ${Number(y) + 30}Q${Number(x) + 6} ${Number(y) + 120} 170 304`} stroke="#e8c6cf" strokeOpacity=".5" strokeWidth="1.2" fill="none" />
              <path d={HEART} fill={String(fill)} transform={`translate(${Number(x) - 29} ${Number(y) - 22}) scale(2.4)`} />
            </g>
          ))}
        </>
      );
    case 'carnival':
      return (
        <>
          <Garland colours={['#c084fc', '#e8b84a', '#f27b93', '#7dc4e8', '#6fbf73']} />
          <g transform="translate(118 214) rotate(-14) scale(.9)">
            <path d="M100 76l14 40" stroke="#e8b84a" strokeWidth="4" strokeLinecap="round" />
            <path d={MASK} fill="#6d28b0" stroke="#e8b84a" strokeWidth="2.5" strokeLinejoin="round" />
            <path d={MASK_EYE} fill="#170826" /><path d={MASK_EYE} transform="matrix(-1 0 0 1 120 0)" fill="#170826" />
          </g>
        </>
      );
    case 'party':
      return (
        <>
          <Garland colours={['#a78bfa', '#e8b84a', '#f27b93', '#7dc4e8']} />
          <rect x="120" y="250" width="80" height="58" rx="3" fill="#5b2bb5" /><rect x="114" y="234" width="92" height="20" rx="3" fill="#7c4ad8" />
          <rect x="154" y="234" width="12" height="74" fill="#e8b84a" />
          <path d="M160 234c-16-18-32-8-20 0 4 3 14 2 20 0Zm0 0c16-18 32-8 20 0-4 3-14 2-20 0Z" fill="#e8b84a" />
        </>
      );
    case 'easter':
      return (
        <>
          <path d="M244 36c-40 6-78 22-110 50M190 50c-10-14-14-26-12-40M160 64c4 14 2 28-6 40" stroke="#6b4a33" strokeWidth="4" strokeLinecap="round" fill="none" />
          {[[138, 84, '#f7c6da'], [176, 56, '#fbeaf1'], [208, 44, '#f7c6da'], [154, 104, '#fbeaf1'], [178, 14, '#f7c6da'], [230, 50, '#fbeaf1'], [118, 98, '#f7c6da']].map(([x, y, fill]) => flower(Number(x), Number(y), 5, String(fill)))}
          <path d={grass(300, 26, 21)} fill="#2a5e35" />
          {[[120, 298, 12, 16, '#f2a7c3'], [160, 304, 10, 13, '#7dc4e8'], [198, 300, 12, 15, '#e8c66a']].map(([x, y, rx, ry, fill]) => (
            <g key={x}>
              <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={String(fill)} />
              <path d={`M${Number(x) - Number(rx)} ${y}l${Number(rx) / 2} -4 ${Number(rx) / 2} 4 ${Number(rx) / 2} -4 ${Number(rx) / 2} 4`} stroke="#fff" strokeOpacity=".7" strokeWidth="2" fill="none" />
            </g>
          ))}
          <path d={grass(314, 14, 33)} fill="#3a7a46" />
        </>
      );
  }
}

/** Right padding for the banner content, matching the scene strip (the card may overlap the crown a little). */
export const SCENE_ROOM = '@xl:pr-[32%] @3xl:pr-[150px]';

/** The banner's event layer: the scene on the right edge and its particles. */
export function EventBackdrop({ theme, discount }: { theme: EventTheme; discount: number }) {
  const { emit } = EVENT_THEMES[theme];
  // Without room for the scene (phones), its particles come from the sky instead.
  const fromSky: Emitter = { ...emit, area: 'sky', x: [0, 100], y: emit.motion === 'fall' ? [-6, -2] : [86, 100] };
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {emit.area === 'sky' ? <Particles emit={emit} /> : <div className="@xl:hidden"><Particles emit={fromSky} /></div>}
      {/* The banner keeps this strip free (SCENE_ROOM), so text and card never sit on the scene. */}
      <div className="absolute bottom-0 right-0 hidden h-full w-[32%] @xl:block @3xl:w-[220px]">
        <svg viewBox="0 0 240 320" preserveAspectRatio="xMaxYMax meet" className="h-full w-full">{scene(theme, discount)}</svg>
        {emit.area === 'scene' && <Particles emit={emit} />}
      </div>
    </div>
  );
}
