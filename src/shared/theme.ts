// Personal dashboard theme (per user, stored with the member profile). A theme is a complete look - surfaces, header
// art, accent colours and its own light or dark mode - chosen from a fixed list; there are no free colours any more.
// Import-free: shared by the API (validation) and the dashboard (applying the theme).

export type ThemeMode = 'dark' | 'light';
/** What the page header and ornaments are made of (styles.css and components/Backdrop.tsx switch on it). */
export type ThemeLook = 'wood' | 'cyber';

export interface DashboardTheme {
  /** Theme id from THEME_PRESETS. */
  preset: string;
  /** The theme's own colours and mode (derived from the preset, kept in the stored value for older clients). */
  primary: string;
  secondary: string;
  mode: ThemeMode;
}

export interface ThemePreset {
  id: string;
  name: string;
  /** One sentence for the design page. */
  description: string;
  mode: ThemeMode;
  look: ThemeLook;
  primary: string;
  secondary: string;
  /** Card surface, darkest surface accent text sits on, and the page canvas (mirror styles.css). */
  surface: string;
  sidebar: string;
  canvas: string;
  /** Muted body tone the muted accent text is mixed toward. */
  muted: string;
}

/** The themes members choose from. The first one is the default. */
export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'walnuss', name: 'Walnuss', description: 'Dunkles Walnussholz mit Moosgrün, ruhig am Abend.', mode: 'dark', look: 'wood',
    primary: '#8fb36b', secondary: '#c98a4b', surface: '#231a13', sidebar: '#1b140e', canvas: '#16110c', muted: '#ae9e87',
  },
  {
    id: 'eiche', name: 'Eiche', description: 'Goldene Eiche mit Moosgrün, warm und hell am Tag.', mode: 'light', look: 'wood',
    primary: '#8fb36b', secondary: '#c98a4b', surface: '#f2e2c7', sidebar: '#e0c095', canvas: '#e9d0ad', muted: '#432b1a',
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk', description: 'Nachtblau mit Neon-Türkis und Pink, Raster und Leuchtlinien statt Holz.', mode: 'dark', look: 'cyber',
    primary: '#22d3ee', secondary: '#f472b6', surface: '#121530', sidebar: '#0d1026', canvas: '#090b1d', muted: '#9aa6c8',
  },
];

const presetOf = (id: string) => THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
const themeOf = (p: ThemePreset): DashboardTheme => ({ preset: p.id, primary: p.primary, secondary: p.secondary, mode: p.mode });

export const DEFAULT_THEME: DashboardTheme = themeOf(THEME_PRESETS[0]);

/** The look (wood, cyber …) of a stored theme. */
export const themeLook = (theme: DashboardTheme): ThemeLook => presetOf(theme.preset).look;

/**
 * Normalises stored/untrusted input to one of the themes. Older values (colour presets, custom colours) become the
 * wood theme of their mode: Eiche for light, Walnuss for dark.
 */
export function normalizeTheme(raw: unknown): DashboardTheme {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_THEME };
  const value = raw as Record<string, unknown>;
  const preset = THEME_PRESETS.find((p) => p.id === value.preset);
  if (preset) return themeOf(preset);
  return themeOf(presetOf(value.mode === 'light' ? 'eiche' : 'walnuss'));
}

