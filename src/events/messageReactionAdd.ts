// Reactions given, for the achievements (services/cosmetics/activity.ts). Without partials only reactions on
// messages the bot has cached count, which covers the live chat.
import { Events } from 'discord.js';
import { addActivity } from '../services/cosmetics/activity.js';
import type { BotEvent } from '../types/index.js';

export default {
  name: Events.MessageReactionAdd,
  execute(_reaction, user) {
    if (!user.bot) addActivity(user.id, 'reactions');
  },
} satisfies BotEvent<Events.MessageReactionAdd>;
