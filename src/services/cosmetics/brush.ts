// Paint brushed onto wood, the same recipe as the test bot's banner and avatar: the colour takes the brightness of
// the wood under it (so the grain shows through), bristle streaks run along the stroke, and where the brush ran dry
// the wood stays bare. Works on raw RGBA pixels, so it needs no image library beyond the canvas.

/** Noise in [-1, 1] smoothed along its length (three box blurs ≈ a Gaussian of `sigma`), wrapping around. */
function smooth1d(rng: () => number, n: number, sigma: number): Float32Array {
  let v = new Float32Array(n);
  for (let i = 0; i < n; i += 1) v[i] = Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
  const r = Math.max(1, Math.round(sigma * 0.87));
  for (let pass = 0; pass < 3; pass += 1) {
    const out = new Float32Array(n);
    let sum = 0;
    for (let j = -r; j <= r; j += 1) sum += v[(j + n) % n];
    for (let i = 0; i < n; i += 1) {
      out[i] = sum / (2 * r + 1);
      sum += v[(i + r + 1) % n] - v[(i - r + n) % n];
    }
    v = out;
  }
  let max = 1e-6;
  for (const x of v) max = Math.max(max, Math.abs(x));
  return v.map((x) => x / max);
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Bristle texture in [0, 1]: one smoothed noise line per row (or column), softened across the lines. */
function strokes(rng: () => number, lines: number, length: number, scale: number): Float32Array[] {
  const raw = Array.from({ length: lines }, () => smooth1d(rng, length, (20 + rng() * 140) * scale).map((x) => 0.5 + 0.5 * x));
  return raw.map((line, i) => line.map((x, k) => (x * 2 + (raw[i - 1]?.[k] ?? x) + (raw[i + 1]?.[k] ?? x)) / 4));
}

const hexRgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);

/** Mix `color` into the pixels by `alpha` (per pixel), shaded by the wood's brightness and the streak. */
function blend(data: Uint8ClampedArray, i: number, color: number[], alpha: number, streak: number) {
  if (alpha <= 0) return;
  const lum = (0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]) / 255;
  const shade = (0.72 + 0.6 * lum) * (0.88 + 0.2 * streak);
  for (let c = 0; c < 3; c += 1) data[i + c] = data[i + c] * (1 - alpha) + clamp01(color[c] * shade) * 255 * alpha;
}

export interface Brush {
  /** A frame along the edges; `crop` adds to the top and bottom band (what the viewer cuts off there). */
  frame(data: Uint8ClampedArray, color: string, crop?: number): void;
  /** Paint through a mask (RGBA, its alpha says where): in `color`, or without one in the mask's own colours. */
  through(data: Uint8ClampedArray, mask: Uint8ClampedArray, color?: string): void;
}

/** A brush for a W×H image; `scale` = W / 1360, the size the recipe was tuned at. */
export function brush(W: number, H: number, rng: () => number, scale = W / 1360): Brush {
  const rows = strokes(rng, H, W, scale);
  const cols = strokes(rng, W, H, scale);
  return {
    frame(data, hex, crop = 0) {
      const color = hexRgb(hex);
      const band = (H - 2 * crop) * 0.055;
      const ragged = (n: number) => {
        const a = smooth1d(rng, n, 40 * scale);
        const b = smooth1d(rng, n, 6 * scale);
        return a.map((x, i) => band * (1 + 0.3 * x + 0.15 * b[i]));
      };
      const top = ragged(W);
      const side = ragged(H);
      const soft = 4 * scale;
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const dTop = y - crop;
          const dBottom = H - crop - y;
          const dLeft = x;
          const dRight = W - x;
          const mask = Math.max(
            clamp01((top[x] - dTop) / soft), clamp01((top[W - 1 - x] - dBottom) / soft),
            clamp01((side[y] - dLeft) / soft), clamp01((side[H - 1 - y] - dRight) / soft),
          );
          if (mask <= 0) continue;
          // Strokes run along the nearer edge.
          const streak = Math.min(dTop, dBottom) < Math.min(dLeft, dRight) ? rows[y][x] : cols[x][y];
          const dry = clamp01((streak - 0.32) / 0.2);
          blend(data, (y * W + x) * 4, color, mask * dry * (0.6 + 0.35 * streak), streak);
        }
      }
    },
    through(data, mask, hex) {
      const fixed = hex ? hexRgb(hex) : null;
      // Soft noise for ragged letter edges: random per pixel, averaged over its 3×3 neighbours.
      const noise = Float32Array.from({ length: W * H }, () => rng());
      const at = (x: number, y: number) => noise[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const i = y * W + x;
          if (!mask[i * 4 + 3]) continue;
          let jitter = 0;
          for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) jitter += at(x + dx, y + dy) / 9;
          // Ragged letter edges, then dry streaks along the rows.
          const m = clamp01((mask[i * 4 + 3] / 255 - 0.5) * 2.2 + 0.5 + (jitter - 0.5) * 0.9);
          const streak = rows[y][x];
          const color = fixed ?? [mask[i * 4] / 255, mask[i * 4 + 1] / 255, mask[i * 4 + 2] / 255];
          blend(data, i * 4, color, m * clamp01((streak - 0.04) / 0.2) * (0.8 + 0.2 * streak), streak);
        }
      }
    },
  };
}
