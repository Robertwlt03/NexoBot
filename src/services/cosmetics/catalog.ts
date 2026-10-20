// Cosmetics catalog: the built-in seed (inserted once per id on start, so owner edits always win) and the
// shop_items storage with a short in-memory cache for the card renderer.

import {
  BACKGROUND_SCENES, BADGE_GLYPHS, COSMETIC_SLOTS, RARITIES,
  type BackgroundScene, type BadgeGlyph, type CosmeticItem, type CosmeticSlot, type ItemAvailability, type Rarity, type SlotData,
} from '../../shared/cosmetics.js';
import { HttpError, badRequest, body, bool, hexColor, int, str } from '../../web/http.js';
import { T, cosmeticsPool, requirePool } from './db.js';

interface Extra { availability?: ItemAvailability; eventId?: string; achievementId?: string }

function item<S extends CosmeticSlot>(slot: S, id: string, rarity: Rarity, price: number, name: string, description: string, data: SlotData[S], extra: Extra = {}): CosmeticItem {
  return {
    id, slot, rarity, price, name, description, data, active: true,
    availability: extra.availability ?? 'shop', eventId: extra.eventId ?? null, achievementId: extra.achievementId ?? null,
  } as CosmeticItem;
}

const BM: Extra = { availability: 'blackmarket' };
const RANKING: Extra = { availability: 'ranking' };
const ev = (eventId: string): Extra => ({ availability: 'event', eventId });

const bg = (kind: SlotData['background']['kind'], colors: string[], angle = 135, pattern: SlotData['background']['pattern'] = 'none') => ({ kind, colors, angle, pattern });
const badge = (glyph: BadgeGlyph, color: string) => ({ glyph, color });
const scene = (name: BackgroundScene, colors: string[]) => ({ kind: 'scene' as const, colors, angle: 0, pattern: 'none' as const, scene: name });

/** Achievement badges (ids `ach-<achievement id>`); the achievements themselves live in achievements.ts. */
export const ACHIEVEMENT_BADGES: { achievementId: string; name: string; description: string; rarity: Rarity; glyph: BadgeGlyph; color: string }[] = [
  { achievementId: 'first_purchase', name: 'Erster Einkauf', description: 'Dein erstes Item aus dem Berni-Shop.', rarity: 'common', glyph: 'gift', color: '#7DD3FC' },
  { achievementId: 'level_10', name: 'Aufsteiger', description: 'Level 10 auf einem Server erreicht.', rarity: 'common', glyph: 'star', color: '#CBD5E1' },
  { achievementId: 'level_25', name: 'Stammgast', description: 'Level 25 auf einem Server erreicht.', rarity: 'rare', glyph: 'star', color: '#38BDF8' },
  { achievementId: 'level_50', name: 'Lebende Legende', description: 'Level 50 auf einem Server erreicht.', rarity: 'legendary', glyph: 'star', color: '#F5C451' },
  { achievementId: 'streak_7', name: 'Treue Woche', description: '7 Tage in Folge den Tagesbonus abgeholt.', rarity: 'rare', glyph: 'flame', color: '#FB923C' },
  { achievementId: 'streak_30', name: 'Monat der Treue', description: '30 Tage in Folge den Tagesbonus abgeholt.', rarity: 'epic', glyph: 'flame', color: '#F43F5E' },
  { achievementId: 'wins_100', name: 'Spielkind', description: '100 Minispiel-Erfolge gesammelt.', rarity: 'rare', glyph: 'controller', color: '#818CF8' },
  { achievementId: 'wins_1000', name: 'Spielemeister', description: '1.000 Minispiel-Erfolge gesammelt.', rarity: 'legendary', glyph: 'controller', color: '#F5C451' },
  { achievementId: 'first_gift', name: 'Großes Herz', description: 'Dein erstes Item verschenkt.', rarity: 'rare', glyph: 'heart', color: '#FDA4AF' },
  { achievementId: 'black_market', name: 'Schattenhändler', description: 'Etwas auf dem Schwarzmarkt gekauft.', rarity: 'epic', glyph: 'moon', color: '#A78BFA' },
  { achievementId: 'monthly_top3', name: 'Podiumsplatz', description: 'In einem Monatsranking unter den Top 3 gelandet.', rarity: 'epic', glyph: 'trophy', color: '#E2E8F0' },
  { achievementId: 'collector_10', name: 'Sammler', description: '10 Cosmetics in deiner Sammlung.', rarity: 'rare', glyph: 'diamond', color: '#22D3EE' },
  { achievementId: 'lifetime_10000', name: 'Bernsteinschatz', description: 'Insgesamt 10.000 Bernis verdient.', rarity: 'legendary', glyph: 'diamond', color: '#F5C451' },
];

export const RANKING_ITEMS = { winnerBadge: 'rank-badge-champion', winnerTitle: 'rank-title-champion', podiumBadge: 'rank-badge-podium' } as const;

