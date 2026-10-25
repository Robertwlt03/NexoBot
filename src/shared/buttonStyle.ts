// Button colour by action and emoji-free labels, shared by the bot (utils/buttonColors.ts) and the dashboard
// Storybook (Discord previews). No discord.js here, so it also runs in the browser.

/** German stems and English words (labels and customId parts) per colour; danger wins over success. */
const DANGER_STEMS = ['lösch', 'entfern', 'beend', 'schließ', 'schliess', 'ablehn', 'abbrech', 'verwerf', 'stopp', 'sperr', 'verlass', 'kick', 'bann'];
const DANGER_WORDS = new Set(['delete', 'remove', 'close', 'decline', 'cancel', 'deny', 'reject', 'end', 'stop', 'ban', 'leave', 'clear', 'reset', 'trash']);
const SUCCESS_STEMS = ['annehm', 'bestätig', 'speicher', 'teilnehm', 'beitret', 'abhol', 'kauf', 'übernehm', 'erstell', 'verifizier', 'akzeptier', 'hinzufüg', 'aktivier', 'öffn', 'freischalt'];
const SUCCESS_WORDS = new Set(['ja', 'los', 'accept', 'confirm', 'save', 'join', 'claim', 'create', 'verify', 'approve', 'yes', 'open', 'submit', 'add', 'enable', 'start', 'buy']);

export type ActionColour = 'danger' | 'success' | 'primary';

/** The colour a grey button gets from its label and customId. */
export function actionColour(label = '', customId = ''): ActionColour {
  const words = `${label} ${customId}`.toLowerCase().split(/[^a-z0-9äöüß]+/).filter(Boolean);
  const matches = (stems: string[], exact: Set<string>) => words.some((word) => exact.has(word) || stems.some((stem) => word.startsWith(stem)));
  if (matches(DANGER_STEMS, DANGER_WORDS)) return 'danger';
  if (matches(SUCCESS_STEMS, SUCCESS_WORDS)) return 'success';
  return 'primary';
}

const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/gu;
/** The label without emojis; null when nothing else is left. */
export function plainLabel(label: string): string | null {
  return label.replace(EMOJI, '').replace(/\s+/g, ' ').trim() || null;
}
