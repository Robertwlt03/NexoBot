// Personal dashboard colours (per user, stored with the member profile). The user picks a primary and a secondary
// colour (or a preset); every other tone the design system needs is derived here so contrast and the calm premium
// look survive any choice. Import-free: shared by the API (validation) and the dashboard (applying the theme).

export interface DashboardTheme {
  /** Preset id, or 'custom' for freely chosen colours. */
  preset: string;
  primary: string;
  secondary: string;
}

export interface ThemePreset { id: string; name: string; primary: string; secondary: string }

/** Curated pairs that all work on the dark surfaces. The first one is the Nexo default. */
export const THEME_PRESETS: readonly ThemePreset[] = [
  { id: 'nexo', name: 'Nexo', primary: '#a99bff', secondary: '#67e8f9' },
  { id: 'ozean', name: 'Ozean', primary: '#60a5fa', secondary: '#22d3ee' },
  { id: 'smaragd', name: 'Smaragd', primary: '#34d399', secondary: '#5eead4' },
  { id: 'mint', name: 'Mint', primary: '#6ee7b7', secondary: '#93c5fd' },
  { id: 'bernstein', name: 'Bernstein', primary: '#fbbf24', secondary: '#fb923c' },
  { id: 'koralle', name: 'Koralle', primary: '#fb7185', secondary: '#fdba74' },
  { id: 'rose', name: 'Rosé', primary: '#f9a8d4', secondary: '#c4b5fd' },
  { id: 'sonnenuntergang', name: 'Sonnenuntergang', primary: '#f472b6', secondary: '#fbbf24' },
  { id: 'blurple', name: 'Discord', primary: '#8b95f8', secondary: '#c4b5fd' },
  { id: 'graphit', name: 'Graphit', primary: '#e4e4e7', secondary: '#a1a1aa' },
];

export const DEFAULT_THEME: DashboardTheme = { preset: 'nexo', primary: THEME_PRESETS[0].primary, secondary: THEME_PRESETS[0].secondary };

const HEX = /^#[0-9a-f]{6}$/i;
export const isHexColor = (value: unknown): value is string => typeof value === 'string' && HEX.test(value);

/** Normalises stored/untrusted input; unknown presets with valid colours become 'custom'. */
export function normalizeTheme(raw: unknown): DashboardTheme {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_THEME };
  const value = raw as Record<string, unknown>;
  const preset = THEME_PRESETS.find((p) => p.id === value.preset);
  if (preset && value.preset !== 'custom') return { preset: preset.id, primary: preset.primary, secondary: preset.secondary };
  if (isHexColor(value.primary) && isHexColor(value.secondary)) {
    return { preset: 'custom', primary: value.primary.toLowerCase(), secondary: value.secondary.toLowerCase() };
  }
  return { ...DEFAULT_THEME };
}

// ---------- Colour math ----------

type Rgb = [number, number, number];
const SURFACE = '#15151b';
const CANVAS = '#0b0b0f';

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

function hsl(color: string): [number, number, number] {
  const [r, g, b] = rgb(color).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return hex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

// ---------- Derived tokens ----------

/** Everything the dashboard needs, as CSS custom properties. */
export function themeVariables(theme: DashboardTheme): Record<string, string> {
  const { primary, secondary } = theme;
  const ink = contrast(primary, '#ffffff') >= 4.5 ? '#ffffff' : mix(primary, '#000000', 0.86);
  const strong = mix(primary, '#000000', 0.18);
  const tint = mix(primary, '#ffffff', 0.45);
  const values: Record<string, string> = {
    '--accent': primary,
    '--accent-strong': strong,
    '--accent-hover': mix(primary, '#ffffff', 0.18),
    '--accent-ink': ink,
    '--accent-soft': rgba(primary, 0.12),
    '--accent-line': rgba(primary, 0.28),
    '--accent-glow': rgba(primary, 0.6),
    '--accent-text': tint,
    '--accent-text-muted': mix(primary, '#9a9aa6', 0.45),
    '--accent-2': secondary,
    '--ring': `0 0 0 3px ${rgba(primary, 0.22)}`,
    '--brand-gradient': `linear-gradient(135deg, ${mix(primary, CANVAS, 0.74)} 0%, ${mix(primary, CANVAS, 0.86)} 45%, ${SURFACE} 100%)`,
    '--hero-glow': `radial-gradient(120% 140% at 100% 0%, ${rgba(strong, 0.32)}, transparent 55%), radial-gradient(90% 120% at 0% 100%, ${rgba(secondary, 0.1)}, transparent 60%)`,
    '--chart-primary': chartPrimary(primary),
  };
  // Tailwind tokens (tailwind.css) mirror the same values.
  values['--color-accent'] = primary;
  values['--color-accent-strong'] = strong;
  values['--color-accent-ink'] = ink;
  values['--color-accent-2'] = secondary;
  values['--color-accent-text'] = tint;
  return values;
}

/** Single-series charts and sparklines follow the primary colour, moved into a lightness band that reads on the surface. */
export function chartPrimary(primary: string): string {
  const [h, s, l] = hsl(primary);
  return fromHsl(h, Math.max(s, 0.35), Math.min(0.66, Math.max(0.52, l)));
}

/** Five-step sequential ramp (less → more) in the primary hue for heatmaps. */
export function heatRamp(primary: string): string[] {
  const [h, s] = hsl(primary);
  const sat = Math.max(0.4, Math.min(0.85, s));
  return [0.34, 0.45, 0.56, 0.67, 0.79].map((l) => fromHsl(h, sat, l));
}

/** Contrast notes for the editor (German). Empty when everything reads well. */
export function themeWarnings(theme: DashboardTheme): string[] {
  const notes: string[] = [];
  if (contrast(theme.primary, SURFACE) < 3) notes.push('Die Primärfarbe ist auf dunklem Grund schwer zu erkennen – nimm einen helleren Ton.');
  const vars = themeVariables(theme);
  if (contrast(theme.primary, vars['--accent-ink']) < 4.5) notes.push('Text auf Buttons in der Primärfarbe ist schwer lesbar – nimm einen helleren oder dunkleren Ton.');
  if (contrast(theme.secondary, SURFACE) < 2) notes.push('Die Sekundärfarbe verschwindet fast im Hintergrund.');
  return notes;
}