export const SEED_ITEMS: CosmeticItem[] = [
  // ---------- Hintergründe ----------
  item('background', 'bg-midnight', 'common', 300, 'Mitternacht', 'Ruhiges, tiefes Nachtblau.', bg('solid', ['#0B1020'], 0)),
  item('background', 'bg-graphite', 'common', 350, 'Graphit', 'Dezenter Verlauf in Schiefergrau.', bg('gradient', ['#1E293B', '#0F172A'], 160)),
  item('background', 'bg-quiet-dots', 'common', 450, 'Stille Punkte', 'Feines Punktraster auf Nachtblau.', bg('pattern', ['#0F172A', '#334155'], 0, 'dots')),
  item('background', 'bg-indigo-dusk', 'rare', 900, 'Indigo-Dämmerung', 'Satter Indigo-Verlauf.', bg('gradient', ['#1E1B4B', '#4338CA'], 135)),
  item('background', 'bg-deep-sea', 'rare', 1000, 'Tiefsee', 'Kühles Petrol aus der Tiefe.', bg('gradient', ['#082F49', '#0E7490'], 160)),
  item('background', 'bg-blueprint', 'rare', 1200, 'Blaupause', 'Technisches Raster für Planer.', bg('pattern', ['#0B1220', '#1D4ED8'], 0, 'grid')),
  item('background', 'bg-emerald-waves', 'rare', 1400, 'Smaragdwellen', 'Sanfte Wellen in Smaragdgrün.', bg('pattern', ['#022C22', '#10B981'], 0, 'waves')),
  item('background', 'bg-aurora', 'epic', 2400, 'Polarlicht', 'Grün-türkises Leuchten am Nachthimmel.', bg('aurora', ['#022C22', '#10B981', '#22D3EE'])),
  item('background', 'bg-violet-mesh', 'epic', 2800, 'Violetter Nebel', 'Weicher Farbnebel in Violett und Beere.', bg('mesh', ['#1E1B4B', '#7C3AED', '#DB2777'])),
  item('background', 'bg-circuit', 'epic', 3200, 'Schaltkreis', 'Leuchtende Leiterbahnen auf Schwarz.', bg('pattern', ['#0B1020', '#22D3EE'], 0, 'circuit')),
  item('background', 'bg-hex-gold', 'epic', 3500, 'Goldwabe', 'Goldene Waben auf dunklem Stein.', bg('pattern', ['#1C1917', '#F5C451'], 0, 'hex')),
  item('background', 'bg-golden-hour', 'legendary', 5500, 'Goldene Stunde', 'Warmes Licht kurz vor Sonnenuntergang.', bg('gradient', ['#451A03', '#B45309', '#F5C451'], 120)),
  item('background', 'bg-starfield', 'legendary', 8000, 'Sternenfeld', 'Ein klarer Himmel voller Sterne.', bg('pattern', ['#020617', '#E2E8F0'], 0, 'stars')),
  item('background', 'bg-nebula', 'legendary', 7500, 'Sternennebel', 'Kosmischer Nebel in Blau und Magenta.', bg('mesh', ['#0B1020', '#4C1D95', '#2563EB', '#DB2777'])),
  item('background', 'bg-void-crystal', 'mythic', 9500, 'Leerenkristall', 'Nur auf dem Schwarzmarkt: kristallines Leuchten aus dem Nichts.', bg('mesh', ['#020617', '#1E293B', '#A78BFA', '#22D3EE']), BM),
  item('background', 'bg-obsidian-flame', 'mythic', 8500, 'Obsidianflamme', 'Nur auf dem Schwarzmarkt: glühende Risse in schwarzem Glas.', bg('aurora', ['#0A0A0A', '#7F1D1D', '#F97316']), BM),
  item('background', 'bg-halloween-night', 'epic', 2600, 'Geisternacht', 'Halloween-Edition: Sterne über glimmendem Orange.', bg('pattern', ['#1C0A00', '#7C2D12'], 0, 'stars'), ev('halloween')),
  item('background', 'bg-winter-frost', 'epic', 2600, 'Raureif', 'Winter-Edition: eisiges Polarlicht.', bg('aurora', ['#0F172A', '#1E3A8A', '#BAE6FD']), ev('christmas')),
  item('background', 'bg-summer-sunset', 'rare', 1300, 'Sommerabend', 'Sommer-Edition: warmer Abendhimmel.', bg('gradient', ['#7C2D12', '#F97316', '#FDE68A'], 110), ev('summer-sale')),
  item('background', 'bg-black-edition', 'legendary', 6000, 'Black Edition', 'Black-Friday-Edition: Schwarz mit goldenen Linien.', bg('pattern', ['#09090B', '#F5C451'], 0, 'diagonal'), ev('black-friday')),
  item('background', 'bg-new-year', 'epic', 3000, 'Mitternachtsfeuerwerk', 'Neujahrs-Edition: Gold und Violett um Mitternacht.', bg('mesh', ['#0B1020', '#F5C451', '#A78BFA']), ev('new-year')),
  item('background', 'bg-valentine', 'epic', 2400, 'Rosenrot', 'Valentins-Edition: tiefes Rot, das in Rosé verläuft.', bg('mesh', ['#2A0610', '#E11D48', '#FDA4AF']), ev('valentine')),
  item('background', 'bg-carnival', 'epic', 2400, 'Narrenzeit', 'Faschings-Edition: Konfettifarben auf Mitternachtsblau.', bg('pattern', ['#1E1B4B', '#FACC15'], 0, 'dots'), ev('carnival')),
  item('background', 'bg-easter', 'epic', 2400, 'Frühlingswiese', 'Oster-Edition: frisches Grün mit Pastell.', bg('mesh', ['#0F2A17', '#4ADE80', '#F9A8D4']), ev('easter')),
  item('background', 'bg-golden-october', 'epic', 2600, 'Goldener Oktober', 'Herbst-Edition: Laub in Rost und Gold.', bg('gradient', ['#2A0E04', '#C2410C', '#FBBF24'], 120), ev('autumn')),

  // ---------- Akzentfarben ----------
  item('accent', 'acc-ice', 'common', 300, 'Eisblau', 'Klares, kühles Blau.', { color: '#38BDF8' }),
  item('accent', 'acc-mint', 'common', 300, 'Minze', 'Frisches Mintgrün.', { color: '#34D399' }),
  item('accent', 'acc-coral', 'common', 400, 'Koralle', 'Warmes Korallenrot.', { color: '#FB7185' }),
  item('accent', 'acc-violet', 'rare', 800, 'Violett', 'Sattes Violett.', { color: '#8B5CF6' }),
  item('accent', 'acc-amber', 'rare', 900, 'Bernstein', 'Warmes Bernstein.', { color: '#F59E0B' }),
  item('accent', 'acc-gold', 'epic', 2000, 'Echtgold', 'Edles, gedämpftes Gold.', { color: '#F5C451' }),
  item('accent', 'acc-platinum', 'legendary', 5000, 'Platin', 'Kühles, helles Platin.', { color: '#E5E7EB' }),
  item('accent', 'acc-void', 'mythic', 2500, 'Leerenviolett', 'Nur auf dem Schwarzmarkt: das Violett der Leere.', { color: '#A78BFA' }, BM),

  // ---------- Namensfarben ----------
  item('nameStyle', 'name-pearl', 'common', 400, 'Perlweiß', 'Klarer, heller Name.', { colors: ['#F8FAFC'], glow: false }),
  item('nameStyle', 'name-sky', 'rare', 900, 'Himmelsverlauf', 'Verlauf von Himmelblau zu Indigo.', { colors: ['#38BDF8', '#818CF8'], glow: false }),
  item('nameStyle', 'name-ember', 'rare', 1000, 'Glut', 'Verlauf von Orange zu Rosé.', { colors: ['#F97316', '#F43F5E'], glow: false }),
  item('nameStyle', 'name-aurora', 'epic', 2500, 'Aurora', 'Leuchtender Polarlicht-Verlauf.', { colors: ['#34D399', '#22D3EE', '#818CF8'], glow: true }),
  item('nameStyle', 'name-rose-gold', 'epic', 3000, 'Roségold', 'Zartes Rosé, das in Gold übergeht.', { colors: ['#FDA4AF', '#F5C451'], glow: true }),
  item('nameStyle', 'name-gold', 'legendary', 6000, 'Goldglanz', 'Glänzender Goldverlauf mit Schein.', { colors: ['#FDE68A', '#F59E0B'], glow: true }),
  item('nameStyle', 'name-prism', 'mythic', 7000, 'Prisma', 'Nur auf dem Schwarzmarkt: schillerndes Prisma.', { colors: ['#A78BFA', '#22D3EE', '#F0ABFC'], glow: true }, BM),
  item('nameStyle', 'name-frost', 'rare', 1200, 'Frostschimmer', 'Winter-Edition: eisig schimmernder Name.', { colors: ['#E0F2FE', '#7DD3FC'], glow: true }, ev('christmas')),
  item('nameStyle', 'name-valentine', 'rare', 1200, 'Herzklopfen', 'Valentins-Edition: Rosé mit warmem Schein.', { colors: ['#FDA4AF', '#E11D48'], glow: true }, ev('valentine')),
  item('nameStyle', 'name-autumn-glow', 'rare', 1200, 'Herbstglut', 'Herbst-Edition: Gold, das in Rost übergeht.', { colors: ['#FBBF24', '#EA580C'], glow: true }, ev('autumn')),

  // ---------- Avatar-Rahmen ----------
  item('frame', 'frame-silver', 'common', 350, 'Silberring', 'Schlichter Ring in Silber.', { style: 'solid', colors: ['#CBD5E1'], width: 4 }),
  item('frame', 'frame-slate-dashed', 'common', 400, 'Gestrichelt', 'Feine, gestrichelte Linie.', { style: 'dashed', colors: ['#94A3B8'], width: 3 }),
  item('frame', 'frame-sapphire', 'rare', 1000, 'Saphir', 'Verlauf in tiefem Saphirblau.', { style: 'gradient', colors: ['#1D4ED8', '#38BDF8'], width: 5 }),
  item('frame', 'frame-mint-double', 'rare', 1200, 'Doppelminze', 'Zwei Ringe in Mint und Tannengrün.', { style: 'double', colors: ['#6EE7B7', '#047857'], width: 5 }),
  item('frame', 'frame-neon-violet', 'epic', 2500, 'Neonviolett', 'Leuchtende Neonröhre in Violett.', { style: 'neon', colors: ['#A78BFA'], width: 5 }),
  item('frame', 'frame-gold-double', 'epic', 3200, 'Goldfassung', 'Doppelte Fassung in Gold und Bronze.', { style: 'double', colors: ['#F5C451', '#B45309'], width: 6 }),
  item('frame', 'frame-crown', 'legendary', 7000, 'Königskrone', 'Goldener Rahmen mit Krone.', { style: 'crown', colors: ['#F5C451', '#FDE68A'], width: 6 }),
  item('frame', 'frame-void-glow', 'mythic', 9000, 'Leerenschein', 'Nur auf dem Schwarzmarkt: pulsierender Schein in Türkis und Violett.', { style: 'glow', colors: ['#22D3EE', '#A78BFA'], width: 7 }, BM),
  item('frame', 'frame-pumpkin', 'epic', 2200, 'Kürbisglut', 'Halloween-Edition: glimmender Kürbisrahmen.', { style: 'gradient', colors: ['#F97316', '#7C2D12'], width: 5 }, ev('halloween')),
  item('frame', 'frame-frost', 'epic', 2400, 'Eiskristall', 'Winter-Edition: frostig leuchtender Rahmen.', { style: 'glow', colors: ['#BAE6FD', '#E0F2FE'], width: 5 }, ev('christmas')),
  item('frame', 'frame-black-gold', 'legendary', 5000, 'Black Gold', 'Black-Friday-Edition: goldene Neonlinie.', { style: 'neon', colors: ['#F5C451'], width: 6 }, ev('black-friday')),
  item('frame', 'frame-valentine', 'epic', 2200, 'Rosenranke', 'Valentins-Edition: glühender Rahmen in Rosé.', { style: 'glow', colors: ['#FB7185', '#FECDD3'], width: 5 }, ev('valentine')),
  item('frame', 'frame-carnival', 'epic', 2200, 'Narrenkappe', 'Faschings-Edition: bunter Doppelrahmen.', { style: 'double', colors: ['#A855F7', '#FACC15'], width: 5 }, ev('carnival')),

  // ---------- Abzeichen ----------
  item('badge', 'badge-star', 'common', 300, 'Stern', 'Ein goldener Stern.', badge('star', '#F5C451')),
  item('badge', 'badge-leaf', 'common', 300, 'Blatt', 'Ein frisches Blatt.', badge('leaf', '#34D399')),
  item('badge', 'badge-paw', 'common', 350, 'Pfote', 'Für Tierfreunde.', badge('paw', '#FDA4AF')),
  item('badge', 'badge-controller', 'rare', 800, 'Gamer', 'Für alle, die gern zocken.', badge('controller', '#818CF8')),
  item('badge', 'badge-music', 'rare', 800, 'Musik', 'Für Musikliebhaber.', badge('music', '#F472B6')),
  item('badge', 'badge-code', 'rare', 900, 'Entwickler', 'Für alle, die Code schreiben.', badge('code', '#22D3EE')),
  item('badge', 'badge-bolt', 'epic', 2000, 'Blitz', 'Schnell wie der Blitz.', badge('bolt', '#FACC15')),
  item('badge', 'badge-rocket', 'epic', 2200, 'Rakete', 'Immer auf dem Weg nach oben.', badge('rocket', '#F97316')),
  item('badge', 'badge-diamond', 'legendary', 5000, 'Diamant', 'Ein lupenreiner Diamant.', badge('diamond', '#A5F3FC')),
  item('badge', 'badge-crown', 'legendary', 6500, 'Krone', 'Für die Krone des Servers.', badge('crown', '#F5C451')),
  item('badge', 'badge-chrome-skull', 'mythic', 4000, 'Chromschädel', 'Nur auf dem Schwarzmarkt: ein Schädel aus Chrom.', badge('skull', '#E5E7EB'), BM),
  item('badge', 'badge-blood-moon', 'mythic', 3500, 'Blutmond', 'Nur auf dem Schwarzmarkt: ein roter Mond.', badge('moon', '#F43F5E'), BM),
  item('badge', 'badge-pumpkin', 'rare', 1000, 'Kürbis', 'Halloween-Edition.', badge('pumpkin', '#F97316'), ev('halloween')),
  item('badge', 'badge-ghost', 'rare', 900, 'Gespenst', 'Halloween-Edition.', badge('ghost', '#E2E8F0'), ev('halloween')),
  item('badge', 'badge-snowflake', 'rare', 1000, 'Schneeflocke', 'Winter-Edition.', badge('snowflake', '#BAE6FD'), ev('christmas')),
  item('badge', 'badge-gift', 'rare', 900, 'Geschenk', 'Weihnachts-Edition.', badge('gift', '#F43F5E'), ev('christmas')),
  item('badge', 'badge-sun', 'rare', 900, 'Sonne', 'Sommer-Edition.', badge('sun', '#FBBF24'), ev('summer-sale')),
  item('badge', 'badge-deal-bolt', 'epic', 2000, 'Deal-Blitz', 'Black-Friday-Edition.', badge('bolt', '#F5C451'), ev('black-friday')),
  item('badge', 'badge-ny-rocket', 'epic', 2200, 'Silvesterrakete', 'Neujahrs-Edition.', badge('rocket', '#FDE68A'), ev('new-year')),
  item('badge', 'badge-sweetheart', 'rare', 900, 'Herzblatt', 'Valentins-Edition.', badge('heart', '#FB7185'), ev('valentine')),
  item('badge', 'badge-carnival-mask', 'rare', 1000, 'Maskenball', 'Faschings-Edition.', badge('mask', '#C084FC'), ev('carnival')),
  item('badge', 'badge-easter-egg', 'rare', 900, 'Osterei', 'Oster-Edition.', badge('egg', '#86EFAC'), ev('easter')),
  item('badge', 'badge-autumn-leaf', 'rare', 900, 'Herbstblatt', 'Herbst-Edition.', badge('leaf', '#EA580C'), ev('autumn')),
  item('badge', RANKING_ITEMS.winnerBadge, 'legendary', 0, 'Monatssieger', 'Platz 1 in einem Monatsranking.', badge('trophy', '#F5C451'), RANKING),
  item('badge', RANKING_ITEMS.podiumBadge, 'epic', 0, 'Podium', 'Top 3 in einem Monatsranking.', badge('trophy', '#CBD5E1'), RANKING),
  ...ACHIEVEMENT_BADGES.map((entry) => item('badge', `ach-${entry.achievementId}`, entry.rarity, 0, entry.name, entry.description,
    badge(entry.glyph, entry.color), { availability: 'achievement', achievementId: entry.achievementId })),

  // ---------- Titel ----------
  item('title', 'title-night-owl', 'common', 300, 'Nachtschwärmer', 'Für alle, die nachts aktiv sind.', { text: 'Nachtschwärmer', color: '#CBD5E1' }),
  item('title', 'title-chatterbox', 'common', 350, 'Plaudertasche', 'Immer etwas zu erzählen.', { text: 'Plaudertasche', color: '#7DD3FC' }),
  item('title', 'title-strategist', 'rare', 900, 'Stratege', 'Denkt drei Züge voraus.', { text: 'Stratege', color: '#A78BFA' }),
  item('title', 'title-lucky', 'rare', 1000, 'Glückspilz', 'Das Glück ist mit dir.', { text: 'Glückspilz', color: '#34D399' }),
  item('title', 'title-collector', 'epic', 2500, 'Bernsteinsammler', 'Für echte Sammler.', { text: 'Bernsteinsammler', color: '#22D3EE' }),
  item('title', 'title-visionary', 'legendary', 6000, 'Visionär', 'Sieht, was andere nicht sehen.', { text: 'Visionär', color: '#F5C451' }),
  item('title', 'title-shadow-lord', 'mythic', 6000, 'Schattenfürst', 'Nur auf dem Schwarzmarkt.', { text: 'Schattenfürst', color: '#A78BFA' }, BM),
  item('title', 'title-oracle', 'mythic', 5000, 'Orakel', 'Nur auf dem Schwarzmarkt.', { text: 'Orakel', color: '#22D3EE' }, BM),
  item('title', 'title-ghost-hunter', 'epic', 2000, 'Geisterjäger', 'Halloween-Edition.', { text: 'Geisterjäger', color: '#F97316' }, ev('halloween')),
  item('title', 'title-bargain-hunter', 'rare', 800, 'Schnäppchenjäger', 'Black-Friday-Edition.', { text: 'Schnäppchenjäger', color: '#F5C451' }, ev('black-friday')),
  item('title', 'title-snow-angel', 'rare', 900, 'Schneeengel', 'Winter-Edition.', { text: 'Schneeengel', color: '#BAE6FD' }, ev('christmas')),
  item('title', 'title-heartbreaker', 'rare', 900, 'Herzensbrecher', 'Valentins-Edition.', { text: 'Herzensbrecher', color: '#FB7185' }, ev('valentine')),
  item('title', 'title-jeck', 'rare', 800, 'Jeck', 'Faschings-Edition.', { text: 'Jeck', color: '#FACC15' }, ev('carnival')),
  item('title', 'title-egg-hunter', 'rare', 800, 'Eiersucher', 'Oster-Edition.', { text: 'Eiersucher', color: '#86EFAC' }, ev('easter')),
  item('title', 'title-leaf-collector', 'rare', 800, 'Laubsammler', 'Herbst-Edition.', { text: 'Laubsammler', color: '#F59E0B' }, ev('autumn')),
  item('title', RANKING_ITEMS.winnerTitle, 'legendary', 0, 'Monatssieger', 'Platz 1 in einem Monatsranking.', { text: 'Monatssieger', color: '#F5C451' }, RANKING),

  // ---------- XP-Balken ----------
  item('xpBar', 'xp-sky', 'common', 300, 'Himmelblau', 'Schlichter Balken in Himmelblau.', { style: 'solid', colors: ['#38BDF8'] }),
  item('xpBar', 'xp-dusk', 'rare', 900, 'Abendrot', 'Verlauf von Indigo zu Violett.', { style: 'gradient', colors: ['#6366F1', '#A855F7'] }),
  item('xpBar', 'xp-mint-striped', 'rare', 1000, 'Mintstreifen', 'Gestreift in Smaragd und Mint.', { style: 'striped', colors: ['#10B981', '#6EE7B7'] }),
  item('xpBar', 'xp-ice-segments', 'epic', 2200, 'Eissegmente', 'Segmentierter Balken in Eisblau.', { style: 'segmented', colors: ['#22D3EE', '#A5F3FC'] }),
  item('xpBar', 'xp-gold-flow', 'legendary', 5500, 'Goldfluss', 'Leuchtender Goldbalken.', { style: 'glow', colors: ['#F59E0B', '#FDE68A'] }),
  item('xpBar', 'xp-void-stream', 'mythic', 5000, 'Leerenstrom', 'Nur auf dem Schwarzmarkt: schillernder Energiestrom.', { style: 'glow', colors: ['#A78BFA', '#22D3EE', '#F0ABFC'] }, BM),
  item('xpBar', 'xp-candy-cane', 'rare', 1000, 'Zuckerstange', 'Weihnachts-Edition.', { style: 'striped', colors: ['#F43F5E', '#F8FAFC'] }, ev('christmas')),
  item('xpBar', 'xp-easter-pastel', 'rare', 1000, 'Pastellstreifen', 'Oster-Edition.', { style: 'striped', colors: ['#F9A8D4', '#A7F3D0'] }, ev('easter')),

  // ---------- Schriften ----------
  item('font', 'font-unbounded', 'rare', 1200, 'Unbounded', 'Breite, moderne Displayschrift.', { font: 'unbounded' }),
  item('font', 'font-caveat', 'epic', 2000, 'Handschrift', 'Persönliche, handgeschriebene Schrift.', { font: 'caveat' }),

  // ---------- Effekte ----------
  item('effect', 'effect-hearts', 'common', 500, 'Herzchen', 'Kleine schwebende Herzen.', { effect: 'hearts' }),
  item('effect', 'effect-sparkles', 'rare', 1100, 'Funkeln', 'Dezentes Funkeln auf deiner Karte.', { effect: 'sparkles' }),
  item('effect', 'effect-scanlines', 'rare', 1300, 'Scanlines', 'Retro-Bildschirmlinien.', { effect: 'scanlines' }),
  item('effect', 'effect-stardust', 'epic', 3000, 'Sternenstaub', 'Feiner, glitzernder Sternenstaub.', { effect: 'stardust' }),
  item('effect', 'effect-aurora', 'legendary', 8000, 'Nordlicht', 'Wandernde Polarlicht-Schleier.', { effect: 'aurora' }),
  item('effect', 'effect-embers', 'mythic', 7500, 'Glutregen', 'Nur auf dem Schwarzmarkt: aufsteigende Glut.', { effect: 'embers' }, BM),
  item('effect', 'effect-snow', 'epic', 2800, 'Schneefall', 'Winter-Edition: leiser Schneefall.', { effect: 'snow' }, ev('christmas')),
  item('effect', 'effect-confetti', 'epic', 2500, 'Konfetti', 'Neujahrs-Edition: Konfetti zum Anstoßen.', { effect: 'confetti' }, ev('new-year')),
  item('effect', 'effect-carnival-confetti', 'epic', 2500, 'Kamelle', 'Faschings-Edition: Konfetti beim Umzug.', { effect: 'confetti' }, ev('carnival')),
  item('effect', 'effect-valentine-hearts', 'epic', 2600, 'Herzregen', 'Valentins-Edition: Herzen schweben über deine Karte.', { effect: 'hearts' }, ev('valentine')),

  // ---------- Level-up-Stile ----------
  item('levelup', 'lvl-minimal', 'common', 400, 'Minimal', 'Reduziert und klar.', { style: 'minimal', color: '#CBD5E1' }),
  item('levelup', 'lvl-retro', 'rare', 1000, 'Retro', 'Arcade-Feeling für jeden Aufstieg.', { style: 'retro', color: '#F472B6' }),
  item('levelup', 'lvl-neon', 'epic', 2500, 'Neon', 'Leuchtende Neon-Optik.', { style: 'neon', color: '#22D3EE' }),
  item('levelup', 'lvl-royal', 'legendary', 6500, 'Royal', 'Ein Aufstieg wie eine Krönung.', { style: 'royal', color: '#F5C451' }),
  item('levelup', 'lvl-void-crown', 'mythic', 6000, 'Leerenkrone', 'Nur auf dem Schwarzmarkt: royal in Violett.', { style: 'royal', color: '#A78BFA' }, BM),

  // ---------- Kartenlayouts ----------
  item('layout', 'layout-compact', 'rare', 900, 'Kompakt', 'Alles Wichtige auf kleinem Raum.', { layout: 'compact' }),
  item('layout', 'layout-centered', 'epic', 2000, 'Zentriert', 'Avatar und Name in der Mitte.', { layout: 'centered' }),
  item('layout', 'layout-split', 'legendary', 5000, 'Geteilt', 'Zweigeteiltes Layout mit großer Statistikfläche.', { layout: 'split' }),

  // ---------- Sticker ----------
  item('sticker', 'sticker-paw', 'common', 300, 'Pfotenabdruck', 'Ein kleiner Pfotenabdruck.', { glyph: 'paw', color: '#FDA4AF', corner: 'br' }),
  item('sticker', 'sticker-dice', 'common', 350, 'Würfel', 'Für Glücksspieler.', { glyph: 'dice', color: '#E2E8F0', corner: 'tr' }),
  item('sticker', 'sticker-goldfish', 'rare', 800, 'Goldfisch', 'Für erfolgreiche Angler.', { glyph: 'fish', color: '#F59E0B', corner: 'br' }),
  item('sticker', 'sticker-moon', 'rare', 900, 'Mondsichel', 'Eine ruhige Mondsichel.', { glyph: 'moon', color: '#C4B5FD', corner: 'tr' }),
  item('sticker', 'sticker-pickaxe', 'rare', 1000, 'Spitzhacke', 'Für fleißige Minenarbeiter.', { glyph: 'pickaxe', color: '#94A3B8', corner: 'bl' }),
  item('sticker', 'sticker-flame', 'epic', 2200, 'Flamme', 'Heiß begehrt.', { glyph: 'flame', color: '#F97316', corner: 'tr' }),
  item('sticker', 'sticker-crown', 'legendary', 5000, 'Kleine Krone', 'Eine goldene Krone für die Ecke.', { glyph: 'crown', color: '#F5C451', corner: 'tl' }),
  item('sticker', 'sticker-chrome-skull', 'mythic', 3000, 'Chromschädel-Sticker', 'Nur auf dem Schwarzmarkt.', { glyph: 'skull', color: '#E5E7EB', corner: 'br' }, BM),
  item('sticker', 'sticker-boo', 'rare', 900, 'Buh!', 'Halloween-Edition.', { glyph: 'ghost', color: '#E2E8F0', corner: 'tr' }, ev('halloween')),
  item('sticker', 'sticker-sunshine', 'rare', 800, 'Sonnenschein', 'Sommer-Edition.', { glyph: 'sun', color: '#FBBF24', corner: 'tr' }, ev('summer-sale')),
  item('sticker', 'sticker-easter-egg', 'rare', 800, 'Gefunden!', 'Oster-Edition.', { glyph: 'egg', color: '#F9A8D4', corner: 'br' }, ev('easter')),
  item('sticker', 'sticker-carnival-mask', 'rare', 800, 'Helau!', 'Faschings-Edition.', { glyph: 'mask', color: '#FACC15', corner: 'tr' }, ev('carnival')),

  // ---------- Wald-Kollektion (Walnuss, Moos, Bernstein) ----------
  item('background', 'bg-moss-cushion', 'common', 450, 'Moospolster', 'Weiches, dunkles Moosgrün.', bg('gradient', ['#1F2A16', '#3C5A2A'], 140)),
  item('background', 'bg-walnut-grain', 'rare', 1200, 'Walnussmaserung', 'Geschwungene Maserung in dunklem Walnuss.', bg('pattern', ['#24160D', '#7A4A2A'], 0, 'waves')),
  item('background', 'bg-forest-floor', 'rare', 1000, 'Waldboden', 'Moos, Laub und Erde im Abendlicht.', bg('mesh', ['#1A120B', '#3C5A2A', '#6B4426', '#1F2A16'])),
  item('background', 'bg-birch-grove', 'epic', 2200, 'Birkenhain', 'Helle Birkenstämme im Dämmerlicht.', bg('pattern', ['#26241F', '#E8E2D6'], 0, 'diagonal')),
  item('background', 'bg-fern-shade', 'epic', 2600, 'Farnschatten', 'Grünes Licht, das durch Farne fällt.', bg('aurora', ['#0E140B', '#4D7A35', '#A3C47A'])),
  item('background', 'bg-amber-glow', 'legendary', 6500, 'Bernsteinglut', 'Warmes Licht wie durch einen Bernstein.', bg('mesh', ['#2A1405', '#B5600F', '#F2A531', '#FFD889'])),
  item('accent', 'acc-moss', 'common', 350, 'Moosgrün', 'Ruhiges, natürliches Grün.', { color: '#8FB36B' }),
  item('accent', 'acc-fern', 'rare', 900, 'Farngrün', 'Kräftiges Grün junger Farne.', { color: '#5FA35A' }),
  item('accent', 'acc-walnut', 'rare', 950, 'Walnussbraun', 'Warmes Braun mit Bernsteinschimmer.', { color: '#C98A4B' }),
  item('nameStyle', 'name-forest-light', 'rare', 1100, 'Waldlicht', 'Verlauf von hellem Moos zu Farngrün.', { colors: ['#C7DCA7', '#5FA35A'], glow: false }),
  item('nameStyle', 'name-amber-shine', 'epic', 2800, 'Bernsteinschimmer', 'Leuchtender Verlauf in Honig und Bernstein.', { colors: ['#FFD889', '#F2A531', '#B5600F'], glow: true }),
  item('frame', 'frame-walnut-ring', 'rare', 1100, 'Walnussring', 'Breiter Ring aus dunklem Walnuss.', { style: 'solid', colors: ['#7A4A2A'], width: 6 }),
  item('frame', 'frame-ivy', 'epic', 2600, 'Efeuranke', 'Zwei Ringe in Moos und tiefem Efeugrün.', { style: 'double', colors: ['#8FB36B', '#3F6B2E'], width: 6 }),
  item('frame', 'frame-amber-setting', 'legendary', 6000, 'Bernsteinfassung', 'Leuchtende Fassung aus Bernstein.', { style: 'glow', colors: ['#F2A531', '#FFD889'], width: 6 }),
  item('badge', 'badge-acorn', 'common', 350, 'Eichel', 'Klein, aber oho.', badge('acorn', '#C98A4B')),
  item('badge', 'badge-fir', 'rare', 850, 'Tanne', 'Immer grün, bei jedem Wetter.', badge('tree', '#5FA35A')),
  item('badge', 'badge-toadstool', 'rare', 950, 'Fliegenpilz', 'Schön anzusehen, besser nicht essen.', badge('mushroom', '#E2574C')),
  item('title', 'title-woodworm', 'common', 400, 'Holzwurm', 'Immer irgendwo im Holz unterwegs.', { text: 'Holzwurm', color: '#C98A4B' }),
  item('title', 'title-forest-spirit', 'epic', 2400, 'Waldgeist', 'Kennt jeden Pfad im Wald.', { text: 'Waldgeist', color: '#A3C47A' }),
  item('xpBar', 'xp-moss-edge', 'rare', 1000, 'Mooskante', 'Gestreift in Efeu- und Moosgrün.', { style: 'striped', colors: ['#4D7A35', '#8FB36B'] }),
  item('xpBar', 'xp-resin-flow', 'epic', 2600, 'Harzfluss', 'Leuchtender Balken wie flüssiger Bernstein.', { style: 'glow', colors: ['#F2A531', '#FFD889'] }),
  item('effect', 'effect-falling-leaves', 'epic', 2800, 'Fallendes Laub', 'Blätter in Moos und Herbstgold schweben über deine Karte.', { effect: 'leaves' }),
  item('levelup', 'lvl-forest-clearing', 'epic', 2400, 'Waldlichtung', 'Ein Aufstieg im grünen Licht.', { style: 'classic', color: '#8FB36B' }),
  item('sticker', 'sticker-acorn', 'rare', 900, 'Eichel-Sticker', 'Eine Eichel für die Ecke.', { glyph: 'acorn', color: '#C98A4B', corner: 'br' }),
  item('sticker', 'sticker-toadstool', 'rare', 1000, 'Pilz-Sticker', 'Ein Fliegenpilz für die Ecke.', { glyph: 'mushroom', color: '#E2574C', corner: 'tr' }),

  // ---------- Spielwelten: Genre-Hommagen als eigene Motive (keine Marken, Figuren oder Namen echter Spiele) ----------
  item('background', 'bg-pixel-quest', 'epic', 2800, 'Pixelabenteuer', 'Retro-Jump-and-Run: Pixelsonne über gestuften Bergen.', scene('pixel', ['#3B2A6B', '#E86F5B', '#FFD166', '#2E7D4F'])),
  item('background', 'bg-neon-city', 'legendary', 6000, 'Neonstadt', 'Skyline bei Nacht mit Synthwave-Sonne und leuchtendem Raster.', scene('neon-city', ['#0B0820', '#FF3DCB', '#33E1FF', '#1A1235'])),
  item('background', 'bg-moon-ninja', 'legendary', 6500, 'Mondschein-Ninja', 'Vollmond, Bambus und Blütenblätter im Wind.', scene('moon-ninja', ['#0D1530', '#24314F', '#F4E7C5', '#F7A8C4'])),
  item('background', 'bg-dungeon-torches', 'epic', 2600, 'Kerkerfackeln', 'Steinmauer im Fackelschein – bereit für den nächsten Raid.', scene('dungeon', ['#1B1714', '#3A322C', '#FF9A3C', '#7A4A2A'])),
  item('background', 'bg-orbital', 'epic', 3200, 'Orbitalstation', 'Ein Ringplanet, Sternenstaub und ein kleiner Mond.', scene('orbital', ['#05060F', '#7C5CFF', '#F2A531', '#22D3EE'])),
  item('background', 'bg-pirate-cove', 'epic', 3000, 'Piratenbucht', 'Ein Schiff unter Segeln im Mondlicht.', scene('pirate-cove', ['#0B1A2E', '#123A5A', '#F4E7C5', '#0A0F18'])),
  item('frame', 'frame-sakura', 'rare', 1200, 'Kirschblütenring', 'Zarter Neonring in Blütenrosa.', { style: 'neon', colors: ['#F7A8C4'], width: 5 }),
  item('frame', 'frame-neon-pink', 'epic', 2400, 'Neonpink', 'Leuchtröhre in kräftigem Pink.', { style: 'neon', colors: ['#FF3DCB'], width: 5 }),
  item('frame', 'frame-torchlight', 'epic', 2300, 'Fackelschein', 'Warm flackernder Schein.', { style: 'glow', colors: ['#FF9A3C', '#FFD166'], width: 6 }),
  item('nameStyle', 'name-synthwave', 'epic', 2700, 'Synthwave', 'Verlauf von Pink zu Cyan mit Schein.', { colors: ['#FF3DCB', '#33E1FF'], glow: true }),
  item('title', 'title-shadow-runner', 'epic', 2200, 'Schattenläufer', 'Lautlos und schnell.', { text: 'Schattenläufer', color: '#F7A8C4' }),
  item('title', 'title-pixel-hero', 'rare', 900, 'Pixelheld', 'Acht Bit, volles Herz.', { text: 'Pixelheld', color: '#FFD166' }),
  item('title', 'title-bounty-hunter', 'epic', 2400, 'Kopfgeldjäger', 'Von Station zu Station unterwegs.', { text: 'Kopfgeldjäger', color: '#22D3EE' }),
  item('title', 'title-buccaneer', 'rare', 1000, 'Freibeuter', 'Segel gesetzt, Kurs auf Abenteuer.', { text: 'Freibeuter', color: '#F4E7C5' }),
  item('title', 'title-dungeon-master', 'epic', 2500, 'Dungeonmeister', 'Kennt jede Falle beim Namen.', { text: 'Dungeonmeister', color: '#FF9A3C' }),
  item('xpBar', 'xp-pixel', 'rare', 1000, 'Pixelbalken', 'Segmentiert wie eine alte Lebensanzeige.', { style: 'segmented', colors: ['#FFD166', '#E86F5B'] }),
  item('badge', 'badge-jolly-roger', 'rare', 1000, 'Totenkopfflagge', 'Für alle, die gern in See stechen.', badge('skull', '#F4E7C5')),
  item('badge', 'badge-guardian', 'rare', 900, 'Schildwache', 'Hält die Stellung.', badge('shield', '#CBD5E1')),
];

