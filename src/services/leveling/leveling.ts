// Leveling service: the only entry point controllers (commands, events, web routes) use for leveling data.
// Pure rules live in core.ts, storage in store.ts, Discord messages in views.ts.

import type { NexoClient } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { NexoBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { MAX_LEVEL, MIN_LEVEL, calculateTotalXp, defaultLevelingConfig, normalizeLevelData } from './core.js';
import type { GuildLevelingConfig, LevelData } from './core.js';
import * as store from './store.js';

export { MAX_LEVEL, calculateTotalXp, getXpForLevel } from './core.js';
export type { GuildLevelingConfig, LevelData } from './core.js';
export { readMemberLevels as getMemberLevels, readMemberGuildIds as getMemberGuildIds } from './store.js';

export interface LeaderboardEntry extends store.LeaderboardRow {
  rank: number;
}

/** The guild's top `limit` (1–100) members by total XP, ranked from 1. */
export async function getLeaderboard(client: NexoClient, guildId: string, limit = 10): Promise<LeaderboardEntry[]> {
  try {
    if (!guildId || typeof guildId !== 'string') {
      throw new NexoBotError(
        'Invalid guild ID',
        ErrorTypes.VALIDATION,
        'Eine Server-ID ist erforderlich.'
      );
    }

    const rows = await store.readLeaderboard(client, guildId, Math.min(Math.max(Math.floor(limit) || 1, 1), 100));
    return rows.map((row, index) => ({ ...row, rank: index + 1 }));
  } catch (error) {
    logger.error('Error getting leaderboard:', error);
    if (error instanceof NexoBotError) throw error;
    throw new NexoBotError(
      `Failed to fetch leaderboard: ${error instanceof Error ? error.message : String(error)}`,
      ErrorTypes.DATABASE,
      'Die Bestenliste konnte gerade nicht geladen werden.'
    );
  }
}

/** The member's position in the leaderboard order, or null when they have no XP (errors count as null). */
export async function getRank(client: NexoClient, guildId: string, userId: string): Promise<number | null> {
  return store.readRank(client, guildId, userId).catch((error) => {
    logger.warn(`Could not read rank of ${userId} in guild ${guildId}:`, error);
    return null;
  });
}

export async function getLevelingConfig(client: NexoClient, guildId: string): Promise<GuildLevelingConfig> {
  try {
    return (await store.readLevelingConfig(client, guildId)) || defaultLevelingConfig();
  } catch (error) {
    logger.error(`Error getting leveling config for guild ${guildId}:`, error);
    return defaultLevelingConfig();
  }
}

export async function getUserLevelData(client: NexoClient, guildId: string, userId: string): Promise<LevelData> {
  try {
    if (!guildId || !userId) {
      throw new NexoBotError(
        'Guild ID and User ID are required',
        ErrorTypes.VALIDATION
      );
    }

    return normalizeLevelData(await store.readUserLevel(client, guildId, userId));
  } catch (error) {
    logger.error(`Error getting user level data for ${userId}:`, error);
    if (error instanceof NexoBotError) throw error;
    throw new NexoBotError(
      `Failed to fetch user data: ${error instanceof Error ? error.message : String(error)}`,
      ErrorTypes.DATABASE,
      'Die Level-Daten konnten gerade nicht geladen werden.'
    );
  }
}

export async function saveUserLevelData(client: NexoClient, guildId: string, userId: string, data: LevelData): Promise<void> {
  try {
    if (!guildId || !userId) {
      throw new NexoBotError(
        'Guild ID and User ID are required',
        ErrorTypes.VALIDATION
      );
    }

    if (!data || typeof data !== 'object') {
      throw new NexoBotError(
        'Invalid user level data',
        ErrorTypes.VALIDATION
      );
    }

    await store.writeUserLevel(client, guildId, userId, normalizeLevelData(data));
  } catch (error) {
    logger.error(`Error saving user level data for ${userId}:`, error);
    if (error instanceof NexoBotError) throw error;
    throw new NexoBotError(
      `Failed to save user data: ${error instanceof Error ? error.message : String(error)}`,
      ErrorTypes.DATABASE,
      'Die Level-Daten konnten gerade nicht gespeichert werden.'
    );
  }
}

export async function saveLevelingConfig(client: NexoClient, guildId: string, config: GuildLevelingConfig): Promise<void> {
  try {
    if (!guildId || !config) {
      throw new NexoBotError(
        'Guild ID and config are required',
        ErrorTypes.VALIDATION
      );
    }

    if (config.xpCooldown && (config.xpCooldown < 0 || config.xpCooldown > 3600)) {
      throw new NexoBotError(
        'XP cooldown must be between 0 and 3600 seconds',
        ErrorTypes.VALIDATION,
        'Der Cooldown muss zwischen 0 und 3600 Sekunden liegen.'
      );
    }

    if (config.xpRange && (config.xpRange.min < 1 || config.xpRange.max < 1 || config.xpRange.min > config.xpRange.max)) {
      throw new NexoBotError(
        'Invalid XP range configuration',
        ErrorTypes.VALIDATION,
        'Die minimalen XP müssen kleiner als die maximalen XP sein, und beide müssen positiv sein.'
      );
    }

    await store.writeLevelingConfig(client, guildId, config);
    
    logger.info(`Leveling config updated for guild ${guildId}`);
  } catch (error) {
    logger.error(`Error saving leveling config for guild ${guildId}:`, error);
    if (error instanceof NexoBotError) throw error;
    throw new NexoBotError(
      `Failed to save config: ${error instanceof Error ? error.message : String(error)}`,
      ErrorTypes.DATABASE,
      'Die Konfiguration konnte gerade nicht gespeichert werden.'
    );
  }
}

export async function addLevels(client: NexoClient, guildId: string, userId: string, levels: number): Promise<LevelData> {
  try {
    const levelingConfig = await getLevelingConfig(client, guildId);
    if (!levelingConfig?.enabled) {
      throw new NexoBotError(
        'Leveling system is disabled on this server',
        ErrorTypes.CONFIGURATION,
        'Das Levelsystem ist auf diesem Server derzeit deaktiviert.'
      );
    }

    if (!Number.isInteger(levels) || levels <= 0) {
      throw new NexoBotError(
        `Invalid level amount: ${levels}`,
        ErrorTypes.VALIDATION,
        'Du musst eine positive Anzahl an Leveln hinzufügen.'
      );
    }

    const userData = await getUserLevelData(client, guildId, userId);
    const newLevel = userData.level + levels;

    if (newLevel > MAX_LEVEL) {
      throw new NexoBotError(
        `Level ${newLevel} exceeds maximum level ${MAX_LEVEL}`,
        ErrorTypes.VALIDATION,
        `Das maximale Level ist ${MAX_LEVEL}.`
      );
    }

    const newXp = 0;
    const newTotalXp = calculateTotalXp(newLevel, newXp);

    userData.level = newLevel;
    userData.xp = newXp;
    userData.totalXp = newTotalXp;

    await saveUserLevelData(client, guildId, userId, userData);
    
    logger.info(`Added ${levels} levels to user ${userId} in guild ${guildId}`);
    return userData;
  } catch (error) {
    logger.error(`Error adding levels for user ${userId}:`, error);
    if (error instanceof NexoBotError) throw error;
    throw new NexoBotError(
      `Failed to add levels: ${error instanceof Error ? error.message : String(error)}`,
      ErrorTypes.DATABASE,
      'Level konnten gerade nicht hinzugefügt werden.'
    );
  }
}

export async function removeLevels(client: NexoClient, guildId: string, userId: string, levels: number): Promise<LevelData> {
  try {
    const levelingConfig = await getLevelingConfig(client, guildId);
    if (!levelingConfig?.enabled) {
      throw new NexoBotError(
        'Leveling system is disabled on this server',
        ErrorTypes.CONFIGURATION,
        'Das Levelsystem ist auf diesem Server derzeit deaktiviert.'
      );
    }

    if (!Number.isInteger(levels) || levels <= 0) {
      throw new NexoBotError(
        `Invalid level amount: ${levels}`,
        ErrorTypes.VALIDATION,
        'Du musst eine positive Anzahl an Leveln entfernen.'
      );
    }

    const userData = await getUserLevelData(client, guildId, userId);
    const newLevel = Math.max(MIN_LEVEL, userData.level - levels);

    const newXp = 0;
    const newTotalXp = calculateTotalXp(newLevel, newXp);

    userData.level = newLevel;
    userData.xp = newXp;
    userData.totalXp = newTotalXp;

    await saveUserLevelData(client, guildId, userId, userData);
    
    logger.info(`Removed ${levels} levels from user ${userId} in guild ${guildId}`);
    return userData;
  } catch (error) {
    logger.error(`Error removing levels for user ${userId}:`, error);
    if (error instanceof NexoBotError) throw error;
    throw new NexoBotError(
      `Failed to remove levels: ${error instanceof Error ? error.message : String(error)}`,
      ErrorTypes.DATABASE,
      'Level konnten gerade nicht entfernt werden.'
    );
  }
}

export async function setUserLevel(client: NexoClient, guildId: string, userId: string, level: number): Promise<LevelData> {
  try {
    const levelingConfig = await getLevelingConfig(client, guildId);
    if (!levelingConfig?.enabled) {
      throw new NexoBotError(
        'Leveling system is disabled on this server',
        ErrorTypes.CONFIGURATION,
        'Das Levelsystem ist auf diesem Server derzeit deaktiviert.'
      );
    }

    if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
      throw new NexoBotError(
        `Invalid level: ${level}`,
        ErrorTypes.VALIDATION,
        `Das Level muss zwischen ${MIN_LEVEL} und ${MAX_LEVEL} liegen.`
      );
    }

    const userData = await getUserLevelData(client, guildId, userId);
    
    const newXp = 0;
    const newTotalXp = calculateTotalXp(level, newXp);

    userData.level = level;
    userData.xp = newXp;
    userData.totalXp = newTotalXp;

    await saveUserLevelData(client, guildId, userId, userData);
    
    logger.info(`Set level for user ${userId} to ${level} in guild ${guildId}`);
    return userData;
  } catch (error) {
    logger.error(`Error setting level for user ${userId}:`, error);
    if (error instanceof NexoBotError) throw error;
    throw new NexoBotError(
      `Failed to set level: ${error instanceof Error ? error.message : String(error)}`,
      ErrorTypes.DATABASE,
      'Das Level konnte gerade nicht gesetzt werden.'
    );
  }
}

export async function deleteUserLevelData(client: NexoClient, guildId: string, userId: string): Promise<void> {
  try {
    if (!guildId || !userId) {
      throw new NexoBotError(
        'Guild ID and User ID are required',
        ErrorTypes.VALIDATION
      );
    }

    await store.deleteUserLevel(client, guildId, userId);
    
    logger.debug(`Deleted level data for user ${userId} in guild ${guildId}`);
  } catch (error) {
    logger.error(`Error deleting level data for user ${userId}:`, error);
    if (error instanceof NexoBotError) throw error;
    logger.warn(`Could not delete level data for user ${userId} in guild ${guildId}`);
  }
}