// ---------- Colour math ----------

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
}
/** Mix `a` toward `b` by `t` (0 = a, 1 = b). */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
export function rgba(color: string, alpha: number): string {
  const [r, g, b] = rgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------- Derived tokens ----------

/** Darkens `color` (toward warm black) until it reaches `ratio` contrast on `bg`. */
function darkenUntil(color: string, bg: string, ratio: number): string {
  for (let t = 0; t <= 1; t += 0.04) {
    const next = mix(color, '#1a120c', t);
    if (contrast(next, bg) >= ratio) return next;
  }
  return '#1a120c';
}

/** Everything the dashboard needs, as CSS custom properties. */
export function themeVariables(theme: DashboardTheme): Record<string, string> {
  const look = presetOf(theme.preset);
  const light = theme.mode === 'light';
  // On the light surfaces the theme colours are darkened just enough to stay readable (UI parts 3:1, text 4.8:1).
  const primary = light ? darkenUntil(theme.primary, look.surface, 3) : theme.primary;
  const secondary = light ? darkenUntil(theme.secondary, look.surface, 2.2) : theme.secondary;
  const { surface, canvas } = look;
  const ink = contrast(primary, '#ffffff') >= 4.5 ? '#ffffff' : mix(primary, '#000000', 0.86);
  const strong = mix(primary, '#000000', 0.18);
  const tint = light ? darkenUntil(theme.primary, look.sidebar, 4.8) : mix(primary, '#ffffff', 0.45);
  const values: Record<string, string> = {
    '--accent': primary,
    '--accent-strong': strong,
    '--accent-hover': mix(primary, '#ffffff', light ? 0.12 : 0.18),
    '--accent-ink': ink,
    '--accent-soft': rgba(primary, light ? 0.1 : 0.12),
    '--accent-line': rgba(primary, light ? 0.32 : 0.28),
    '--accent-glow': rgba(primary, light ? 0.4 : 0.6),
    '--accent-text': tint,
    '--accent-text-muted': mix(tint, look.muted, 0.45),
    '--accent-2': secondary,
    '--ring': `0 0 0 3px ${rgba(primary, 0.22)}`,
    '--brand-gradient': `linear-gradient(135deg, ${mix(primary, canvas, light ? 0.8 : 0.74)} 0%, ${mix(primary, canvas, light ? 0.9 : 0.86)} 45%, ${surface} 100%)`,
    '--hero-glow': `radial-gradient(120% 140% at 100% 0%, ${rgba(strong, light ? 0.16 : 0.32)}, transparent 55%), radial-gradient(90% 120% at 0% 100%, ${rgba(secondary, light ? 0.08 : 0.1)}, transparent 60%)`,
    '--chart-primary': chartPrimary(theme.primary, theme.mode),
  };
  // Tailwind tokens (tailwind.css) mirror the same values.
  values['--color-accent'] = primary;
  values['--color-accent-strong'] = strong;
  values['--color-accent-ink'] = ink;
  values['--color-accent-2'] = secondary;
  values['--color-accent-text'] = tint;
  return values;
}

// ---------- Chart colours (OKLCH, so "same lightness" means the same perceived lightness) ----------

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** [L, C, h°] in OKLCH. */
export function oklch(color: string): [number, number, number] {
  const [r, g, b] = rgb(color).map((c) => toLinear(c / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

function oklchToRgb(L: number, C: number, h: number): Rgb | null {
  const rad = (h * Math.PI) / 180;
  const A = C * Math.cos(rad);
  const B = C * Math.sin(rad);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  if (lin.some((c) => c < -0.0005 || c > 1.0005)) return null;
  return lin.map((c) => fromLinear(Math.min(1, Math.max(0, c))) * 255) as Rgb;
}

/** OKLCH → hex; lowers the chroma until the colour fits sRGB. */
export function fromOklch(L: number, C: number, h: number): string {
  for (let chroma = C; chroma >= 0; chroma -= 0.005) {
    const value = oklchToRgb(L, chroma, h);
    if (value) return hex(value);
  }
  return hex(oklchToRgb(L, 0, h) ?? [0, 0, 0]);
}

/** Chart band on the dark surface: same perceived lightness, enough chroma to read as a colour. */
const CHART_L: [number, number] = [0.55, 0.64];
const CHART_MIN_C = 0.11;

/** Single-series charts and sparklines follow the primary colour, moved into the chart lightness band. */
export function chartPrimary(color: string, mode: ThemeMode = 'dark'): string {
  const [L, C, h] = oklch(color);
  return onSurface(fromOklch(Math.min(CHART_L[1], Math.max(CHART_L[0], L)), Math.max(CHART_MIN_C, C), h), mode);
}
/** The light card surface chart marks are darkened against (Eiche). */
const LIGHT_SURFACE = '#f2e2c7';

/**
 * On the light cards chart marks are darkened to 3:1 (WCAG 1.4.11); the band is set for the dark surface. Only the
 * OKLCH lightness goes down, so hue and chroma (and with them the gaps between series) stay.
 */
function onSurface(color: string, mode: ThemeMode): string {
  if (mode !== 'light') return color;
  const [L, C, h] = oklch(color);
  for (let step = L; step > 0.2; step -= 0.01) {
    const next = fromOklch(step, C, h);
    if (contrast(next, LIGHT_SURFACE) >= 3) return next;
  }
  return fromOklch(0.2, C, h);
}

/** Smallest angle between two hues in degrees. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
/** Hue (OKLCH). */
export const chartHue = (color: string) => oklch(color)[2];

// Colour-vision simulation (Machado et al. 2009, full severity) on linear RGB.
type Matrix = readonly [readonly number[], readonly number[], readonly number[]];
const PROTAN: Matrix = [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]];
const DEUTAN: Matrix = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]];
function simulate(color: string, m: Matrix): string {
  const lin = rgb(color).map((c) => toLinear(c / 255));
  const out = m.map((row) => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]);
  return hex(out.map((c) => fromLinear(Math.min(1, Math.max(0, c))) * 255) as Rgb);
}
/** OKLab ΔE ×100. */
function deltaE(a: string, b: string): number {
  const [L1, C1, h1] = oklch(a);
  const [L2, C2, h2] = oklch(b);
  const p1 = [L1, C1 * Math.cos((h1 * Math.PI) / 180), C1 * Math.sin((h1 * Math.PI) / 180)];
  const p2 = [L2, C2 * Math.cos((h2 * Math.PI) / 180), C2 * Math.sin((h2 * Math.PI) / 180)];
  return Math.hypot(p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]) * 100;
}
/** ΔE between two colours for normal vision and the two red-green deficiencies. */
export function distances(a: string, b: string): { normal: number; protan: number; deutan: number } {
  return { normal: deltaE(a, b), protan: deltaE(simulate(a, PROTAN), simulate(b, PROTAN)), deutan: deltaE(simulate(a, DEUTAN), simulate(b, DEUTAN)) };
}
/** ≥ 1 when two series are easy to tell apart: normal vision ΔE ≥ 15 and protan/deutan ΔE ≥ 8 (the validator's targets). */
export function separation(a: string, b: string): number {
  const d = distances(a, b);
  return Math.min(d.normal / 15, d.protan / 8, d.deutan / 8);
}