// ---------- Bundles ----------

export interface BundleDef { id: string; name: string; description: string; itemIds: string[] }

/** Matching sets from the regular shop, sold together (shop/bundles). Only shop items: events and the black market keep their own rules. */
export const BUNDLES: BundleDef[] = [
  { id: 'bundle-forest', name: 'Wald-Paket', description: 'Farne, Efeu und fallendes Laub – deine Karte wie eine Lichtung im Wald.',
    itemIds: ['bg-fern-shade', 'frame-ivy', 'name-forest-light', 'badge-fir', 'effect-falling-leaves', 'title-forest-spirit'] },
  { id: 'bundle-amber', name: 'Bernstein-Paket', description: 'Warmes Harzlicht von Hintergrund bis XP-Balken.',
    itemIds: ['bg-amber-glow', 'frame-amber-setting', 'name-amber-shine', 'xp-resin-flow', 'acc-walnut'] },
  { id: 'bundle-walnut', name: 'Walnuss-Paket', description: 'Dunkles Holz, Eicheln und ein bisschen Holzwurm.',
    itemIds: ['bg-walnut-grain', 'frame-walnut-ring', 'badge-acorn', 'sticker-acorn', 'title-woodworm', 'acc-moss'] },
  { id: 'bundle-gold', name: 'Gold-Paket', description: 'Für alle, die gekrönt werden wollen – inklusive royalem Level-up.',
    itemIds: ['bg-golden-hour', 'frame-crown', 'name-gold', 'title-visionary', 'xp-gold-flow', 'lvl-royal'] },
  { id: 'bundle-night-sky', name: 'Nachthimmel-Paket', description: 'Sterne, Mond und tiefes Blau.',
    itemIds: ['bg-starfield', 'effect-stardust', 'sticker-moon', 'name-sky', 'xp-dusk'] },
  { id: 'bundle-aurora', name: 'Polarlicht-Paket', description: 'Grüne Schleier am Himmel und auf deinem Namen.',
    itemIds: ['bg-aurora', 'name-aurora', 'effect-aurora', 'xp-mint-striped', 'frame-mint-double'] },
  { id: 'bundle-neon', name: 'Neon-Paket', description: 'Röhrenlicht, Scanlines und ein leuchtendes Level-up.',
    itemIds: ['bg-circuit', 'frame-neon-violet', 'effect-scanlines', 'xp-ice-segments', 'lvl-neon'] },
  { id: 'bundle-moon-ninja', name: 'Mondschein-Ninja-Paket', description: 'Vollmond, Bambus und ein Name wie ein Schatten.',
    itemIds: ['bg-moon-ninja', 'frame-sakura', 'title-shadow-runner', 'sticker-moon'] },
  { id: 'bundle-pixel-quest', name: 'Pixelabenteuer-Paket', description: 'Acht Bit von Hintergrund bis Level-up.',
    itemIds: ['bg-pixel-quest', 'title-pixel-hero', 'xp-pixel', 'lvl-retro', 'sticker-dice'] },
  { id: 'bundle-neon-city', name: 'Neonstadt-Paket', description: 'Synthwave-Nacht mit Pink, Cyan und Scanlines.',
    itemIds: ['bg-neon-city', 'frame-neon-pink', 'name-synthwave', 'effect-scanlines'] },
  { id: 'bundle-orbital', name: 'Weltraum-Paket', description: 'Ringplanet, Sternenstaub und eine Rakete im Gepäck.',
    itemIds: ['bg-orbital', 'title-bounty-hunter', 'badge-rocket', 'effect-stardust'] },
  { id: 'bundle-pirate-cove', name: 'Piraten-Paket', description: 'Mondlicht, Segel und die Flagge am Mast.',
    itemIds: ['bg-pirate-cove', 'title-buccaneer', 'badge-jolly-roger', 'sticker-goldfish'] },
  { id: 'bundle-dungeon', name: 'Dungeon-Paket', description: 'Fackeln an, Schild hoch – der Raid kann beginnen.',
    itemIds: ['bg-dungeon-torches', 'frame-torchlight', 'title-dungeon-master', 'badge-guardian'] },
];

