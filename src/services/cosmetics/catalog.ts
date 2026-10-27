// Cosmetics catalog: the built-in seed (inserted once per id on start, so owner edits always win) and the
// shop_items storage with a short in-memory cache for the card renderer.

import {
  BACKGROUND_SCENES, BADGE_GLYPHS, CARD_LAYOUTS, COSMETIC_SLOTS, EFFECTS, FRAME_STYLES, PET_SPECIES, RARITIES, STICKER_SPOTS, XP_BAR_STYLES,
  type BackgroundScene, type BadgeGlyph, type CosmeticItem, type CosmeticSlot, type ItemAvailability, type Rarity, type SlotData,
} from '../../shared/cosmetics.js';
import { HttpError, badRequest, body, bool, hexColor, int, str } from '../../web/http.js';
import { T, cosmeticsPool, requirePool } from './db.js';
import type { ActivityCounter } from './activity.js';

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
/** What an achievement can watch: activity counters (services/cosmetics/activity.ts) plus values derived from data. */
export type AchievementStat =
  | 'maxLevel' | 'wins' | 'items' | 'streak' | 'lifetime' | 'purchases' | 'gifts' | 'blackMarket' | 'top3'
  | 'daily' | 'spent' | 'giftsReceived' | 'servers' | 'servers10' | 'monthlyWins' | 'eventItems' | 'birthday' | 'bio' | 'outfit'
  | 'achievements' | 'gamesPlayed' | 'voiceMinutes' | 'chat_days' | 'chat_streak_best' | 'petFeeds' | 'petForm' | 'pets'
  | Exclude<ActivityCounter, 'voice_ms'>;

/**
 * Every achievement: the stat it watches (services/cosmetics/achievements.ts), its target and Bernis reward, and
 * what it grants: its badge `ach-<id>` and a title `ach-title-<id>` that exists nowhere else.
 */