/** Calm base colours for further series, preferred in this order. */
const EXTRA_SERIES = ['#bb8a2c', '#cf5f7c', '#2f9fbe', '#8676f5', '#3fa66b', '#c26bd6'] as const;
/** Fallback pool: every 10° at three lightness steps inside the chart band, only colours saturated enough to read as colour. */
const HUE_POOL = Array.from({ length: 36 }, (_, i) => i * 10)
  .flatMap((h) => [0.56, 0.6, 0.64].map((L) => fromOklch(L, 0.17, h)))
  .filter((color) => oklch(color)[1] >= CHART_MIN_C);

/** The best next colour: the first calm base colour that separates from all chosen ones, else the most separated pool colour. */
function nextSeries(chosen: string[]): string {
  const score = (color: string) => Math.min(...chosen.map((other) => separation(color, other)));
  const calm = EXTRA_SERIES.map((color) => chartPrimary(color)).find((color) => oklch(color)[1] >= CHART_MIN_C && score(color) >= 1);
  if (calm) return calm;
  return HUE_POOL.reduce((best, color) => (score(color) > score(best) ? color : best));
}

/**
 * Categorical palette for multi-series charts in fixed order: primary, secondary (replaced when it is too close to
 * the primary — also for colour-blind viewers), then two calm base colours that stand clear of both. All four sit in
 * the same perceived lightness band so none fades on the dark surface.
 */
export function chartPalette(theme: DashboardTheme): string[] {
  const palette = [chartPrimary(theme.primary)];
  const secondary = chartPrimary(theme.secondary);
  palette.push(separation(palette[0], secondary) >= 1 ? secondary : nextSeries(palette));
  while (palette.length < 4) palette.push(nextSeries(palette));
  if (theme.mode !== 'light') return palette;
  // All series step down by the same lightness, so the lighter/darker differences between them stay.
  const drop = Math.max(...palette.map((color) => oklch(color)[0] - oklch(onSurface(color, 'light'))[0]));
  return palette.map((color) => { const [L, C, h] = oklch(color); return fromOklch(L - drop, C, h); });
}

/** Five-step sequential ramp (less → more) in the primary hue for heatmaps (monotone OKLCH lightness). */
export function heatRamp(primary: string): string[] {
  const [, C, h] = oklch(primary);
  const chroma = Math.max(0.09, Math.min(0.16, C));
  return [0.46, 0.56, 0.66, 0.76, 0.86].map((L) => fromOklch(L, chroma, h));
}

// ---------- Message colours (Nexo cards in Discord) ----------

/** What a card's colour means; every scheme has one colour per role. */
export const MESSAGE_ROLES = ['nexo', 'amber', 'gold', 'success', 'info', 'warn', 'danger', 'calm', 'pink'] as const;
export type MessageRole = typeof MESSAGE_ROLES[number];
export type MessagePalette = Record<MessageRole, string>;

/** Walnuss and Eiche: the bot's hand-picked palette (config/bot.ts embeds.colors), the look everyone gets by default. */
export const DEFAULT_MESSAGE_PALETTE: MessagePalette = {
  nexo: '#8fb36b', amber: '#e8a33d', gold: '#f5c451', success: '#4ade80', info: '#7da0c4',
  warn: '#f59e0b', danger: '#ef4444', calm: '#94a3b8', pink: '#f472b6',
};

/** Hue (OKLCH) of each status role: green, red, orange … stay recognisable in every scheme. */
const ROLE_HUES: Record<Exclude<MessageRole, 'nexo' | 'amber' | 'calm'>, number> = {
  gold: 88, success: 150, info: 245, warn: 62, danger: 25, pink: 350,
};

/**
 * The colours of Nexo's answers for a member's scheme: brand roles are the scheme's own colours, status roles keep
 * their hue but take the scheme's lightness and saturation (pastel schemes get pastel states, vivid ones vivid).
 */
export function messagePalette(theme: DashboardTheme): MessagePalette {
  // The wood themes speak with the bot's own palette; other themes tint the cards in their colours.
  if (presetOf(theme.preset).look === 'wood') return { ...DEFAULT_MESSAGE_PALETTE };
  const [L, C] = oklch(theme.primary);
  const lightness = Math.min(0.8, Math.max(0.66, L));
  const chroma = Math.min(0.17, Math.max(0.07, C));
  const status = Object.fromEntries(Object.entries(ROLE_HUES).map(([role, hue]) => [role, fromOklch(lightness, chroma, hue)]));
  return {
    nexo: theme.primary, amber: theme.secondary, calm: mix(theme.primary, '#94a3b8', 0.75),
    ...status,
  } as MessagePalette;
}