// ---------- Owner input validation ----------

const AVAILABILITIES: ItemAvailability[] = ['shop', 'blackmarket', 'event', 'achievement', 'ranking'];

function oneOf<V extends string>(value: unknown, list: readonly V[], field: string): V {
  if (!list.includes(value as V)) throw badRequest(`${field}: einer von ${list.join(', ')} erwartet.`);
  return value as V;
}

function colors(value: unknown, field: string, max: number): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) throw badRequest(`${field}: 1 bis ${max} Farben erwartet.`);
  return value.map((color) => hexColor(color, field));
}

/** Validates item data against the slot's SlotData shape. */
export function parseSlotData(slot: CosmeticSlot, input: unknown): SlotData[CosmeticSlot] {
  const d = body(input);
  switch (slot) {
    case 'background': {
      const kind = oneOf(d.kind, ['solid', 'gradient', 'pattern', 'aurora', 'mesh', 'scene'] as const, 'Art');
      return {
        kind,
        colors: colors(d.colors, 'Farben', 4),
        angle: int(d.angle, 'Winkel', 0, 360),
        pattern: oneOf(d.pattern, ['none', 'dots', 'grid', 'waves', 'stars', 'hex', 'diagonal', 'circuit'] as const, 'Muster'),
        ...(kind === 'scene' ? { scene: oneOf(d.scene, BACKGROUND_SCENES, 'Motiv') } : {}),
      };
    }
    case 'accent': return { color: hexColor(d.color, 'Farbe') };
    case 'nameStyle': return { colors: colors(d.colors, 'Farben', 3), glow: bool(d.glow, 'Leuchten') };
    case 'frame': return {
      style: oneOf(d.style, ['solid', 'gradient', 'glow', 'double', 'dashed', 'neon', 'crown'] as const, 'Stil'),
      colors: colors(d.colors, 'Farben', 3),
      width: int(d.width, 'Breite', 1, 12),
    };
    case 'badge': return { glyph: oneOf(d.glyph, BADGE_GLYPHS, 'Symbol'), color: hexColor(d.color, 'Farbe') };
    case 'title': return { text: str(d.text, 'Titeltext', { min: 1, max: 32 }), color: hexColor(d.color, 'Farbe') };
    case 'xpBar': return { style: oneOf(d.style, ['solid', 'gradient', 'striped', 'segmented', 'glow'] as const, 'Stil'), colors: colors(d.colors, 'Farben', 3) };
    case 'font': return { font: oneOf(d.font, ['inter', 'unbounded', 'caveat'] as const, 'Schrift') };
    case 'effect': return { effect: oneOf(d.effect, ['sparkles', 'snow', 'confetti', 'aurora', 'scanlines', 'stardust', 'embers', 'hearts', 'leaves'] as const, 'Effekt') };
    case 'levelup': return { style: oneOf(d.style, ['classic', 'minimal', 'neon', 'royal', 'retro'] as const, 'Stil'), color: hexColor(d.color, 'Farbe') };
    case 'layout': return { layout: oneOf(d.layout, ['classic', 'compact', 'centered', 'split'] as const, 'Layout') };
    case 'sticker': return {
      glyph: oneOf(d.glyph, BADGE_GLYPHS, 'Symbol'),
      color: hexColor(d.color, 'Farbe'),
      corner: oneOf(d.corner, ['tl', 'tr', 'bl', 'br'] as const, 'Ecke'),
    };
  }
}

