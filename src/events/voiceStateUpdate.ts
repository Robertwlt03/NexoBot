import { logger } from '../utils/logger.js';
import { handleMusicVoiceState } from '../services/music/musicVoiceState.js';
import { handleVoiceStateUpdate } from '../services/jointocreate/jointocreate.js';
import type { BotEvent } from '../types/index.js';

export default {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        await handleVoiceStateUpdate(client, oldState, newState)
            .catch((error) => logger.error(`Error in voiceStateUpdate for guild ${newState.guild.id}:`, error));

        if (client.config?.features?.music) {
            handleMusicVoiceState(client, oldState, newState).catch((error) => {
                logger.error('Music voice state handler error:', error);
            });
        }
    }
} satisfies BotEvent<'voiceStateUpdate'>;