export const ACHIEVEMENT_BADGES: {
  achievementId: string; stat: AchievementStat; target: number; reward: number;
  name: string; description: string; rarity: Rarity; glyph: BadgeGlyph; color: string; title: string;
  /** Secret until unlocked: the page shows only that it exists and its reward, never the condition. */
  hidden?: true;
}[] = [
  { achievementId: 'first_purchase', stat: 'purchases', target: 1, reward: 50, name: 'Erster Einkauf', description: 'Dein erstes Item aus dem Berni-Shop.', rarity: 'common', glyph: 'gift', color: '#7DD3FC', title: 'Shopping-Neuling' },
  { achievementId: 'purchases_25', stat: 'purchases', target: 25, reward: 250, name: 'Shopaholic', description: '25 Einkäufe im Berni-Shop.', rarity: 'epic', glyph: 'gift', color: '#38BDF8', title: 'Shopaholic' },
  { achievementId: 'collector_10', stat: 'items', target: 10, reward: 100, name: 'Sammler', description: '10 Cosmetics in deiner Sammlung.', rarity: 'rare', glyph: 'diamond', color: '#22D3EE', title: 'Jäger und Sammler' },
  { achievementId: 'collector_50', stat: 'items', target: 50, reward: 400, name: 'Museumsdirektor', description: '50 Cosmetics in deiner Sammlung.', rarity: 'legendary', glyph: 'diamond', color: '#A78BFA', title: 'Museumsdirektor' },
  { achievementId: 'event_items_10', stat: 'eventItems', target: 10, reward: 300, name: 'Saisonsammler', description: '10 Event-Artikel gesammelt.', rarity: 'epic', glyph: 'leaf', color: '#F59E0B', title: 'Saisonsammler' },
  { achievementId: 'spent_50000', stat: 'spent', target: 50000, reward: 500, name: 'Big Spender', description: 'Insgesamt 50.000 Bernis ausgegeben.', rarity: 'legendary', glyph: 'diamond', color: '#FDE68A', title: 'Big Spender', hidden: true },
  { achievementId: 'outfit_full', stat: 'outfit', target: 1, reward: 250, name: 'Komplett gestylt', description: 'In jedem Bereich etwas angelegt.', rarity: 'epic', glyph: 'star', color: '#F472B6', title: 'Modeikone' },
  { achievementId: 'bio_set', stat: 'bio', target: 1, reward: 30, name: 'Über mich', description: 'Einen Text für deine Profilkarte geschrieben.', rarity: 'common', glyph: 'chat', color: '#CBD5E1', title: 'Hat was zu sagen' },
  { achievementId: 'black_market', stat: 'blackMarket', target: 1, reward: 150, name: 'Schattenhändler', description: 'Etwas auf dem Schwarzmarkt gekauft.', rarity: 'epic', glyph: 'moon', color: '#A78BFA', title: 'Kennt da jemanden', hidden: true },
  { achievementId: 'black_market_5', stat: 'blackMarket', target: 5, reward: 400, name: 'Stammkunde der Nacht', description: '5 Käufe auf dem Schwarzmarkt.', rarity: 'legendary', glyph: 'moon', color: '#C084FC', title: 'Unterwelt-Stammkunde', hidden: true },
  { achievementId: 'first_gift', stat: 'gifts', target: 1, reward: 50, name: 'Großes Herz', description: 'Dein erstes Item verschenkt.', rarity: 'rare', glyph: 'heart', color: '#FDA4AF', title: 'Wichtel' },
  { achievementId: 'gifts_10', stat: 'gifts', target: 10, reward: 200, name: 'Wichtelmeister', description: '10 Items verschenkt.', rarity: 'epic', glyph: 'gift', color: '#FB7185', title: 'Weihnachtsmann in Teilzeit' },
  { achievementId: 'gifts_received_5', stat: 'giftsReceived', target: 5, reward: 150, name: 'Beschenkt', description: '5 Geschenke von anderen bekommen.', rarity: 'rare', glyph: 'gift', color: '#F9A8D4', title: 'Glückskind' },
  { achievementId: 'lifetime_10000', stat: 'lifetime', target: 10000, reward: 250, name: 'Bernsteinschatz', description: 'Insgesamt 10.000 Bernis verdient.', rarity: 'legendary', glyph: 'diamond', color: '#F5C451', title: 'Bernsteinbaron' },
  { achievementId: 'lifetime_100000', stat: 'lifetime', target: 100000, reward: 1000, name: 'Goldhaufen', description: 'Insgesamt 100.000 Bernis verdient.', rarity: 'mythic', glyph: 'diamond', color: '#FDE68A', title: 'Drache auf dem Goldhaufen' },
  { achievementId: 'streak_7', stat: 'streak', target: 7, reward: 75, name: 'Treue Woche', description: '7 Tage in Folge den Tagesbonus abgeholt.', rarity: 'rare', glyph: 'flame', color: '#FB923C', title: 'Gewohnheitstier' },
  { achievementId: 'streak_30', stat: 'streak', target: 30, reward: 300, name: 'Monat der Treue', description: '30 Tage in Folge den Tagesbonus abgeholt.', rarity: 'epic', glyph: 'flame', color: '#F43F5E', title: 'Unaufhaltsam' },
  { achievementId: 'streak_100', stat: 'streak', target: 100, reward: 800, name: 'Eiserne Treue', description: '100 Tage in Folge den Tagesbonus abgeholt.', rarity: 'legendary', glyph: 'flame', color: '#F59E0B', title: 'Hat nie Urlaub' },
  { achievementId: 'daily_100', stat: 'daily', target: 100, reward: 300, name: 'Pünktlich', description: '100-mal den Tagesbonus abgeholt.', rarity: 'epic', glyph: 'clock', color: '#FCD34D', title: 'Pünktlich wie die Uhr' },
  { achievementId: 'level_10', stat: 'maxLevel', target: 10, reward: 50, name: 'Aufsteiger', description: 'Level 10 auf einem Server erreicht.', rarity: 'common', glyph: 'star', color: '#CBD5E1', title: 'Kein Neuling mehr' },
  { achievementId: 'level_25', stat: 'maxLevel', target: 25, reward: 120, name: 'Stammgast', description: 'Level 25 auf einem Server erreicht.', rarity: 'rare', glyph: 'star', color: '#38BDF8', title: 'Gehört zum Inventar' },
  { achievementId: 'level_50', stat: 'maxLevel', target: 50, reward: 300, name: 'Lebende Legende', description: 'Level 50 auf einem Server erreicht.', rarity: 'legendary', glyph: 'star', color: '#F5C451', title: 'Lebende Legende' },
  { achievementId: 'level_100', stat: 'maxLevel', target: 100, reward: 600, name: 'Endgegner', description: 'Level 100 auf einem Server erreicht.', rarity: 'mythic', glyph: 'crown', color: '#F5C451', title: 'Endgegner' },
  { achievementId: 'servers_3', stat: 'servers', target: 3, reward: 100, name: 'Weltenbummler', description: 'Auf 3 Servern mit Nexo unterwegs.', rarity: 'rare', glyph: 'rocket', color: '#7DD3FC', title: 'Weltenbummler' },
  { achievementId: 'servers_level10_3', stat: 'servers10', target: 3, reward: 300, name: 'Überall zuhause', description: 'Auf 3 Servern Level 10 erreicht.', rarity: 'epic', glyph: 'rocket', color: '#A78BFA', title: 'Überall zuhause' },
  { achievementId: 'birthday_set', stat: 'birthday', target: 1, reward: 30, name: 'Party-Planer', description: 'Deinen Geburtstag eingetragen.', rarity: 'common', glyph: 'gift', color: '#F9A8D4', title: 'Geburtstagskind' },
  { achievementId: 'msg_1', stat: 'messages', target: 1, reward: 20, name: 'Hallo Welt', description: 'Deine erste Nachricht.', rarity: 'common', glyph: 'chat', color: '#CBD5E1', title: 'Frisch geschlüpft' },
  { achievementId: 'msg_100', stat: 'messages', target: 100, reward: 50, name: 'Gesprächig', description: '100 Nachrichten geschrieben.', rarity: 'common', glyph: 'chat', color: '#7DD3FC', title: 'Redselig' },
  { achievementId: 'msg_1000', stat: 'messages', target: 1000, reward: 150, name: 'Vielschreiber', description: '1.000 Nachrichten geschrieben.', rarity: 'rare', glyph: 'chat', color: '#38BDF8', title: 'Tastaturheld' },
  { achievementId: 'msg_10000', stat: 'messages', target: 10000, reward: 500, name: 'Romanautor', description: '10.000 Nachrichten geschrieben.', rarity: 'legendary', glyph: 'chat', color: '#A78BFA', title: 'Schreibt Romane' },
  { achievementId: 'msg_50000', stat: 'messages', target: 50000, reward: 1200, name: 'Endlos-Chatter', description: '50.000 Nachrichten geschrieben.', rarity: 'mythic', glyph: 'chat', color: '#F472B6', title: 'Die Tastatur glüht' },
  { achievementId: 'replies_100', stat: 'msg_reply', target: 100, reward: 100, name: 'Gute Antwort', description: '100-mal auf eine Nachricht geantwortet.', rarity: 'rare', glyph: 'chat', color: '#86EFAC', title: 'Antwortmaschine' },
  { achievementId: 'questions_100', stat: 'msg_question', target: 100, reward: 100, name: 'Neugierig', description: '100 Fragen gestellt.', rarity: 'rare', glyph: 'chat', color: '#FCD34D', title: 'Wissbegierig' },
  { achievementId: 'long_50', stat: 'msg_long', target: 50, reward: 150, name: 'Essayist', description: '50 richtig lange Nachrichten geschrieben.', rarity: 'epic', glyph: 'chat', color: '#C4B5FD', title: 'Schreibt Essays' },
  { achievementId: 'media_50', stat: 'msg_media', target: 50, reward: 100, name: 'Fotograf', description: '50 Bilder oder Videos geteilt.', rarity: 'rare', glyph: 'star', color: '#FDA4AF', title: 'Paparazzo' },
  { achievementId: 'media_500', stat: 'msg_media', target: 500, reward: 400, name: 'Galerie', description: '500 Bilder oder Videos geteilt.', rarity: 'legendary', glyph: 'star', color: '#F472B6', title: 'Kurator' },
  { achievementId: 'emoji_500', stat: 'msg_emoji', target: 500, reward: 150, name: 'Emoji-Regen', description: '500 Nachrichten mit Emojis.', rarity: 'epic', glyph: 'heart', color: '#FCD34D', title: 'Emoji-Flüsterer' },
  { achievementId: 'links_100', stat: 'msg_link', target: 100, reward: 100, name: 'Linksammler', description: '100 Links geteilt.', rarity: 'rare', glyph: 'code', color: '#7DD3FC', title: 'Lesezeichen auf Beinen' },
  { achievementId: 'caps_10', stat: 'msg_caps', target: 10, reward: 50, name: 'CAPS LOCK', description: '10 Nachrichten komplett in Großbuchstaben.', rarity: 'rare', glyph: 'bolt', color: '#F87171', title: 'Feststelltaste klemmt', hidden: true },
  { achievementId: 'weekend_500', stat: 'msg_weekend', target: 500, reward: 200, name: 'Wochenendkrieger', description: '500 Nachrichten am Wochenende.', rarity: 'epic', glyph: 'sun', color: '#FBBF24', title: 'Wochenendkrieger' },
  { achievementId: 'night_1', stat: 'msg_night', target: 1, reward: 30, name: 'Nachtschicht', description: 'Eine Nachricht zwischen Mitternacht und 5 Uhr.', rarity: 'common', glyph: 'moon', color: '#A5B4FC', title: 'Nachtgespenst' },
  { achievementId: 'night_100', stat: 'msg_night', target: 100, reward: 250, name: 'Eule', description: '100 Nachrichten zwischen Mitternacht und 5 Uhr.', rarity: 'epic', glyph: 'moon', color: '#818CF8', title: 'Schläft nie' },
  { achievementId: 'early_1', stat: 'msg_early', target: 1, reward: 30, name: 'Frühaufsteher', description: 'Eine Nachricht zwischen 5 und 7 Uhr.', rarity: 'common', glyph: 'sun', color: '#FDE68A', title: 'Der frühe Vogel' },
  { achievementId: 'early_50', stat: 'msg_early', target: 50, reward: 200, name: 'Morgenroutine', description: '50 Nachrichten zwischen 5 und 7 Uhr.', rarity: 'epic', glyph: 'sun', color: '#FBBF24', title: 'Kaffee vor Sonnenaufgang' },
  { achievementId: 'midnight', stat: 'msg_midnight', target: 1, reward: 150, name: 'Punkt Mitternacht', description: 'Eine Nachricht genau um 00:00 Uhr.', rarity: 'epic', glyph: 'clock', color: '#C084FC', title: 'Geisterstunde', hidden: true },
  { achievementId: 'leet', stat: 'msg_leet', target: 1, reward: 137, name: '13:37', description: 'Eine Nachricht genau um 13:37 Uhr.', rarity: 'epic', glyph: 'code', color: '#4ADE80', title: 'Leet', hidden: true },
  { achievementId: 'good_morning_30', stat: 'msg_morning', target: 30, reward: 100, name: 'Guten Morgen!', description: '30-mal morgens „Guten Morgen“ gesagt.', rarity: 'rare', glyph: 'sun', color: '#FCD34D', title: 'Sonnenschein', hidden: true },
  { achievementId: 'chatstreak_3', stat: 'chat_streak_best', target: 3, reward: 40, name: 'Am Ball', description: '3 Tage in Folge gechattet.', rarity: 'common', glyph: 'flame', color: '#FDBA74', title: 'Am Ball' },
  { achievementId: 'chatstreak_7', stat: 'chat_streak_best', target: 7, reward: 100, name: 'Stammtisch', description: '7 Tage in Folge gechattet.', rarity: 'rare', glyph: 'flame', color: '#FB923C', title: 'Stammtisch' },
  { achievementId: 'chatstreak_30', stat: 'chat_streak_best', target: 30, reward: 400, name: 'Monatsmarathon', description: '30 Tage in Folge gechattet.', rarity: 'epic', glyph: 'flame', color: '#F97316', title: 'Gehört zum Mobiliar' },
  { achievementId: 'chatstreak_100', stat: 'chat_streak_best', target: 100, reward: 900, name: 'Hundert Tage', description: '100 Tage in Folge gechattet.', rarity: 'legendary', glyph: 'flame', color: '#EF4444', title: 'Unzerstörbar' },
  { achievementId: 'chatdays_365', stat: 'chat_days', target: 365, reward: 1500, name: 'Ein Jahr dabei', description: 'An 365 Tagen gechattet.', rarity: 'mythic', glyph: 'clock', color: '#F5C451', title: 'Urgestein' },
  { achievementId: 'reactions_10', stat: 'reactions', target: 10, reward: 20, name: 'Daumen hoch', description: '10 Reaktionen vergeben.', rarity: 'common', glyph: 'heart', color: '#FDA4AF', title: 'Daumen-Profi' },
  { achievementId: 'reactions_500', stat: 'reactions', target: 500, reward: 150, name: 'Reaktionskünstler', description: '500 Reaktionen vergeben.', rarity: 'epic', glyph: 'heart', color: '#FB7185', title: 'Reaktionskönig' },
  { achievementId: 'reactions_5000', stat: 'reactions', target: 5000, reward: 600, name: 'Emoji-Lawine', description: '5.000 Reaktionen vergeben.', rarity: 'legendary', glyph: 'heart', color: '#F43F5E', title: 'Reaktionsmaschine' },
  { achievementId: 'voice_60', stat: 'voiceMinutes', target: 60, reward: 40, name: 'Erste Worte', description: 'Eine Stunde im Sprachkanal.', rarity: 'common', glyph: 'mic', color: '#7DD3FC', title: 'Hat eine Stimme' },
  { achievementId: 'voice_600', stat: 'voiceMinutes', target: 600, reward: 150, name: 'Stammgast im Voice', description: '10 Stunden im Sprachkanal.', rarity: 'rare', glyph: 'mic', color: '#38BDF8', title: 'Mikrofon-Held' },
  { achievementId: 'voice_6000', stat: 'voiceMinutes', target: 6000, reward: 500, name: 'Podcaster', description: '100 Stunden im Sprachkanal.', rarity: 'epic', glyph: 'mic', color: '#818CF8', title: 'Podcaster' },
  { achievementId: 'voice_30000', stat: 'voiceMinutes', target: 30000, reward: 1200, name: 'Radiomoderator', description: '500 Stunden im Sprachkanal.', rarity: 'legendary', glyph: 'mic', color: '#C084FC', title: 'Radiostimme' },
  { achievementId: 'commands_10', stat: 'commands', target: 10, reward: 20, name: 'Befehlsempfänger', description: '10 Slash-Befehle benutzt.', rarity: 'common', glyph: 'code', color: '#CBD5E1', title: 'Knöpfchendrücker' },
  { achievementId: 'commands_500', stat: 'commands', target: 500, reward: 200, name: 'Power-User', description: '500 Slash-Befehle benutzt.', rarity: 'epic', glyph: 'code', color: '#22D3EE', title: 'Power-User' },
  { achievementId: 'commands_5000', stat: 'commands', target: 5000, reward: 700, name: 'Kommandozentrale', description: '5.000 Slash-Befehle benutzt.', rarity: 'legendary', glyph: 'code', color: '#A78BFA', title: 'Kommandant' },
  { achievementId: 'wins_100', stat: 'wins', target: 100, reward: 100, name: 'Spielkind', description: '100 Minispiel-Erfolge gesammelt.', rarity: 'rare', glyph: 'controller', color: '#818CF8', title: 'Zocker' },
  { achievementId: 'wins_1000', stat: 'wins', target: 1000, reward: 500, name: 'Spielemeister', description: '1.000 Minispiel-Erfolge gesammelt.', rarity: 'legendary', glyph: 'controller', color: '#F5C451', title: 'Spielemeister' },
  { achievementId: 'wins_5000', stat: 'wins', target: 5000, reward: 1000, name: 'Minispiel-Legende', description: '5.000 Minispiel-Erfolge gesammelt.', rarity: 'mythic', glyph: 'controller', color: '#F472B6', title: 'Minispiel-Monarch' },
  { achievementId: 'counting_10', stat: 'counting', target: 10, reward: 30, name: 'Kann zählen', description: '10 richtige Zahlen im Zählspiel.', rarity: 'common', glyph: 'dice', color: '#CBD5E1', title: 'Kann bis 10 zählen' },
  { achievementId: 'counting_100', stat: 'counting', target: 100, reward: 150, name: 'Rechenkünstler', description: '100 richtige Zahlen im Zählspiel.', rarity: 'rare', glyph: 'dice', color: '#7DD3FC', title: 'Rechenkünstler' },
  { achievementId: 'counting_1000', stat: 'counting', target: 1000, reward: 600, name: 'Mathegenie', description: '1.000 richtige Zahlen im Zählspiel.', rarity: 'legendary', glyph: 'dice', color: '#F5C451', title: 'Taschenrechner' },
  { achievementId: 'fish_50', stat: 'game_fish', target: 50, reward: 150, name: 'Angler', description: '50-mal erfolgreich geangelt.', rarity: 'rare', glyph: 'fish', color: '#38BDF8', title: 'Petri Heil' },
  { achievementId: 'mine_50', stat: 'game_mine', target: 50, reward: 150, name: 'Bergmann', description: '50-mal erfolgreich geschürft.', rarity: 'rare', glyph: 'pickaxe', color: '#94A3B8', title: 'Glück auf' },
  { achievementId: 'work_100', stat: 'game_work', target: 100, reward: 200, name: 'Workaholic', description: '100-mal gearbeitet.', rarity: 'epic', glyph: 'trophy', color: '#FCD34D', title: 'Workaholic' },
  { achievementId: 'gamble_100', stat: 'game_gamble', target: 100, reward: 200, name: 'Risikofreudig', description: '100 Glücksspiele gewonnen.', rarity: 'epic', glyph: 'dice', color: '#F87171', title: 'High Roller', hidden: true },
  { achievementId: 'crime_25', stat: 'game_crime', target: 25, reward: 150, name: 'Kleinkrimineller', description: '25 Verbrechen erfolgreich begangen.', rarity: 'rare', glyph: 'skull', color: '#94A3B8', title: 'Gesucht', hidden: true },
  { achievementId: 'fight_50', stat: 'game_fight', target: 50, reward: 250, name: 'Duellant', description: '50 Duelle gewonnen.', rarity: 'epic', glyph: 'shield', color: '#F97316', title: 'Duellmeister' },
  { achievementId: 'games_all', stat: 'gamesPlayed', target: 11, reward: 400, name: 'Allrounder', description: 'Jedes Minispiel mindestens einmal geschafft.', rarity: 'legendary', glyph: 'controller', color: '#22D3EE', title: 'Tausendsassa' },
  { achievementId: 'duel_10', stat: 'game_duel', target: 10, reward: 150, name: 'Herausforderer', description: '10 Spiele gegen andere gewonnen (/fun spiel).', rarity: 'rare', glyph: 'controller', color: '#F472B6', title: 'Herausforderer' },
  { achievementId: 'duel_50', stat: 'game_duel', target: 50, reward: 500, name: 'Brettspielkönig', description: '50 Spiele gegen andere gewonnen (/fun spiel).', rarity: 'legendary', glyph: 'crown', color: '#E879F9', title: 'Brettspielkönig' },
  { achievementId: 'quests_7', stat: 'quest_days', target: 7, reward: 150, name: 'Pflichtbewusst', description: 'An 7 Tagen alle Tagesaufgaben geschafft.', rarity: 'rare', glyph: 'clock', color: '#86EFAC', title: 'Pflichtbewusst' },
  { achievementId: 'quests_30', stat: 'quest_days', target: 30, reward: 400, name: 'Aufgabenprofi', description: 'An 30 Tagen alle Tagesaufgaben geschafft.', rarity: 'epic', glyph: 'clock', color: '#34D399', title: 'Aufgabenprofi' },
  { achievementId: 'quests_100', stat: 'quest_days', target: 100, reward: 1000, name: 'Hundert Tage Fleiß', description: 'An 100 Tagen alle Tagesaufgaben geschafft.', rarity: 'legendary', glyph: 'clock', color: '#F5C451', title: 'Fleißiges Bienchen' },
  { achievementId: 'community_1', stat: 'community_goals', target: 1, reward: 100, name: 'Teamgeist', description: 'Bei einem Gemeinschaftsziel mitgeholfen.', rarity: 'rare', glyph: 'heart', color: '#5EEAD4', title: 'Teamplayer' },
  { achievementId: 'community_5', stat: 'community_goals', target: 5, reward: 400, name: 'Gemeinschaftsheld', description: 'Bei 5 Gemeinschaftszielen mitgeholfen.', rarity: 'epic', glyph: 'heart', color: '#2DD4BF', title: 'Herz der Community' },
  { achievementId: 'monthly_top3', stat: 'top3', target: 1, reward: 200, name: 'Podiumsplatz', description: 'In einem Monatsranking unter den Top 3 gelandet.', rarity: 'epic', glyph: 'trophy', color: '#E2E8F0', title: 'Treppchenstürmer' },
  { achievementId: 'monthly_top3_3', stat: 'top3', target: 3, reward: 500, name: 'Podest-Abo', description: 'Dreimal in einem Monatsranking unter den Top 3.', rarity: 'legendary', glyph: 'trophy', color: '#F5C451', title: 'Podest-Abonnent' },
  { achievementId: 'monthly_winner', stat: 'monthlyWins', target: 1, reward: 500, name: 'Monatschampion', description: 'Ein Monatsranking gewonnen.', rarity: 'legendary', glyph: 'crown', color: '#F5C451', title: 'Unangefochten' },
  { achievementId: 'achievements_25', stat: 'achievements', target: 25, reward: 400, name: 'Erfolgsjäger', description: '25 Erfolge freigeschaltet.', rarity: 'legendary', glyph: 'trophy', color: '#22D3EE', title: 'Erfolgsjäger' },
  { achievementId: 'achievements_50', stat: 'achievements', target: 50, reward: 1000, name: 'Komplettist', description: '50 Erfolge freigeschaltet.', rarity: 'mythic', glyph: 'trophy', color: '#F472B6', title: 'Komplettist' },
  // Begleiter (services/cosmetics/pets.ts): feedings, the highest form reached and how many pets.
  { achievementId: 'pet_feed_1', stat: 'petFeeds', target: 1, reward: 30, name: 'Erste Mahlzeit', description: 'Deinen Begleiter zum ersten Mal gefüttert.', rarity: 'common', glyph: 'paw', color: '#FDA4AF', title: 'Futterbringer' },
  { achievementId: 'pet_feed_30', stat: 'petFeeds', target: 30, reward: 150, name: 'Treue Pflege', description: '30-mal einen Begleiter gefüttert.', rarity: 'rare', glyph: 'heart', color: '#FB7185', title: 'Tierfreund' },
  { achievementId: 'pet_feed_100', stat: 'petFeeds', target: 100, reward: 400, name: 'Hundert Mahlzeiten', description: '100-mal einen Begleiter gefüttert.', rarity: 'epic', glyph: 'paw', color: '#F59E0B', title: 'Tierpfleger' },
  { achievementId: 'pet_feed_365', stat: 'petFeeds', target: 365, reward: 1500, name: 'Ein Jahr Futter', description: '365-mal einen Begleiter gefüttert.', rarity: 'legendary', glyph: 'star', color: '#F5C451', title: 'Hüter der Tiere' },
  { achievementId: 'pet_form_2', stat: 'petForm', target: 2, reward: 120, name: 'Großgezogen', description: 'Ein Begleiter hat seine Jugendform erreicht.', rarity: 'rare', glyph: 'egg', color: '#86EFAC', title: 'Züchter' },
  { achievementId: 'pet_form_3', stat: 'petForm', target: 3, reward: 500, name: 'Erwachsen geworden', description: 'Ein Begleiter hat seine Erwachsenenform erreicht.', rarity: 'epic', glyph: 'shield', color: '#7DD3FC', title: 'Rudelführer' },
  { achievementId: 'pet_form_4', stat: 'petForm', target: 4, reward: 2500, name: 'Kronenform', description: 'Ein Begleiter hat seine Kronenform erreicht.', rarity: 'mythic', glyph: 'crown', color: '#F5C451', title: 'Legendenhüter', hidden: true },
  { achievementId: 'pets_3', stat: 'pets', target: 3, reward: 300, name: 'Kleiner Zoo', description: 'Drei Begleiter besessen.', rarity: 'epic', glyph: 'paw', color: '#C4B5FD', title: 'Zoodirektor' },
  // Leicht zum Einstieg, schwer für die Ausdauernden.
  { achievementId: 'question_1', stat: 'msg_question', target: 1, reward: 15, name: 'Erste Frage', description: 'Deine erste Frage im Chat gestellt.', rarity: 'common', glyph: 'chat', color: '#93C5FD', title: 'Fragezeichen' },
  { achievementId: 'media_1', stat: 'msg_media', target: 1, reward: 15, name: 'Schnappschuss', description: 'Dein erstes Bild oder Video geteilt.', rarity: 'common', glyph: 'sun', color: '#FBBF24', title: 'Hobbyfotograf' },
  { achievementId: 'collector_100', stat: 'items', target: 100, reward: 800, name: 'Schatzkammer', description: '100 Cosmetics in deiner Sammlung.', rarity: 'legendary', glyph: 'diamond', color: '#A5F3FC', title: 'Schatzmeister' },
  { achievementId: 'quests_365', stat: 'quest_days', target: 365, reward: 3000, name: 'Ein Jahr Aufgaben', description: 'An 365 Tagen alle Tagesaufgaben geschafft.', rarity: 'mythic', glyph: 'clock', color: '#F5C451', title: 'Unermüdlich', hidden: true },
  { achievementId: 'achievements_75', stat: 'achievements', target: 75, reward: 2000, name: 'Fast alles', description: '75 Erfolge freigeschaltet.', rarity: 'mythic', glyph: 'trophy', color: '#A78BFA', title: 'Vollender', hidden: true },
];