/** Full item from owner input, merged onto `current` for updates. */
export function parseItem(input: unknown, current: CosmeticItem | null): CosmeticItem {
  const raw: Record<string, unknown> = { ...current, ...body(input) };
  const id = current?.id ?? str(raw.id, 'ID', { min: 3, max: 48 });
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw badRequest('ID: nur Kleinbuchstaben, Ziffern und Bindestriche.');
  const slot = oneOf(raw.slot, COSMETIC_SLOTS, 'Slot');
  const availability = oneOf(raw.availability ?? 'shop', AVAILABILITIES, 'Verfügbarkeit');
  const eventId = raw.eventId === null || raw.eventId === undefined || raw.eventId === '' ? null : str(raw.eventId, 'Event', { min: 1, max: 48 });
  if (availability === 'event' && !eventId) throw badRequest('Event-Items brauchen ein Event.');
  const achievementId = raw.achievementId === null || raw.achievementId === undefined || raw.achievementId === '' ? null : str(raw.achievementId, 'Erfolg', { min: 1, max: 48 });
  return {
    id,
    slot,
    rarity: oneOf(raw.rarity, RARITIES, 'Seltenheit'),
    price: int(raw.price, 'Preis', 0, 1_000_000),
    availability,
    eventId: availability === 'event' ? eventId : null,
    achievementId,
    active: raw.active === undefined ? true : bool(raw.active, 'Aktiv'),
    name: str(raw.name, 'Name', { min: 1, max: 40 }),
    description: str(raw.description ?? '', 'Beschreibung', { max: 160 }),
    data: parseSlotData(slot, raw.data),
  } as CosmeticItem;
}

