// giveaways.js

import { logger } from './logger.js';
import { NexoBotError, ErrorTypes } from './errorHandler.js';
import { unwrapReplitData } from './database/guildConfigStorage.js';
import type { NexoClient } from '../types/index.js';

/** Stored giveaway record (`guild:{guildId}:giveaways`, keyed by messageId). */
export interface Giveaway {
    messageId: string;
    channelId?: string;
    guildId?: string | null;
    prize?: string;
    hostId?: string;
    endTime?: number;
    endsAt?: number;
    winnerCount?: number;
    participants?: string[];
    winnerIds?: string[];
    isEnded?: boolean;
    ended?: boolean;
    createdAt?: string;
    [key: string]: unknown;
}

export function giveawayKey(guildId: string): string {
    return `guild:${guildId}:giveaways`;
}

function arrayToGiveawayMap(giveaways: Giveaway[]): Record<string, Giveaway> {
    const map: Record<string, Giveaway> = {};
    if (Array.isArray(giveaways)) {
        for (const giveaway of giveaways) {
            if (giveaway && giveaway.messageId) {
                map[giveaway.messageId] = giveaway;
            }
        }
    }
    return map;
}

export async function getGuildGiveaways(client: NexoClient, guildId: string): Promise<Giveaway[]> {
    try {
        if (!client.db) {
            logger.warn('Database not available for getGuildGiveaways');
            return [];
        }

        const key = giveawayKey(guildId);
        const giveaways = await client.db.get(key, {});
        const unwrappedGiveaways: unknown = unwrapReplitData(giveaways);

        if (typeof unwrappedGiveaways === 'object' && !Array.isArray(unwrappedGiveaways)) {
            return Object.values(unwrappedGiveaways || {}) as Giveaway[];
        }
        return Array.isArray(unwrappedGiveaways) ? unwrappedGiveaways as Giveaway[] : [];
    } catch (error) {
        logger.error(`Error getting giveaways for guild ${guildId}:`, error);
        return [];
    }
}

export async function saveGiveaway(client: NexoClient, guildId: string, giveawayData: Giveaway): Promise<boolean> {
    try {
        if (!client.db) {
            logger.warn('Database not available for saveGiveaway');
            return false;
        }

        if (!giveawayData || !giveawayData.messageId) {
            throw new NexoBotError(
                'Invalid giveaway data: missing messageId',
                ErrorTypes.VALIDATION,
                'Ein Giveaway kann ohne Nachrichten-ID nicht gespeichert werden.',
                { giveawayData }
            );
        }

        const key = giveawayKey(guildId);
        const giveaways = await getGuildGiveaways(client, guildId);

        const giveawayMap = arrayToGiveawayMap(giveaways);
        giveawayMap[giveawayData.messageId] = giveawayData;
        
        await client.db.set(key, giveawayMap);
        
        logger.debug(`Saved giveaway ${giveawayData.messageId} in guild ${guildId}`);
        return true;
    } catch (error) {
        logger.error(`Error saving giveaway in guild ${guildId}:`, error);
        if (error instanceof NexoBotError) {
            throw error;
        }
        return false;
    }
}

export async function deleteGiveaway(client: NexoClient, guildId: string, messageId: string): Promise<boolean> {
    try {
        if (!client.db) {
            logger.warn('Database not available for deleteGiveaway');
            return false;
        }

        if (!messageId) {
            throw new NexoBotError(
                'Missing messageId parameter',
                ErrorTypes.VALIDATION,
                'Ein Giveaway kann ohne Nachrichten-ID nicht gelöscht werden.',
                { messageId }
            );
        }

        const key = giveawayKey(guildId);
        const giveaways = await getGuildGiveaways(client, guildId);

        const giveawayMap = arrayToGiveawayMap(giveaways);
        
        if (!giveawayMap[messageId]) {
            logger.debug(`Giveaway not found for deletion: ${messageId} in guild ${guildId}`);
            return false;
        }
        
        delete giveawayMap[messageId];
        await client.db.set(key, giveawayMap);
        
        logger.debug(`Deleted giveaway ${messageId} from guild ${guildId}`);
        return true;
    } catch (error) {
        logger.error(`Error deleting giveaway ${messageId} in guild ${guildId}:`, error);
        if (error instanceof NexoBotError) {
            throw error;
        }
        return false;
    }
}

export function isGiveawayEnded(giveaway: Giveaway | null | undefined): boolean {
    if (!giveaway) return true;
    const endTime = giveaway.endsAt || giveaway.endTime;
    return Date.now() > endTime!;
}