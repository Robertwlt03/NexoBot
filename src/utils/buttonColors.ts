// No grey buttons: every Secondary button gets a colour by what it does when it is serialised – red for removing,
// ending and declining, green for confirming, saving and joining, blurple for everything else. customIds stay as
// they are. Link buttons cannot be coloured (Discord always draws them grey); set colours stay untouched.
// Only link buttons keep emojis; on every other button they are dropped from the label and the emoji slot.

import { ButtonBuilder, ButtonStyle } from 'discord.js';

import { actionColour, plainLabel } from '../shared/buttonStyle.js';

export { plainLabel };

const STYLES = { danger: ButtonStyle.Danger, success: ButtonStyle.Success, primary: ButtonStyle.Primary } as const;
/** The colour a grey button gets from its label and customId. Pure, for tests. */
export function actionStyle(label = '', customId = ''): ButtonStyle {
  return STYLES[actionColour(label, customId)];
}

const originalToJSON = ButtonBuilder.prototype.toJSON;
ButtonBuilder.prototype.toJSON = function colouredToJSON(this: ButtonBuilder) {
  let json = originalToJSON.call(this);
  if (json.style === ButtonStyle.Link || json.style === ButtonStyle.Premium) return json;
  // A button that is only an emoji keeps it, Discord needs a label or an emoji.
  const label = json.label ? plainLabel(json.label) : null;
  if (label) {
    const { emoji: _emoji, ...rest } = json;
    json = { ...rest, label } as typeof json;
  }
  if (json.style !== ButtonStyle.Secondary) return json;
  return { ...json, style: actionStyle(json.label, 'custom_id' in json ? json.custom_id : '') } as typeof json;
};