/** Achievements that stay secret until unlocked. */
export const HIDDEN_ACHIEVEMENTS = new Set(ACHIEVEMENT_BADGES.filter((entry) => entry.hidden).map((entry) => entry.achievementId));

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
  item('frame', 'frame-olive', 'rare', 1300, 'Olivenzweig', 'Zwei Olivenzweige, unten mit einer Schleife gebunden.', { style: 'laurel', colors: ['#9DB76B', '#5A7A3A'], width: 5 }),
  item('frame', 'frame-glacier', 'rare', 1400, 'Gletscherzacken', 'Kühle Eiszacken in Gletscherblau.', { style: 'crystal', colors: ['#7DD3FC', '#E0F2FE'], width: 5 }),
  item('frame', 'frame-wildfire', 'epic', 3200, 'Flammenkranz', 'Lodernde Flammen rund um deinen Avatar.', { style: 'fire', colors: ['#FF5A1F', '#FFC94A'], width: 6 }),
  item('frame', 'frame-storm', 'epic', 2800, 'Gewitterring', 'Knisternde Blitze in Violett.', { style: 'lightning', colors: ['#A78BFA', '#FFFFFF'], width: 5 }),
  item('frame', 'frame-laurel-gold', 'legendary', 6500, 'Lorbeerkranz', 'Goldener Lorbeer für alle, die vorne liegen.', { style: 'laurel', colors: ['#D4AF37', '#8A6D1F'], width: 6 }),
  item('frame', 'frame-soulfire', 'legendary', 6800, 'Seelenfeuer', 'Blaue Flammen mit eisigem Kern.', { style: 'fire', colors: ['#3B82F6', '#A5F3FC'], width: 6 }),
  item('frame', 'frame-void-glow', 'mythic', 9000, 'Leerenschein', 'Nur auf dem Schwarzmarkt: pulsierender Schein in Türkis und Violett.', { style: 'glow', colors: ['#22D3EE', '#A78BFA'], width: 7 }, BM),
  item('frame', 'frame-pumpkin', 'epic', 2200, 'Kürbisglut', 'Halloween-Edition: glimmender Kürbisrahmen.', { style: 'gradient', colors: ['#F97316', '#7C2D12'], width: 5 }, ev('halloween')),
  item('frame', 'frame-frost', 'epic', 2400, 'Eiskristall', 'Winter-Edition: Eiszacken rund um deinen Avatar.', { style: 'crystal', colors: ['#BAE6FD', '#F0F9FF'], width: 5 }, ev('christmas')),
  item('frame', 'frame-black-gold', 'legendary', 5000, 'Black Gold', 'Black-Friday-Edition: goldene Neonlinie.', { style: 'neon', colors: ['#F5C451'], width: 6 }, ev('black-friday')),
  item('frame', 'frame-valentine', 'epic', 2200, 'Rosenranke', 'Valentins-Edition: Rosenblüten an einer feinen Ranke.', { style: 'blossom', colors: ['#FB7185', '#7A3B2E'], width: 5 }, ev('valentine')),
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
  item('title', 'title-lurker', 'common', 350, 'Professioneller Lurker', 'Liest alles, schreibt nie.', { text: 'Professioneller Lurker', color: '#94A3B8' }),
  item('title', 'title-coffee', 'common', 400, 'Kaffeejunkie', 'Läuft mit Koffein.', { text: 'Kaffeejunkie', color: '#C08A5B' }),
  item('title', 'title-brb', 'common', 450, 'Immer kurz AFK', 'Bin gleich wieder da. Wirklich.', { text: 'Immer kurz AFK', color: '#CBD5E1' }),
  item('title', 'title-emoji-artist', 'common', 500, 'Emoji-Künstler', 'Spricht fließend Emoji.', { text: 'Emoji-Künstler', color: '#FCD34D' }),
  item('title', 'title-meme-lord', 'rare', 900, 'Meme-Lord', 'Herrscher über alle Memes.', { text: 'Meme-Lord', color: '#F472B6' }),
  item('title', 'title-voice-resident', 'rare', 1000, 'Wohnt im Voice-Chat', 'Hat dort schon einen Zweitwohnsitz.', { text: 'Wohnt im Voice-Chat', color: '#7DD3FC' }),
  item('title', 'title-side-quest', 'rare', 1100, 'Nebenquest-Fan', 'Die Hauptstory kann warten.', { text: 'Nebenquest-Fan', color: '#86EFAC' }),
  item('title', 'title-ping', 'rare', 1200, 'Ping 999', 'Lag ist eine Lebenseinstellung.', { text: 'Ping 999', color: '#F87171' }),
  item('title', 'title-spoiler', 'rare', 1300, 'Spoiler-Alarm', 'Weiß schon, wie es ausgeht.', { text: 'Spoiler-Alarm', color: '#FB923C' }),
  item('title', 'title-main-character', 'epic', 2400, 'Hauptcharakter', 'Die Geschichte dreht sich um dich.', { text: 'Hauptcharakter', color: '#F5C451' }),
  item('title', 'title-rage-quit', 'epic', 2600, 'Rage-Quitter', 'Verlässt Spiele mit Stil.', { text: 'Rage-Quitter', color: '#EF4444' }),
  item('title', 'title-final-boss', 'epic', 3000, 'Bossgegner', 'Am Ende wartet immer jemand.', { text: 'Bossgegner', color: '#C084FC' }),
  item('title', 'title-honorary', 'legendary', 5500, 'Ehrenmitglied', 'Für alle, die einfach dazugehören.', { text: 'Ehrenmitglied', color: '#FDE68A' }),
  item('title', 'title-myth', 'legendary', 7000, 'Mythos', 'Man erzählt sich Geschichten über dich.', { text: 'Mythos', color: '#A78BFA' }),
  item('title', 'title-shroom-whisperer', 'rare', 1000, 'Pilzflüsterer', 'Herbst-Edition.', { text: 'Pilzflüsterer', color: '#F87171' }, ev('autumn')),
  item('title', 'title-pumpkin-carver', 'rare', 1000, 'Kürbisschnitzer', 'Halloween-Edition.', { text: 'Kürbisschnitzer', color: '#FB923C' }, ev('halloween')),
  ...ACHIEVEMENT_BADGES.map((entry) => item('title', `ach-title-${entry.achievementId}`, entry.rarity, 0, entry.title, `Erfolg „${entry.name}“: ${entry.description}`,
    { text: entry.title, color: entry.color }, { availability: 'achievement', achievementId: entry.achievementId })),

  // ---------- XP-Balken ----------
  item('xpBar', 'xp-sky', 'common', 300, 'Himmelblau', 'Schlichter Balken in Himmelblau.', { style: 'solid', colors: ['#38BDF8'] }),
  item('xpBar', 'xp-dusk', 'rare', 900, 'Abendrot', 'Verlauf von Indigo zu Violett.', { style: 'gradient', colors: ['#6366F1', '#A855F7'] }),
  item('xpBar', 'xp-mint-striped', 'rare', 1000, 'Mintstreifen', 'Gestreift in Smaragd und Mint.', { style: 'striped', colors: ['#10B981', '#6EE7B7'] }),
  item('xpBar', 'xp-ice-segments', 'epic', 2200, 'Eissegmente', 'Segmentierter Balken in Eisblau.', { style: 'segmented', colors: ['#22D3EE', '#A5F3FC'] }),
  item('xpBar', 'xp-gold-flow', 'legendary', 5500, 'Goldfluss', 'Leuchtender Goldbalken.', { style: 'glow', colors: ['#F59E0B', '#FDE68A'] }),
  item('xpBar', 'xp-8bit', 'common', 500, '8-Bit-Leben', 'Grüne Pixel wie im Retro-Spiel.', { style: 'pixel', colors: ['#4ADE80', '#166534'] }),
  item('xpBar', 'xp-ocean', 'rare', 1200, 'Meeresströmung', 'Wellen und Bläschen in Ozeanblau.', { style: 'wave', colors: ['#0EA5E9', '#7DD3FC'] }),
  item('xpBar', 'xp-ivy-growth', 'rare', 1300, 'Efeuwuchs', 'Eine Ranke, die mit dir wächst.', { style: 'vine', colors: ['#6FA04A', '#3F6B2E'] }),
  item('xpBar', 'xp-potion', 'epic', 2600, 'Zaubertrank', 'Blubbernder Trank in Violett.', { style: 'wave', colors: ['#8B5CF6', '#F0ABFC'] }),
  item('xpBar', 'xp-wildfire', 'epic', 2800, 'Lauffeuer', 'Dein Fortschritt brennt.', { style: 'flame', colors: ['#FF5A1F', '#FFD166'] }),
  item('xpBar', 'xp-comet', 'legendary', 5800, 'Kometenschweif', 'Ein Komet zieht durch die Sterne.', { style: 'comet', colors: ['#A78BFA', '#E0E7FF'] }),
  item('xpBar', 'xp-will-o-wisp', 'rare', 1100, 'Irrlicht', 'Halloween-Edition: grünes Geisterfeuer.', { style: 'flame', colors: ['#65A30D', '#ECFCCB'] }, ev('halloween')),
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
  item('layout', 'layout-banner', 'epic', 2400, 'Banner', 'Ein Bannerstreifen oben, dein Avatar ragt hinein – wie ein Profil auf Discord.', { layout: 'banner' }),
  item('layout', 'layout-mirror', 'rare', 1200, 'Gespiegelt', 'Der Avatar rechts, deine Abzeichen darunter.', { layout: 'mirror' }),
  item('layout', 'layout-minimal', 'rare', 1400, 'Minimal', 'Große Schrift, viel Luft und eine schlanke XP-Linie.', { layout: 'minimal' }),

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
  item('frame', 'frame-ivy', 'epic', 2600, 'Efeuranke', 'Efeu, der sich in zwei Ranken um deinen Avatar windet.', { style: 'vine', colors: ['#7FA857', '#3F6B2E'], width: 6 }),
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
  // ---------- Begleiter (sitzen am Avatar und wachsen mit der Pflege, shared/pets.ts) ----------
  item('pet', 'pet-fox', 'rare', 1500, 'Fuchs', 'Startet als Fuchswelpe und wird mit viel Pflege zur dreischwänzigen Kitsune.', { species: 'fox', color: '#E8833A' }),
  item('pet', 'pet-owl', 'rare', 1500, 'Eule', 'Vom Federknäuel zur Sterneneule mit Nachthimmel-Gefieder.', { species: 'owl', color: '#9C7A5B' }),
  item('pet', 'pet-cat', 'epic', 3500, 'Katze', 'Vom Kätzchen zur zweischwänzigen Nekomata.', { species: 'cat', color: '#8E95A3' }),
  item('pet', 'pet-cat-ginger', 'epic', 3500, 'Rote Katze', 'Ein getigerter Kater, der eines Tages zur Nekomata wird.', { species: 'cat', color: '#E59A4F' }),
  item('pet', 'pet-axolotl', 'epic', 3500, 'Axolotl', 'Von der Larve bis zum Wasserdrachen.', { species: 'axolotl', color: '#F7A1C4' }),
  item('pet', 'pet-dragon', 'legendary', 9000, 'Drache', 'Aus einem Drachenei schlüpft, was einmal ein Urdrache wird.', { species: 'dragon', color: '#4FB477' }),
  item('pet', 'pet-dragon-night', 'mythic', 12000, 'Nachtdrache', 'Aus der Black-Market-Höhle: ein Drachenei in Mitternachtsblau.', { species: 'dragon', color: '#4B5BD6' }, BM),

  // ---------- Spielwelten: Genre-Hommagen als eigene Motive (keine Marken, Figuren oder Namen echter Spiele) ----------
  item('background', 'bg-pixel-quest', 'epic', 2800, 'Pixelabenteuer', 'Retro-Jump-and-Run: Pixelsonne über gestuften Bergen.', scene('pixel', ['#3B2A6B', '#E86F5B', '#FFD166', '#2E7D4F'])),
  item('background', 'bg-neon-city', 'legendary', 6000, 'Neonstadt', 'Skyline bei Nacht mit Synthwave-Sonne und leuchtendem Raster.', scene('neon-city', ['#0B0820', '#FF3DCB', '#33E1FF', '#1A1235'])),
  item('background', 'bg-moon-ninja', 'legendary', 6500, 'Mondschein-Ninja', 'Vollmond, Bambus und Blütenblätter im Wind.', scene('moon-ninja', ['#0D1530', '#24314F', '#F4E7C5', '#F7A8C4'])),
  item('background', 'bg-dungeon-torches', 'epic', 2600, 'Kerkerfackeln', 'Steinmauer im Fackelschein – bereit für den nächsten Raid.', scene('dungeon', ['#1B1714', '#3A322C', '#FF9A3C', '#7A4A2A'])),
  item('background', 'bg-orbital', 'epic', 3200, 'Orbitalstation', 'Ein Ringplanet, Sternenstaub und ein kleiner Mond.', scene('orbital', ['#05060F', '#7C5CFF', '#F2A531', '#22D3EE'])),
  item('background', 'bg-pirate-cove', 'epic', 3000, 'Piratenbucht', 'Ein Schiff unter Segeln im Mondlicht.', scene('pirate-cove', ['#0B1A2E', '#123A5A', '#F4E7C5', '#0A0F18'])),
  item('frame', 'frame-sakura', 'rare', 1200, 'Kirschblütenring', 'Kirschblüten an einem feinen Zweig.', { style: 'blossom', colors: ['#F7A8C4', '#6B4A33'], width: 5 }),
  item('frame', 'frame-neon-pink', 'epic', 2400, 'Neonpink', 'Leuchtröhre in kräftigem Pink.', { style: 'neon', colors: ['#FF3DCB'], width: 5 }),
  item('frame', 'frame-torchlight', 'epic', 2300, 'Fackelschein', 'Warm flackernde Flammen wie von einer Fackel.', { style: 'fire', colors: ['#FF8A2A', '#FFD166'], width: 6 }),
  item('nameStyle', 'name-synthwave', 'epic', 2700, 'Synthwave', 'Verlauf von Pink zu Cyan mit Schein.', { colors: ['#FF3DCB', '#33E1FF'], glow: true }),
  item('title', 'title-shadow-runner', 'epic', 2200, 'Schattenläufer', 'Lautlos und schnell.', { text: 'Schattenläufer', color: '#F7A8C4' }),
  item('title', 'title-pixel-hero', 'rare', 900, 'Pixelheld', 'Acht Bit, volles Herz.', { text: 'Pixelheld', color: '#FFD166' }),
  item('title', 'title-bounty-hunter', 'epic', 2400, 'Kopfgeldjäger', 'Von Station zu Station unterwegs.', { text: 'Kopfgeldjäger', color: '#22D3EE' }),
  item('title', 'title-buccaneer', 'rare', 1000, 'Freibeuter', 'Segel gesetzt, Kurs auf Abenteuer.', { text: 'Freibeuter', color: '#F4E7C5' }),
  item('title', 'title-dungeon-master', 'epic', 2500, 'Dungeonmeister', 'Kennt jede Falle beim Namen.', { text: 'Dungeonmeister', color: '#FF9A3C' }),
  item('xpBar', 'xp-pixel', 'rare', 1000, 'Pixelbalken', 'Pixelig wie eine alte Lebensanzeige.', { style: 'pixel', colors: ['#FFD166', '#E86F5B'] }),
  item('badge', 'badge-jolly-roger', 'rare', 1000, 'Totenkopfflagge', 'Für alle, die gern in See stechen.', badge('skull', '#F4E7C5')),
  item('badge', 'badge-guardian', 'rare', 900, 'Schildwache', 'Hält die Stellung.', badge('shield', '#CBD5E1')),

  // ---------- Herbst 2026: neue Motive in jedem Bereich ----------
  // Hintergründe
  item('background', 'bg-espresso', 'common', 350, 'Espresso', 'Dunkles Kaffeebraun mit warmem Rand.', bg('gradient', ['#1C120C', '#3B2416'], 150)),
  item('background', 'bg-slate-rain', 'common', 400, 'Regentag', 'Kühles Grau wie ein ruhiger Regentag.', bg('gradient', ['#1F2933', '#3E4C59'], 170)),
  item('background', 'bg-plum-velvet', 'common', 450, 'Pflaumensamt', 'Weiches Pflaumenviolett.', bg('solid', ['#2A1530'], 0)),
  item('background', 'bg-mint-dots', 'common', 500, 'Minzpunkte', 'Feine Punkte auf Tannengrün.', bg('pattern', ['#0E2A23', '#34D399'], 0, 'dots')),
  item('background', 'bg-ocean-depths', 'rare', 900, 'Meeresgrund', 'Tiefes Blau, in dem Licht von oben tanzt.', bg('aurora', ['#031525', '#0B4F6C', '#20A4C9'])),
  item('background', 'bg-lavender-field', 'rare', 1000, 'Lavendelfeld', 'Sanfter Verlauf von Lavendel zu Abendblau.', bg('gradient', ['#2E2350', '#7B6CB8', '#C9B8F2'], 120)),
  item('background', 'bg-copper-wire', 'rare', 1100, 'Kupferdraht', 'Kupferne Leiterbahnen auf dunklem Grund.', bg('pattern', ['#140D08', '#C2703D'], 0, 'circuit')),
  item('background', 'bg-teal-hex', 'rare', 1200, 'Petrolwabe', 'Waben in Petrol auf Schiefer.', bg('pattern', ['#0B1F24', '#14B8A6'], 0, 'hex')),
  item('background', 'bg-sunrise-stripes', 'rare', 1300, 'Morgenstreifen', 'Diagonale Streifen in Morgenrot.', bg('pattern', ['#2B0F1A', '#F97362'], 0, 'diagonal')),
  item('background', 'bg-arctic-waves', 'rare', 1400, 'Polarwellen', 'Eisige Wellen auf Nachtblau.', bg('pattern', ['#0A1628', '#A5D8FF'], 0, 'waves')),
  item('background', 'bg-cherry-blossom', 'epic', 2400, 'Kirschblütennacht', 'Rosa Nebel über dunklem Holz.', bg('mesh', ['#1A0F14', '#B5486B', '#F7A8C4', '#3B1F2B'])),
  item('background', 'bg-toxic-glow', 'epic', 2600, 'Giftgrün', 'Grelles Leuchten aus dem Labor.', bg('aurora', ['#06120A', '#3F7D20', '#B6F23C'])),
  item('background', 'bg-royal-velvet', 'epic', 2800, 'Königssamt', 'Tiefes Purpur mit goldenem Schimmer.', bg('mesh', ['#1A0B2E', '#5B2A86', '#C084FC', '#F5C451'])),
  item('background', 'bg-desert-dusk', 'epic', 3000, 'Wüstendämmerung', 'Dünen im letzten Licht.', bg('gradient', ['#2A1608', '#9A4A1D', '#F2B36B', '#FCE3B5'], 100)),
  item('background', 'bg-steel-grid', 'epic', 3200, 'Stahlraster', 'Kühles Raster wie in einer Werkhalle.', bg('pattern', ['#111827', '#9CA3AF'], 0, 'grid')),
  item('background', 'bg-lagoon', 'legendary', 5500, 'Lagune', 'Türkises Wasser über weißem Sand.', bg('mesh', ['#063342', '#0EA5A4', '#7FE7DA', '#F1F5D8'])),
  item('background', 'bg-firefly-forest', 'legendary', 6200, 'Glühwürmchenwald', 'Ein dunkler Wald, in dem es leise leuchtet.', bg('aurora', ['#050B07', '#1F3B1D', '#D9F99D'])),
  item('background', 'bg-solar-flare', 'legendary', 7000, 'Sonnensturm', 'Glühende Bögen auf der Sonnenoberfläche.', bg('mesh', ['#1F0500', '#B91C1C', '#F97316', '#FDE047'])),
  item('background', 'bg-galaxy-spiral', 'legendary', 8500, 'Spiralgalaxie', 'Millionen Sterne um ein helles Zentrum.', bg('pattern', ['#05031A', '#C4B5FD'], 0, 'stars')),
  item('background', 'bg-abyss', 'mythic', 9000, 'Abgrund', 'Nur auf dem Schwarzmarkt: Licht, das in der Tiefe verschwindet.', bg('mesh', ['#000000', '#0B132B', '#1C2541', '#5BC0BE']), BM),
  item('background', 'bg-gilded-hex', 'mythic', 10000, 'Vergoldete Wabe', 'Nur auf dem Schwarzmarkt: Waben aus reinem Gold.', bg('pattern', ['#0A0704', '#FFD166'], 0, 'hex'), BM),
  item('background', 'bg-pixel-night', 'epic', 2600, 'Pixelnacht', 'Retro-Jump-and-Run bei Nacht.', scene('pixel', ['#0E1033', '#4C3B8F', '#F4E7C5', '#1F4E3D'])),

  // Akzentfarben
  item('accent', 'acc-lilac', 'common', 350, 'Flieder', 'Helles, freundliches Flieder.', { color: '#C4B5FD' }),
  item('accent', 'acc-sand', 'common', 350, 'Sand', 'Warmer, heller Sandton.', { color: '#E9C99B' }),
  item('accent', 'acc-lagoon', 'common', 400, 'Lagune', 'Klares Lagunentürkis.', { color: '#2DD4BF' }),
  item('accent', 'acc-cherry', 'rare', 850, 'Kirsche', 'Saftiges Kirschrot.', { color: '#F43F5E' }),
  item('accent', 'acc-lime', 'rare', 900, 'Limette', 'Frisches Limettengrün.', { color: '#A3E635' }),
  item('accent', 'acc-copper', 'rare', 1000, 'Kupfer', 'Warmes, glänzendes Kupfer.', { color: '#D9864F' }),
  item('accent', 'acc-sapphire', 'epic', 2200, 'Saphirblau', 'Tiefes, edles Blau.', { color: '#3B82F6' }),
  item('accent', 'acc-rose-gold', 'legendary', 5200, 'Roségold', 'Zartes Gold mit rosa Schimmer.', { color: '#F2B6A0' }),

  // Namensfarben
  item('nameStyle', 'name-mint-frost', 'common', 450, 'Minzfrost', 'Kühles Mint auf deinem Namen.', { colors: ['#A7F3D0'], glow: false }),
  item('nameStyle', 'name-peach', 'common', 500, 'Pfirsich', 'Weicher Pfirsichton.', { colors: ['#FDBA8C'], glow: false }),
  item('nameStyle', 'name-lagoon', 'rare', 950, 'Lagunenverlauf', 'Von Türkis zu tiefem Blau.', { colors: ['#5EEAD4', '#0EA5E9'], glow: false }),
  item('nameStyle', 'name-cherry-blossom', 'rare', 1100, 'Kirschblüte', 'Rosa Verlauf wie Blüten im Frühling.', { colors: ['#FBCFE8', '#F472B6'], glow: false }),
  item('nameStyle', 'name-toxic', 'rare', 1300, 'Giftgrün', 'Grell leuchtendes Grün.', { colors: ['#D9F99D', '#65A30D'], glow: true }),
  item('nameStyle', 'name-lava', 'epic', 2600, 'Lava', 'Glühend von Gelb bis Tiefrot.', { colors: ['#FDE047', '#F97316', '#B91C1C'], glow: true }),
  item('nameStyle', 'name-galaxy', 'epic', 3000, 'Galaxie', 'Violett, Blau und ein Hauch Rosa.', { colors: ['#C4B5FD', '#60A5FA', '#F0ABFC'], glow: true }),
  item('nameStyle', 'name-ice-crown', 'legendary', 5800, 'Eiskrone', 'Glitzernd weiß mit eisblauem Schein.', { colors: ['#FFFFFF', '#BAE6FD', '#7DD3FC'], glow: true }),
  item('nameStyle', 'name-sunset-boulevard', 'legendary', 6400, 'Sonnenboulevard', 'Ein Sonnenuntergang über der Stadt.', { colors: ['#FDE68A', '#FB7185', '#A855F7'], glow: true }),
  item('nameStyle', 'name-abyss', 'mythic', 7500, 'Abgrundleuchten', 'Nur auf dem Schwarzmarkt: Türkis aus der Tiefe.', { colors: ['#5BC0BE', '#1C2541', '#A78BFA'], glow: true }, BM),

  // Avatar-Rahmen
  item('frame', 'frame-copper', 'common', 400, 'Kupferring', 'Schlichter Ring aus Kupfer.', { style: 'solid', colors: ['#C2703D'], width: 4 }),
  item('frame', 'frame-lilac-dashed', 'common', 450, 'Fliederstrich', 'Gestrichelt in hellem Flieder.', { style: 'dashed', colors: ['#C4B5FD'], width: 3 }),
  item('frame', 'frame-coral-reef', 'common', 550, 'Korallenriff', 'Verlauf von Koralle zu Lagune.', { style: 'gradient', colors: ['#FB7185', '#2DD4BF'], width: 4 }),
  item('frame', 'frame-ocean-double', 'rare', 1000, 'Doppelwelle', 'Zwei Ringe in Ozeanblau.', { style: 'double', colors: ['#7DD3FC', '#0369A1'], width: 5 }),
  item('frame', 'frame-cherry-blossom', 'rare', 1300, 'Kirschzweig', 'Blüten an einem dunklen Zweig.', { style: 'blossom', colors: ['#FBCFE8', '#5B3A29'], width: 5 }),
  item('frame', 'frame-neon-lime', 'rare', 1400, 'Neonlimette', 'Leuchtröhre in Limettengrün.', { style: 'neon', colors: ['#A3E635'], width: 5 }),
  item('frame', 'frame-frostfire', 'epic', 2400, 'Frostfeuer', 'Kalte Flammen in Weiß und Eisblau.', { style: 'fire', colors: ['#7DD3FC', '#F0F9FF'], width: 6 }),
  item('frame', 'frame-amethyst', 'epic', 2600, 'Amethystzacken', 'Kristalle in tiefem Violett.', { style: 'crystal', colors: ['#A78BFA', '#EDE9FE'], width: 5 }),
  item('frame', 'frame-emerald-laurel', 'epic', 2800, 'Smaragdlorbeer', 'Lorbeerzweige in Smaragd.', { style: 'laurel', colors: ['#34D399', '#065F46'], width: 5 }),
  item('frame', 'frame-thunder-gold', 'epic', 3000, 'Goldgewitter', 'Goldene Blitze rund um deinen Avatar.', { style: 'lightning', colors: ['#FDE047', '#FFFFFF'], width: 5 }),
  item('frame', 'frame-sunset-glow', 'epic', 3200, 'Abendschein', 'Weicher Schein in Abendrot.', { style: 'glow', colors: ['#FB7185', '#FDBA74'], width: 6 }),
  item('frame', 'frame-wisteria', 'legendary', 5500, 'Glyzinienranke', 'Violette Blütentrauben an einer Ranke.', { style: 'vine', colors: ['#C4B5FD', '#5B21B6'], width: 6 }),
  item('frame', 'frame-silver-crown', 'legendary', 6200, 'Silberkrone', 'Eine Krone aus kühlem Silber.', { style: 'crown', colors: ['#E5E7EB', '#9CA3AF'], width: 6 }),
  item('frame', 'frame-phoenix', 'legendary', 7500, 'Phönixfeuer', 'Flammen in Gold und Purpur.', { style: 'fire', colors: ['#F59E0B', '#C026D3'], width: 7 }),
  item('frame', 'frame-abyss-neon', 'mythic', 8500, 'Abgrundneon', 'Nur auf dem Schwarzmarkt: Neon aus der Tiefe.', { style: 'neon', colors: ['#5BC0BE'], width: 6 }, BM),
  item('frame', 'frame-obsidian-crown', 'mythic', 11000, 'Obsidiankrone', 'Nur auf dem Schwarzmarkt: eine Krone aus schwarzem Glas.', { style: 'crown', colors: ['#1F2937', '#A78BFA'], width: 7 }, BM),

  // Abzeichen
  item('badge', 'badge-anchor', 'common', 350, 'Anker', 'Fest verankert in der Community.', badge('anchor', '#7DD3FC')),
  item('badge', 'badge-feather', 'common', 400, 'Feder', 'Leicht wie eine Feder.', badge('feather', '#E9D5FF')),
  item('badge', 'badge-cherry', 'common', 450, 'Kirschen', 'Zum Anbeißen.', badge('cherry', '#F43F5E')),
  item('badge', 'badge-mic', 'common', 500, 'Mikrofon', 'Für alle, die gern reden.', badge('mic', '#CBD5E1')),
  item('badge', 'badge-chat', 'common', 500, 'Sprechblase', 'Hat immer etwas zu sagen.', badge('chat', '#93C5FD')),
  item('badge', 'badge-planet', 'rare', 900, 'Planet', 'Aus einer anderen Welt.', badge('planet', '#C4B5FD')),
  item('badge', 'badge-potion', 'rare', 950, 'Zaubertrank', 'Ein Schluck und alles ist möglich.', badge('potion', '#A78BFA')),
  item('badge', 'badge-clock', 'rare', 900, 'Pünktlich', 'Immer rechtzeitig da.', badge('clock', '#FDE68A')),
  item('badge', 'badge-dice-gold', 'rare', 1100, 'Glückswürfel', 'Würfelt immer eine Sechs.', badge('dice', '#F5C451')),
  item('badge', 'badge-pickaxe-iron', 'rare', 1000, 'Eisenhacke', 'Gräbt sich durch jede Mine.', badge('pickaxe', '#94A3B8')),
  item('badge', 'badge-fish-koi', 'epic', 2000, 'Koi', 'Ein Glücksfisch in Rot und Weiß.', badge('fish', '#FB7185')),
  item('badge', 'badge-heart-gold', 'epic', 2400, 'Goldherz', 'Ein Herz aus Gold.', badge('heart', '#F5C451')),
  item('badge', 'badge-planet-ring', 'epic', 2800, 'Ringplanet', 'Saturn hätte ihn gern.', badge('planet', '#F2A531')),
  item('badge', 'badge-anchor-gold', 'legendary', 5200, 'Goldanker', 'Für alle, die nie untergehen.', badge('anchor', '#F5C451')),
  item('badge', 'badge-phoenix-feather', 'legendary', 6000, 'Phönixfeder', 'Steigt immer wieder auf.', badge('feather', '#F97316')),
  item('badge', 'badge-void-potion', 'mythic', 4500, 'Leerentrank', 'Nur auf dem Schwarzmarkt: ein Trank aus dem Nichts.', badge('potion', '#22D3EE'), BM),

  // Titel
  item('title', 'title-nap-champion', 'common', 350, 'Nickerchen-Profi', 'Kurz die Augen zu. Nur fünf Minuten.', { text: 'Nickerchen-Profi', color: '#C4B5FD' }),
  item('title', 'title-snack-hunter', 'common', 400, 'Snackjäger', 'Weiß, wo der Kühlschrank steht.', { text: 'Snackjäger', color: '#FDBA74' }),
  item('title', 'title-gif-master', 'common', 450, 'GIF-Meister', 'Antwortet am liebsten in Bildern.', { text: 'GIF-Meister', color: '#F9A8D4' }),
  item('title', 'title-night-shift', 'common', 500, 'Nachtschicht', 'Ist um drei Uhr noch online.', { text: 'Nachtschicht', color: '#93C5FD' }),
  item('title', 'title-plant-parent', 'common', 550, 'Pflanzenmama', 'Gießt pünktlich, redet mit Farnen.', { text: 'Pflanzenmama', color: '#86EFAC' }),
  item('title', 'title-tea-time', 'common', 400, 'Teekenner', 'Hat für jede Stimmung eine Sorte.', { text: 'Teekenner', color: '#D9F99D' }),
  item('title', 'title-pet-whisperer', 'rare', 900, 'Tierflüsterer', 'Jedes Tier mag dich.', { text: 'Tierflüsterer', color: '#FDA4AF' }),
  item('title', 'title-patch-notes', 'rare', 950, 'Liest Patchnotes', 'Weiß als Erstes, was sich geändert hat.', { text: 'Liest Patchnotes', color: '#7DD3FC' }),
  item('title', 'title-loot-goblin', 'rare', 1000, 'Beutegoblin', 'Sammelt alles, was glänzt.', { text: 'Beutegoblin', color: '#BEF264' }),
  item('title', 'title-speedrunner', 'rare', 1100, 'Speedrunner', 'Kein Frame zu viel.', { text: 'Speedrunner', color: '#FDE047' }),
  item('title', 'title-respawn', 'rare', 1200, 'Kommt immer wieder', 'Respawn in drei, zwei, eins.', { text: 'Kommt immer wieder', color: '#A5B4FC' }),
  item('title', 'title-quest-giver', 'rare', 1300, 'Questgeber', 'Hat immer eine Aufgabe für dich.', { text: 'Questgeber', color: '#FCD34D' }),
  item('title', 'title-captain', 'epic', 2200, 'Kapitän', 'Steuert die Crew durch jeden Sturm.', { text: 'Kapitän', color: '#7DD3FC' }),
  item('title', 'title-alchemist', 'epic', 2400, 'Alchemist', 'Macht aus Bronze Gold.', { text: 'Alchemist', color: '#C4B5FD' }),
  item('title', 'title-stargazer', 'epic', 2600, 'Sterngucker', 'Kennt jedes Sternbild beim Namen.', { text: 'Sterngucker', color: '#E0E7FF' }),
  item('title', 'title-beast-tamer', 'epic', 2800, 'Bestienbändiger', 'Selbst Drachen fressen dir aus der Hand.', { text: 'Bestienbändiger', color: '#F59E0B' }),
  item('title', 'title-legend', 'legendary', 6000, 'Lebende Legende', 'Wird in jedem Channel erwähnt.', { text: 'Lebende Legende', color: '#FDE68A' }),
  item('title', 'title-phoenix', 'legendary', 6800, 'Phönix', 'Steigt aus jeder Asche auf.', { text: 'Phönix', color: '#FB923C' }),
  item('title', 'title-archmage', 'legendary', 7500, 'Erzmagier', 'Beherrscht jeden Zauber.', { text: 'Erzmagier', color: '#A78BFA' }),
  item('title', 'title-abyss-walker', 'mythic', 6500, 'Abgrundwanderer', 'Nur auf dem Schwarzmarkt.', { text: 'Abgrundwanderer', color: '#5BC0BE' }, BM),

  // XP-Balken
  item('xpBar', 'xp-coral', 'common', 350, 'Koralle', 'Schlichter Balken in Korallenrot.', { style: 'solid', colors: ['#FB7185'] }),
  item('xpBar', 'xp-lilac-fade', 'common', 450, 'Fliederhauch', 'Sanfter Verlauf in Flieder.', { style: 'gradient', colors: ['#C4B5FD', '#8B5CF6'] }),
  item('xpBar', 'xp-candy', 'common', 550, 'Zuckerwatte', 'Rosa und Hellblau gestreift.', { style: 'striped', colors: ['#F9A8D4', '#93C5FD'] }),
  item('xpBar', 'xp-retro-arcade', 'rare', 1100, 'Arcade', 'Pixel wie am Spielautomaten.', { style: 'pixel', colors: ['#22D3EE', '#7C3AED'] }),
  item('xpBar', 'xp-honey', 'rare', 1200, 'Honigtropfen', 'Zäh fließender Honig.', { style: 'wave', colors: ['#F59E0B', '#FDE68A'] }),
  item('xpBar', 'xp-rose-vine', 'rare', 1300, 'Rosenranke', 'Eine Ranke in Rosé.', { style: 'vine', colors: ['#FB7185', '#9F1239'] }),
  item('xpBar', 'xp-ruby-segments', 'epic', 2300, 'Rubinsegmente', 'Segmente wie geschliffene Rubine.', { style: 'segmented', colors: ['#E11D48', '#FDA4AF'] }),
  item('xpBar', 'xp-frost-flame', 'epic', 2700, 'Eisflamme', 'Kalte Flammen in Eisblau.', { style: 'flame', colors: ['#38BDF8', '#E0F2FE'] }),
  item('xpBar', 'xp-meteor', 'legendary', 6000, 'Meteor', 'Ein glühender Meteor zieht vorbei.', { style: 'comet', colors: ['#F97316', '#FDE68A'] }),
  item('xpBar', 'xp-abyss-glow', 'mythic', 5500, 'Abgrundglühen', 'Nur auf dem Schwarzmarkt.', { style: 'glow', colors: ['#5BC0BE', '#1C2541'] }, BM),

  // Effekte
  item('effect', 'effect-bubbles', 'rare', 1200, 'Seifenblasen', 'Schillernde Blasen steigen über deine Karte.', { effect: 'bubbles' }),
  item('effect', 'effect-fireflies', 'epic', 3200, 'Glühwürmchen', 'Warme Lichtpunkte, die leise leuchten.', { effect: 'fireflies' }),
  item('effect', 'effect-petals', 'epic', 2800, 'Blütenregen', 'Kirschblütenblätter im Wind.', { effect: 'petals' }),

  // Level-up-Stile
  item('levelup', 'lvl-classic-lagoon', 'common', 450, 'Lagune', 'Der klassische Aufstieg in Türkis.', { style: 'classic', color: '#2DD4BF' }),
  item('levelup', 'lvl-minimal-rose', 'common', 500, 'Rosé', 'Reduziert in zartem Rosé.', { style: 'minimal', color: '#FDA4AF' }),
  item('levelup', 'lvl-retro-lime', 'rare', 1100, 'Arcade-Grün', 'Retro-Aufstieg in Limette.', { style: 'retro', color: '#A3E635' }),
  item('levelup', 'lvl-neon-pink', 'epic', 2600, 'Neonpink', 'Leuchtröhre in Pink für jeden Aufstieg.', { style: 'neon', color: '#FF3DCB' }),
  item('levelup', 'lvl-royal-silver', 'legendary', 6000, 'Silberkrönung', 'Eine Krönung in kühlem Silber.', { style: 'royal', color: '#E5E7EB' }),

  // Sticker
  item('sticker', 'sticker-anchor', 'common', 350, 'Anker-Sticker', 'Ein Anker für die Ecke.', { glyph: 'anchor', color: '#7DD3FC', corner: 'bl' }),
  item('sticker', 'sticker-cherry', 'common', 400, 'Kirschen-Sticker', 'Zwei Kirschen am Stiel.', { glyph: 'cherry', color: '#F43F5E', corner: 'tr' }),
  item('sticker', 'sticker-feather', 'common', 450, 'Feder-Sticker', 'Eine leichte Feder.', { glyph: 'feather', color: '#E9D5FF', corner: 'tl' }),
  item('sticker', 'sticker-heart', 'common', 500, 'Herz-Sticker', 'Ein kleines Herz.', { glyph: 'heart', color: '#FB7185', corner: 'avatar' }),
  item('sticker', 'sticker-planet', 'rare', 900, 'Planeten-Sticker', 'Ein Ringplanet zieht seine Bahn.', { glyph: 'planet', color: '#C4B5FD', corner: 'tr' }),
  item('sticker', 'sticker-potion', 'rare', 1000, 'Trank-Sticker', 'Ein blubbernder Zaubertrank.', { glyph: 'potion', color: '#A78BFA', corner: 'br' }),
  item('sticker', 'sticker-star-gold', 'rare', 1100, 'Goldstern', 'Ein Stern für besondere Leistungen.', { glyph: 'star', color: '#F5C451', corner: 'avatar' }),
  item('sticker', 'sticker-rocket', 'epic', 2200, 'Raketen-Sticker', 'Abheben, bitte.', { glyph: 'rocket', color: '#F97316', corner: 'tr' }),
  item('sticker', 'sticker-diamond', 'legendary', 5000, 'Diamant-Sticker', 'Ein funkelnder Diamant.', { glyph: 'diamond', color: '#A5F3FC', corner: 'tl' }),
  item('sticker', 'sticker-void-planet', 'mythic', 3500, 'Leerenplanet', 'Nur auf dem Schwarzmarkt.', { glyph: 'planet', color: '#22D3EE', corner: 'tr' }, BM),

  // Begleiter: neue Arten und Farben
  item('pet', 'pet-bunny', 'rare', 1500, 'Hase', 'Vom Häschen zum Wolpertinger mit Geweih und Flügeln.', { species: 'bunny', color: '#E9DCCB' }),
  item('pet', 'pet-bunny-choco', 'rare', 1500, 'Schokohase', 'Ein brauner Hase auf dem Weg zum Wolpertinger.', { species: 'bunny', color: '#8B5E3C' }),
  item('pet', 'pet-frog', 'rare', 1500, 'Frosch', 'Beginnt als Kaulquappe und wird zur Donnerkröte.', { species: 'frog', color: '#5DBB63' }),
  item('pet', 'pet-cat-black', 'rare', 1500, 'Schwarze Katze', 'Eine schwarze Katze mit dem Zeug zur Nekomata.', { species: 'cat', color: '#3A3A44' }),
  item('pet', 'pet-penguin', 'epic', 3500, 'Pinguin', 'Aus dem Pinguin-Ei bis zum Eiskaiser.', { species: 'penguin', color: '#2F3A56' }),
  item('pet', 'pet-panda', 'epic', 3500, 'Panda', 'Vom Pandababy zum leuchtenden Yin-Yang-Panda.', { species: 'panda', color: '#F5F2EA' }),
  item('pet', 'pet-frog-dart', 'epic', 3500, 'Pfeilgiftfrosch', 'Ein blauer Frosch, der zur Donnerkröte heranwächst.', { species: 'frog', color: '#2E8BDB' }),
  item('pet', 'pet-fox-arctic', 'epic', 3500, 'Polarfuchs', 'Ein Polarfuchs, der zur weißen Kitsune wird.', { species: 'fox', color: '#E5E9F0' }),
  item('pet', 'pet-owl-snow', 'epic', 3500, 'Schneeeule', 'Eine Schneeeule auf dem Weg zur Sterneneule.', { species: 'owl', color: '#EDEFF2' }),
  item('pet', 'pet-penguin-emperor', 'legendary', 9000, 'Kaiserpinguin', 'Ein Kaiserpinguin, schon im Ei ein Eiskaiser.', { species: 'penguin', color: '#1F2937' }),
  item('pet', 'pet-axolotl-gold', 'legendary', 9000, 'Goldaxolotl', 'Ein goldenes Axolotl, das zum Wasserdrachen wird.', { species: 'axolotl', color: '#F5C542' }),
  item('pet', 'pet-dragon-ember', 'mythic', 12000, 'Glutdrache', 'Aus der Black-Market-Höhle: ein glühendes Drachenei.', { species: 'dragon', color: '#C2410C' }, BM),
  // Begleiter: 30 neue Arten, jede mit eigener Entwicklungslinie (shared/petArt.ts)
  item('pet', 'pet-butterfly', 'epic', 3500, 'Raupe', 'Krabbelt los und wird über Kokon und Schmetterling zum Feenfalter.', { species: 'butterfly', color: '#7C9CFF' }),
  item('pet', 'pet-chicken', 'rare', 1500, 'Hühnerei', 'Ein Ei, aus dem ein Küken, ein Huhn und zuletzt ein Phönix wird.', { species: 'chicken', color: '#F5F0E6' }),
  item('pet', 'pet-dog', 'rare', 1500, 'Welpe', 'Treu von Anfang an und am Ende ein dreiköpfiger Kerberos.', { species: 'dog', color: '#C98A4B' }),
  item('pet', 'pet-wolf', 'epic', 3500, 'Wolfswelpe', 'Wächst zum Mondwolf mit Sternenmähne heran.', { species: 'wolf', color: '#8A93A3' }),
  item('pet', 'pet-horse', 'epic', 3500, 'Fohlen', 'Vom Fohlen über das Pony zum Pegasus-Einhorn.', { species: 'horse', color: '#B07A4A' }),
  item('pet', 'pet-turtle', 'rare', 1500, 'Schildkrötenei', 'Langsam, aber sicher: am Ende trägt sie eine Insel auf dem Panzer.', { species: 'turtle', color: '#6B8E4E' }),
  item('pet', 'pet-koi', 'epic', 3500, 'Fischlaich', 'Aus dem Laich wird ein Koi und schließlich ein Drachenkoi.', { species: 'koi', color: '#F97316' }),
  item('pet', 'pet-snail', 'rare', 1500, 'Schneckenei', 'Kriecht vom Ei bis zur Kristallschnecke.', { species: 'snail', color: '#D97757' }),
  item('pet', 'pet-hedgehog', 'rare', 1500, 'Igelbaby', 'Die Stacheln werden mit der Zeit zu Kristallen.', { species: 'hedgehog', color: '#8B6B4A' }),
  item('pet', 'pet-bat', 'epic', 3500, 'Fledermausbaby', 'Erst klein und flauschig, am Ende ein Vampirfürst im Umhang.', { species: 'bat', color: '#6B5B8A' }),
  item('pet', 'pet-squirrel', 'rare', 1500, 'Eichhörnchenbaby', 'Sammelt Eicheln, bis es auf Wolken springt.', { species: 'squirrel', color: '#C2703D' }),
  item('pet', 'pet-hamster', 'rare', 1500, 'Hamsterbaby', 'Volle Backen, großes Herz: wird zum Hamsterritter.', { species: 'hamster', color: '#E9B872' }),
  item('pet', 'pet-bee', 'rare', 1500, 'Bienenlarve', 'Von der Larve über die Puppe bis zur Bienenkönigin.', { species: 'bee', color: '#FBBF24' }),
  item('pet', 'pet-octopus', 'epic', 3500, 'Krakenei', 'Aus einem kleinen Ei wird ein Kraken aus der Tiefsee.', { species: 'octopus', color: '#E26D8A' }),
  item('pet', 'pet-jellyfish', 'epic', 3500, 'Polyp', 'Vom Polyp zur Sternenqualle mit einer Galaxie im Schirm.', { species: 'jellyfish', color: '#A78BFA' }),
  item('pet', 'pet-seahorse', 'epic', 3500, 'Seepferdchen-Fohlen', 'Wird zum Fetzenfisch-Drachen mit Blattflossen.', { species: 'seahorse', color: '#F59E0B' }),
  item('pet', 'pet-crab', 'rare', 1500, 'Krabbenlarve', 'Am Ende eine Titanenkrabbe mit Kristallschere.', { species: 'crab', color: '#E5484D' }),
  item('pet', 'pet-snake', 'epic', 3500, 'Schlangenei', 'Schlüpft als Schlange und wird zur gefiederten Federschlange.', { species: 'snake', color: '#4FB477' }),
  item('pet', 'pet-chameleon', 'epic', 3500, 'Chamäleonbaby', 'Wechselt die Farbe, bis es in allen Regenbogenfarben leuchtet.', { species: 'chameleon', color: '#7ED957' }),
  item('pet', 'pet-sloth', 'epic', 3500, 'Faultierbaby', 'Ganz langsam zum Waldhüter, auf dem Moos und Blumen wachsen.', { species: 'sloth', color: '#A88B6A' }),
  item('pet', 'pet-raccoon', 'epic', 3500, 'Waschbärbaby', 'Mit Maske geboren, am Ende ein Meisterdieb mit Beute.', { species: 'raccoon', color: '#8A8F99' }),
  item('pet', 'pet-sparrow', 'rare', 1500, 'Spatzenküken', 'Ein kleiner Spatz, der zum Donnervogel wird.', { species: 'sparrow', color: '#A0764A' }),
  item('pet', 'pet-parrot', 'epic', 3500, 'Papageienküken', 'Wird zum Regenbogen-Ara in allen Farben.', { species: 'parrot', color: '#34D399' }),
  item('pet', 'pet-mushroom', 'epic', 3500, 'Spore', 'Aus einer leuchtenden Spore wächst der Myzelkönig.', { species: 'mushroom', color: '#E5484D' }),
  item('pet', 'pet-slime', 'epic', 3500, 'Schleimtropfen', 'Ein Tropfen, der zum gekrönten Königsschleim wird.', { species: 'slime', color: '#5EEAD4' }),
  item('pet', 'pet-ghost', 'epic', 3500, 'Irrlicht', 'Vom Irrlicht zum Laternengeist.', { species: 'ghost', color: '#E5E7EB' }),
  item('pet', 'pet-golem', 'legendary', 9000, 'Kiesel', 'Ein Kiesel mit Gesicht, aus dem ein Kristallgolem wird.', { species: 'golem', color: '#9CA3AF' }),
  item('pet', 'pet-salamander', 'legendary', 9000, 'Salamanderei', 'Vom Ei zum Flammenelementar.', { species: 'salamander', color: '#2B2B33' }),
  item('pet', 'pet-whale', 'legendary', 9000, 'Walbaby', 'Wächst zum Himmelswal, der durch die Wolken schwimmt.', { species: 'whale', color: '#3B82F6' }),
  item('pet', 'pet-bear', 'epic', 3500, 'Bärenjunges', 'Ein Bärenjunges, in dessen Fell eines Tages ein Sternbild leuchtet.', { species: 'bear', color: '#8B5E3C' }),

  // ---------- Themenwelten: zwölf komplette Looks, jeder als Paket ----------
  // Inferno
  item('background', 'bg-inferno', 'legendary', 6800, 'Inferno', 'Glühende Hitze in Rot und Orange.', bg('aurora', ['#120300', '#B91C1C', '#FB923C'])),
  item('frame', 'frame-inferno', 'epic', 3200, 'Höllenfeuer', 'Lodernde Flammen in tiefem Rot.', { style: 'fire', colors: ['#DC2626', '#FDBA74'], width: 6 }),
  item('nameStyle', 'name-inferno', 'epic', 2600, 'Feuersbrunst', 'Von Gelb über Orange bis Rot, mit Glut.', { colors: ['#FDE047', '#F97316', '#DC2626'], glow: true }),
  item('xpBar', 'xp-inferno', 'rare', 1300, 'Feuerspur', 'Flammen, die mit dir wachsen.', { style: 'flame', colors: ['#DC2626', '#FDBA74'] }),
  item('badge', 'badge-inferno', 'rare', 1000, 'Glutflamme', 'Brennt für die Sache.', badge('flame', '#F97316')),
  item('title', 'title-inferno', 'epic', 2400, 'Feuerteufel', 'Bringt jeden Chat zum Glühen.', { text: 'Feuerteufel', color: '#FB923C' }),
  // Galaxie
  item('background', 'bg-galaxy-core', 'legendary', 7800, 'Galaxiekern', 'Das leuchtende Herz einer Galaxie.', bg('mesh', ['#05031A', '#4C1D95', '#2563EB', '#F0ABFC'])),
  item('frame', 'frame-galaxy-ring', 'epic', 3000, 'Galaxiering', 'Schein in Violett und Türkis.', { style: 'glow', colors: ['#8B5CF6', '#22D3EE'], width: 6 }),
  item('nameStyle', 'name-nebula-drift', 'rare', 1200, 'Nebelschleier', 'Sanfter Verlauf in Violett und Rosa.', { colors: ['#C4B5FD', '#F0ABFC'], glow: false }),
  item('xpBar', 'xp-galaxy-trail', 'epic', 2800, 'Sternenschweif', 'Ein Komet in Violett und Rosa.', { style: 'comet', colors: ['#C4B5FD', '#F0ABFC'] }),
  item('badge', 'badge-supernova', 'epic', 2200, 'Supernova', 'Ein Stern kurz vor dem großen Knall.', badge('star', '#F0ABFC')),
  item('title', 'title-star-wanderer', 'rare', 1100, 'Sternenwanderer', 'Von Galaxie zu Galaxie.', { text: 'Sternenwanderer', color: '#C4B5FD' }),
  // Ozean
  item('background', 'bg-tidal', 'epic', 2600, 'Gezeiten', 'Helle Wellen auf tiefem Blau.', bg('pattern', ['#03203C', '#38BDF8'], 0, 'waves')),
  item('frame', 'frame-tidal', 'rare', 1100, 'Wellenring', 'Zwei Ringe in Hell- und Tiefseeblau.', { style: 'double', colors: ['#38BDF8', '#0C4A6E'], width: 5 }),
  item('nameStyle', 'name-tidal', 'common', 500, 'Meeresbrise', 'Frisches, helles Blau.', { colors: ['#7DD3FC'], glow: false }),
  item('xpBar', 'xp-tidal', 'rare', 1200, 'Brandung', 'Wellen, die an den Strand rollen.', { style: 'wave', colors: ['#0284C7', '#BAE6FD'] }),
  item('badge', 'badge-tide-fish', 'common', 400, 'Meeresfisch', 'Schwimmt immer mit dem Strom.', badge('fish', '#38BDF8')),
  item('title', 'title-wave-rider', 'rare', 950, 'Wellenreiter', 'Nimmt jede Welle mit.', { text: 'Wellenreiter', color: '#7DD3FC' }),
  // 8-Bit
  item('background', 'bg-arcade-grid', 'epic', 2400, 'Arcade-Raster', 'Neonraster wie im Spielautomaten.', bg('pattern', ['#0B0420', '#FF3DCB'], 0, 'grid')),
  item('frame', 'frame-pixel-dash', 'common', 450, 'Pixelrand', 'Gestrichelter Rand in Pixelgelb.', { style: 'dashed', colors: ['#FFD166'], width: 4 }),
  item('nameStyle', 'name-8bit', 'rare', 900, 'Acht Bit', 'Gelb und Rot wie ein alter Titelbildschirm.', { colors: ['#FFD166', '#E86F5B'], glow: false }),
  item('xpBar', 'xp-arcade-cherry', 'rare', 1000, 'Bonuskirsche', 'Pixel in Kirschrot und Gold.', { style: 'pixel', colors: ['#F43F5E', '#FDE68A'] }),
  item('title', 'title-highscore', 'epic', 2200, 'Highscore-Jäger', 'Steht ganz oben auf der Liste.', { text: 'Highscore-Jäger', color: '#FFD166' }),
  item('levelup', 'lvl-retro-gold', 'epic', 2400, 'Arcade-Gold', 'Retro-Aufstieg in Gold.', { style: 'retro', color: '#FFD166' }),
  // Frost
  item('background', 'bg-glacier-night', 'epic', 2800, 'Gletschernacht', 'Eisiges Leuchten über dunklem Blau.', bg('aurora', ['#020617', '#1E3A8A', '#E0F2FE'])),
  item('frame', 'frame-frost-crown', 'legendary', 6000, 'Eiskrone', 'Eine Krone aus klarem Eis.', { style: 'crown', colors: ['#E0F2FE', '#7DD3FC'], width: 6 }),
  item('nameStyle', 'name-glacier', 'rare', 1000, 'Gletscherschein', 'Eisweiß, das in Blau übergeht.', { colors: ['#E0F2FE', '#38BDF8'], glow: true }),
  item('xpBar', 'xp-frost-segments', 'rare', 1100, 'Eisblöcke', 'Segmente wie Eisblöcke.', { style: 'segmented', colors: ['#7DD3FC', '#E0F2FE'] }),
  item('badge', 'badge-ice-crystal', 'rare', 900, 'Eiskristall', 'Kalt, klar und einzigartig.', badge('snowflake', '#E0F2FE')),
  item('title', 'title-ice-king', 'legendary', 5500, 'Eiskönig', 'Herrscht über den ewigen Winter.', { text: 'Eiskönig', color: '#E0F2FE' }),
  // Dschungel
  item('background', 'bg-jungle-canopy', 'epic', 2600, 'Blätterdach', 'Licht, das durch dichtes Grün fällt.', bg('aurora', ['#04140A', '#166534', '#84CC16'])),
  item('frame', 'frame-jungle-vine', 'rare', 1300, 'Lianenring', 'Lianen, die sich um deinen Avatar ranken.', { style: 'vine', colors: ['#65A30D', '#14532D'], width: 5 }),
  item('nameStyle', 'name-jungle', 'rare', 900, 'Dschungelgrün', 'Von Limette bis Blattgrün.', { colors: ['#BEF264', '#16A34A'], glow: false }),
  item('xpBar', 'xp-liana', 'rare', 1100, 'Liane', 'Eine Liane, die mit dir wächst.', { style: 'vine', colors: ['#84CC16', '#166534'] }),
  item('badge', 'badge-jungle-leaf', 'common', 350, 'Dschungelblatt', 'Frisch aus dem Regenwald.', badge('leaf', '#84CC16')),
  item('title', 'title-jungle-child', 'common', 450, 'Dschungelkind', 'Fühlt sich im Grünen zu Hause.', { text: 'Dschungelkind', color: '#BEF264' }),
  // Retrowave
  item('background', 'bg-retrowave', 'legendary', 6500, 'Retrowave', 'Synthwave-Sonnenuntergang in Pink und Cyan.', bg('mesh', ['#1A0533', '#FF3DCB', '#33E1FF', '#FFB86B'])),
  item('frame', 'frame-retrowave', 'epic', 2600, 'Retroverlauf', 'Verlauf von Pink zu Cyan.', { style: 'gradient', colors: ['#FF3DCB', '#33E1FF'], width: 5 }),
  item('nameStyle', 'name-retrowave', 'rare', 1200, 'Abendneon', 'Pfirsich und Pink mit Schein.', { colors: ['#FFB86B', '#FF3DCB'], glow: true }),
  item('xpBar', 'xp-retrowave', 'rare', 1000, 'Neonband', 'Verlauf von Pink zu Cyan.', { style: 'gradient', colors: ['#FF3DCB', '#33E1FF'] }),
  item('title', 'title-aesthetic', 'rare', 900, 'Aesthetic', 'Alles in Pastell und Neon.', { text: 'Aesthetic', color: '#FFB86B' }),
  item('levelup', 'lvl-neon-sunset', 'epic', 2400, 'Neonabend', 'Leuchtröhre in Pfirsich.', { style: 'neon', color: '#FFB86B' }),
  // Gothic
  item('background', 'bg-gothic-velvet', 'epic', 3000, 'Dunkler Samt', 'Tiefes Weinrot, fast schwarz.', bg('mesh', ['#0A0006', '#4C0519', '#9F1239'])),
  item('frame', 'frame-thorn-crown', 'legendary', 6400, 'Dornenkrone', 'Eine Krone in Weinrot und Schwarz.', { style: 'crown', colors: ['#9F1239', '#1F2937'], width: 6 }),
  item('nameStyle', 'name-blood-moon', 'epic', 2400, 'Blutmond', 'Rosé, das in Weinrot übergeht.', { colors: ['#FB7185', '#9F1239'], glow: true }),
  item('xpBar', 'xp-crimson', 'rare', 1100, 'Karmesin', 'Leuchtendes Weinrot.', { style: 'glow', colors: ['#9F1239', '#FB7185'] }),
  item('badge', 'badge-raven-skull', 'rare', 1000, 'Rabenschädel', 'Für alle, die die Nacht lieben.', badge('skull', '#9F1239')),
  item('title', 'title-night-lord', 'epic', 2600, 'Nachtfürst', 'Erwacht, wenn die Sonne untergeht.', { text: 'Nachtfürst', color: '#FB7185' }),
  // Candy
  item('background', 'bg-candy-dots', 'common', 500, 'Zuckerperlen', 'Rosa Perlen auf dunklem Beerenrot.', bg('pattern', ['#3B0A2A', '#F9A8D4'], 0, 'dots')),
  item('frame', 'frame-candy-blossom', 'rare', 1100, 'Zuckerblüten', 'Rosa Blüten an einem Beerenzweig.', { style: 'blossom', colors: ['#F9A8D4', '#BE185D'], width: 5 }),
  item('nameStyle', 'name-candy', 'common', 450, 'Bonbon', 'Rosa, das in Flieder übergeht.', { colors: ['#F9A8D4', '#C4B5FD'], glow: false }),
  item('xpBar', 'xp-candy-swirl', 'rare', 1000, 'Lutscherstreifen', 'Pink und Weiß wie ein Lutscher.', { style: 'striped', colors: ['#F472B6', '#FDF2F8'] }),
  item('badge', 'badge-candy-heart', 'common', 400, 'Zuckerherz', 'Ein Herz aus Zucker.', badge('heart', '#F9A8D4')),
  item('title', 'title-sweet-tooth', 'common', 500, 'Zuckerschnute', 'Kann zu Süßem nicht Nein sagen.', { text: 'Zuckerschnute', color: '#F9A8D4' }),
  // Steampunk
  item('background', 'bg-brass-hex', 'epic', 2600, 'Messingwabe', 'Messingwaben auf dunklem Holz.', bg('pattern', ['#1C1206', '#B8860B'], 0, 'hex')),
  item('frame', 'frame-brass-double', 'rare', 1200, 'Messingfassung', 'Doppelte Fassung in Messing.', { style: 'double', colors: ['#D4A257', '#7A4A1A'], width: 5 }),
  item('nameStyle', 'name-brass', 'rare', 1000, 'Messingglanz', 'Polierter Verlauf in Messing.', { colors: ['#E9C46A', '#B5651D'], glow: false }),
  item('xpBar', 'xp-gearwork', 'epic', 2200, 'Uhrwerk', 'Segmente wie die Zähne eines Zahnrads.', { style: 'segmented', colors: ['#B8860B', '#E9C46A'] }),
  item('badge', 'badge-brass-clock', 'rare', 950, 'Taschenuhr', 'Tickt immer richtig.', badge('clock', '#D4A257')),
  item('title', 'title-tinkerer', 'rare', 900, 'Tüftler', 'Baut aus allem etwas Neues.', { text: 'Tüftler', color: '#E9C46A' }),
  // Arkan
  item('background', 'bg-arcane-mist', 'epic', 3000, 'Arkannebel', 'Violetter Nebel mit türkisem Schimmer.', bg('mesh', ['#0B0620', '#5B21B6', '#06B6D4'])),
  item('frame', 'frame-arcane-storm', 'epic', 2800, 'Arkanblitz', 'Knisternde Magie in Violett und Türkis.', { style: 'lightning', colors: ['#A78BFA', '#67E8F9'], width: 5 }),
  item('nameStyle', 'name-arcane', 'rare', 1200, 'Arkanschein', 'Violett, das in Türkis übergeht, mit Schein.', { colors: ['#A78BFA', '#67E8F9'], glow: true }),
  item('xpBar', 'xp-arcane-flow', 'rare', 1300, 'Manafluss', 'Fließende Magie in Violett.', { style: 'wave', colors: ['#7C3AED', '#67E8F9'] }),
  item('badge', 'badge-rune-star', 'rare', 900, 'Runenstern', 'Ein Stern aus alter Magie.', badge('star', '#A78BFA')),
  item('title', 'title-rune-reader', 'epic', 2200, 'Runenleser', 'Versteht, was auf alten Steinen steht.', { text: 'Runenleser', color: '#67E8F9' }),
  // Gewitter
  item('background', 'bg-thunderhead', 'epic', 2800, 'Gewitterfront', 'Dunkle Wolken mit hellem Rand.', bg('aurora', ['#0B1120', '#334155', '#93C5FD'])),
  item('frame', 'frame-stormcloud', 'rare', 1200, 'Sturmring', 'Blitze in Hellblau und Weiß.', { style: 'lightning', colors: ['#93C5FD', '#FFFFFF'], width: 5 }),
  item('nameStyle', 'name-storm', 'rare', 1000, 'Sturmlicht', 'Weiß, das in Blau übergeht, mit Schein.', { colors: ['#E0E7FF', '#60A5FA'], glow: true }),
  item('xpBar', 'xp-voltage', 'epic', 2400, 'Hochspannung', 'Elektrisches Leuchten in Blau und Gelb.', { style: 'glow', colors: ['#60A5FA', '#FDE047'] }),
  item('badge', 'badge-storm-bolt', 'common', 450, 'Sturmblitz', 'Schlägt ein, wenn man es nicht erwartet.', badge('bolt', '#93C5FD')),
  item('title', 'title-storm-caller', 'legendary', 5800, 'Sturmrufer', 'Ruft das Gewitter herbei.', { text: 'Sturmrufer', color: '#93C5FD' }),
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
  { id: 'bundle-lagoon', name: 'Lagunen-Paket', description: 'Türkises Wasser, Blasen und ein Anker im Sand.',
    itemIds: ['bg-lagoon', 'name-lagoon', 'frame-ocean-double', 'effect-bubbles', 'badge-anchor', 'acc-lagoon'] },
  { id: 'bundle-cherry-blossom', name: 'Kirschblüten-Paket', description: 'Rosa Nebel, Blütenregen und ein Zweig voller Blüten.',
    itemIds: ['bg-cherry-blossom', 'frame-cherry-blossom', 'name-cherry-blossom', 'effect-petals', 'sticker-cherry'] },
  { id: 'bundle-alchemy', name: 'Alchemie-Paket', description: 'Tränke, Amethyst und ein Titel für Goldmacher.',
    itemIds: ['bg-royal-velvet', 'frame-amethyst', 'badge-potion', 'sticker-potion', 'title-alchemist', 'xp-lilac-fade'] },
  { id: 'bundle-phoenix', name: 'Phönix-Paket', description: 'Feuer in Gold und Purpur, das immer wieder aufsteigt.',
    itemIds: ['bg-solar-flare', 'frame-phoenix', 'name-lava', 'badge-phoenix-feather', 'title-phoenix', 'xp-meteor'] },
  { id: 'bundle-firefly', name: 'Glühwürmchen-Paket', description: 'Ein dunkler Wald, in dem es leise leuchtet.',
    itemIds: ['bg-firefly-forest', 'effect-fireflies', 'name-toxic', 'frame-neon-lime', 'acc-lime'] },
  { id: 'bundle-dungeon', name: 'Dungeon-Paket', description: 'Fackeln an, Schild hoch – der Raid kann beginnen.',
    itemIds: ['bg-dungeon-torches', 'frame-torchlight', 'title-dungeon-master', 'badge-guardian'] },
  { id: 'bundle-inferno', name: 'Inferno-Paket', description: 'Lodernde Flammen von Hintergrund bis Titel.',
    itemIds: ['bg-inferno', 'frame-inferno', 'name-inferno', 'xp-inferno', 'badge-inferno', 'title-inferno'] },
  { id: 'bundle-galaxy', name: 'Galaxie-Paket', description: 'Nebel, Sterne und ein Komet auf deinem Balken.',
    itemIds: ['bg-galaxy-core', 'frame-galaxy-ring', 'name-nebula-drift', 'xp-galaxy-trail', 'badge-supernova', 'title-star-wanderer', 'effect-stardust'] },
  { id: 'bundle-ocean', name: 'Ozean-Paket', description: 'Wellen, Blasen und ein Fisch für die Ecke.',
    itemIds: ['bg-tidal', 'frame-tidal', 'name-tidal', 'xp-tidal', 'badge-tide-fish', 'title-wave-rider', 'effect-bubbles'] },
  { id: 'bundle-8bit', name: '8-Bit-Paket', description: 'Arcade-Raster, Pixelbalken und ein Highscore.',
    itemIds: ['bg-arcade-grid', 'frame-pixel-dash', 'name-8bit', 'xp-arcade-cherry', 'title-highscore', 'lvl-retro-gold', 'sticker-dice'] },
  { id: 'bundle-frost', name: 'Frost-Paket', description: 'Gletscherlicht und eine Krone aus Eis.',
    itemIds: ['bg-glacier-night', 'frame-frost-crown', 'name-glacier', 'xp-frost-segments', 'badge-ice-crystal', 'title-ice-king'] },
  { id: 'bundle-jungle', name: 'Dschungel-Paket', description: 'Dichtes Grün, Lianen und viel Leben.',
    itemIds: ['bg-jungle-canopy', 'frame-jungle-vine', 'name-jungle', 'xp-liana', 'badge-jungle-leaf', 'title-jungle-child', 'effect-fireflies'] },
  { id: 'bundle-retrowave', name: 'Retrowave-Paket', description: 'Pink, Cyan und ein Sonnenuntergang aus den Achtzigern.',
    itemIds: ['bg-retrowave', 'frame-retrowave', 'name-retrowave', 'xp-retrowave', 'title-aesthetic', 'lvl-neon-sunset', 'effect-scanlines'] },
  { id: 'bundle-gothic', name: 'Gothic-Paket', description: 'Dunkler Samt, Dornen und ein Blutmond.',
    itemIds: ['bg-gothic-velvet', 'frame-thorn-crown', 'name-blood-moon', 'xp-crimson', 'badge-raven-skull', 'title-night-lord'] },
  { id: 'bundle-candy', name: 'Candy-Paket', description: 'Rosa, süß und ein bisschen klebrig.',
    itemIds: ['bg-candy-dots', 'frame-candy-blossom', 'name-candy', 'xp-candy-swirl', 'badge-candy-heart', 'title-sweet-tooth', 'sticker-cherry'] },
  { id: 'bundle-steampunk', name: 'Steampunk-Paket', description: 'Messing, Zahnräder und eine Uhr, die nie stehen bleibt.',
    itemIds: ['bg-brass-hex', 'frame-brass-double', 'name-brass', 'xp-gearwork', 'badge-brass-clock', 'title-tinkerer'] },
  { id: 'bundle-arcane', name: 'Arkan-Paket', description: 'Magischer Nebel, Runen und knisternde Energie.',
    itemIds: ['bg-arcane-mist', 'frame-arcane-storm', 'name-arcane', 'xp-arcane-flow', 'badge-rune-star', 'title-rune-reader', 'effect-sparkles'] },
  { id: 'bundle-storm', name: 'Gewitter-Paket', description: 'Dunkle Wolken, Blitze und Spannung auf dem Balken.',
    itemIds: ['bg-thunderhead', 'frame-stormcloud', 'name-storm', 'xp-voltage', 'badge-storm-bolt', 'title-storm-caller'] },
];

