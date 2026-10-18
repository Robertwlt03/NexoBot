// Voice minutes for the dashboard statistics (services/statsTracker.ts); separate from voiceStateUpdate.ts,
// which returns early for guilds without Join-to-Create.
import { Events } from 'discord.js';
import { recordVoiceState } from '../services/statsTracker.js';
import type { BotEvent } from '../types/index.js';

export default {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState) {
    recordVoiceState(oldState, newState);
  },
} satisfies BotEvent<Events.VoiceStateUpdate>;