// ---------- Storage ----------

interface ItemRow {
  id: string; slot: CosmeticSlot; rarity: Rarity; price: number; availability: ItemAvailability; event_id: string | null;
  achievement_id: string | null; active: boolean; name: string; description: string; data: SlotData[CosmeticSlot];
}

const toItem = (row: ItemRow): CosmeticItem => ({
  id: row.id, slot: row.slot, rarity: row.rarity, price: row.price, availability: row.availability, eventId: row.event_id,
  achievementId: row.achievement_id, active: row.active, name: row.name, description: row.description, data: row.data,
}) as CosmeticItem;

let cache: { byId: Map<string, CosmeticItem>; at: number } | null = null;
const CACHE_MS = 60_000;

export function invalidateCatalog(): void {
  cache = null;
}

/** Every catalog item (inactive included) by id. Without the database: the built-in seed. */
export async function loadCatalog(): Promise<Map<string, CosmeticItem>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.byId;
  const pool = cosmeticsPool();
  const items = pool
    ? (await pool.query<ItemRow>(`SELECT * FROM ${T.shop_items} ORDER BY created_at, id`)).rows.map(toItem)
    : SEED_ITEMS;
  cache = { byId: new Map(items.map((entry) => [entry.id, entry])), at: Date.now() };
  return cache.byId;
}