// ---------- Owner input validation ----------

const AVAILABILITIES: ItemAvailability[] = ['shop', 'blackmarket', 'event', 'achievement', 'ranking', 'season'];

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
      style: oneOf(d.style, FRAME_STYLES, 'Stil'),
      colors: colors(d.colors, 'Farben', 3),
      width: int(d.width, 'Breite', 1, 12),
    };
    case 'badge': return { glyph: oneOf(d.glyph, BADGE_GLYPHS, 'Symbol'), color: hexColor(d.color, 'Farbe') };
    case 'title': return { text: str(d.text, 'Titeltext', { min: 1, max: 32 }), color: hexColor(d.color, 'Farbe') };
    case 'xpBar': return { style: oneOf(d.style, XP_BAR_STYLES, 'Stil'), colors: colors(d.colors, 'Farben', 3) };
    case 'font': return { font: oneOf(d.font, ['inter', 'unbounded', 'caveat'] as const, 'Schrift') };
    case 'effect': return { effect: oneOf(d.effect, EFFECTS, 'Effekt') };
    case 'levelup': return { style: oneOf(d.style, ['classic', 'minimal', 'neon', 'royal', 'retro'] as const, 'Stil'), color: hexColor(d.color, 'Farbe') };
    case 'layout': return { layout: oneOf(d.layout, CARD_LAYOUTS, 'Layout') };
    case 'sticker': return {
      glyph: oneOf(d.glyph, BADGE_GLYPHS, 'Symbol'),
      color: hexColor(d.color, 'Farbe'),
      corner: oneOf(d.corner, STICKER_SPOTS, 'Ecke'),
    };
    case 'pet': return { species: oneOf(d.species, PET_SPECIES, 'Tier'), color: hexColor(d.color, 'Farbe') };
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
