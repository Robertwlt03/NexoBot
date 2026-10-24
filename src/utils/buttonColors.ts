// No grey buttons: every Secondary button gets a colour by what it does when it is serialised – red for removing,
// ending and declining, green for confirming, saving and joining, blurple for everything else. customIds stay as
// they are. Link buttons cannot be coloured (Discord always draws them grey); set colours stay untouched.

import { ButtonBuilder, ButtonStyle } from 'discord.js';

/** German stems and English words (labels and customId parts) per colour; danger wins over success. */
const DANGER_STEMS = ['lösch', 'entfern', 'beend', 'schließ', 'schliess', 'ablehn', 'abbrech', 'verwerf', 'stopp', 'sperr', 'verlass', 'kick', 'bann'];
const DANGER_WORDS = new Set(['delete', 'remove', 'close', 'decline', 'cancel', 'deny', 'reject', 'end', 'stop', 'ban', 'leave', 'clear', 'reset', 'trash']);
const SUCCESS_STEMS = ['annehm', 'bestätig', 'speicher', 'teilnehm', 'beitret', 'abhol', 'kauf', 'übernehm', 'erstell', 'verifizier', 'akzeptier', 'hinzufüg', 'aktivier', 'öffn', 'freischalt'];
const SUCCESS_WORDS = new Set(['ja', 'los', 'accept', 'confirm', 'save', 'join', 'claim', 'create', 'verify', 'approve', 'yes', 'open', 'submit', 'add', 'enable', 'start', 'buy']);

/** The colour a grey button gets from its label and customId. Pure, for tests. */
export function actionStyle(label = '', customId = ''): ButtonStyle {
  const words = `${label} ${customId}`.toLowerCase().split(/[^a-z0-9äöüß]+/).filter(Boolean);
  const matches = (stems: string[], exact: Set<string>) => words.some((word) => exact.has(word) || stems.some((stem) => word.startsWith(stem)));
  if (matches(DANGER_STEMS, DANGER_WORDS)) return ButtonStyle.Danger;
  if (matches(SUCCESS_STEMS, SUCCESS_WORDS)) return ButtonStyle.Success;
  return ButtonStyle.Primary;
}

const originalToJSON = ButtonBuilder.prototype.toJSON;
ButtonBuilder.prototype.toJSON = function colouredToJSON(this: ButtonBuilder) {
  const json = originalToJSON.call(this);
  if (json.style !== ButtonStyle.Secondary) return json;
  return { ...json, style: actionStyle(json.label, 'custom_id' in json ? json.custom_id : '') } as typeof json;
};