/** Inserts seed items whose id is missing; existing rows (owner edits) stay untouched. Returns the number inserted. */
export async function seedCatalog(): Promise<number> {
  const pool = cosmeticsPool();
  if (!pool) return 0;
  const rows = SEED_ITEMS.map((entry) => ({
    id: entry.id, slot: entry.slot, rarity: entry.rarity, price: entry.price, availability: entry.availability, event_id: entry.eventId,
    achievement_id: entry.achievementId, active: entry.active, name: entry.name, description: entry.description, data: entry.data,
  }));
  const result = await pool.query(
    `INSERT INTO ${T.shop_items} (id, slot, rarity, price, availability, event_id, achievement_id, active, name, description, data)
     SELECT id, slot, rarity, price, availability, event_id, achievement_id, active, name, description, data
     FROM jsonb_to_recordset($1::jsonb) AS x(id text, slot text, rarity text, price int, availability text, event_id text,
       achievement_id text, active boolean, name text, description text, data jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(rows)],
  );
  invalidateCatalog();
  return result.rowCount ?? 0;
}

export async function createItem(input: unknown): Promise<CosmeticItem> {
  const entry = parseItem(input, null);
  const result = await requirePool().query(
    `INSERT INTO ${T.shop_items} (id, slot, rarity, price, availability, event_id, achievement_id, active, name, description, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb) ON CONFLICT (id) DO NOTHING`,
    [entry.id, entry.slot, entry.rarity, entry.price, entry.availability, entry.eventId, entry.achievementId, entry.active, entry.name, entry.description, JSON.stringify(entry.data)],
  );
  if (!result.rowCount) throw new HttpError(409, 'Ein Item mit dieser ID gibt es schon.');
  invalidateCatalog();
  return entry;
}

export async function updateItem(id: string, input: unknown): Promise<CosmeticItem> {
  invalidateCatalog();
  const current = (await loadCatalog()).get(id);
  if (!current) throw new HttpError(404, 'Item nicht gefunden.');
  const entry = parseItem(input, current);
  await requirePool().query(
    `UPDATE ${T.shop_items} SET slot = $2, rarity = $3, price = $4, availability = $5, event_id = $6, achievement_id = $7,
       active = $8, name = $9, description = $10, data = $11::jsonb WHERE id = $1`,
    [id, entry.slot, entry.rarity, entry.price, entry.availability, entry.eventId, entry.achievementId, entry.active, entry.name, entry.description, JSON.stringify(entry.data)],
  );
  invalidateCatalog();
  return entry;
}

export async function deactivateItem(id: string): Promise<void> {
  const result = await requirePool().query(`UPDATE ${T.shop_items} SET active = FALSE WHERE id = $1`, [id]);
  if (!result.rowCount) throw new HttpError(404, 'Item nicht gefunden.');
  invalidateCatalog();
}
