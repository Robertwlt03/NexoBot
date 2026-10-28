// economy.js

import { getEconomyKey as getEconomyStorageKey, getEconomyPrefix } from './database.js';
import { BotConfig } from '../config/bot.js';
import { normalizeEconomyData } from './schemas.js';
import { logger } from './logger.js';
import { validateDiscordId, validateNumber } from './validation.js';
import { DEFAULT_ECONOMY_DATA } from './constants.js';
import { createError, ErrorTypes, wrapServiceBoundary } from './errorHandler.js';
import type { NexoClient } from '../types/index.js';

/** Stored per-user economy record (`EconomyDataSchema`, passthrough). */
export interface EconomyData {
    wallet: number;
    bank: number;
    bankLevel: number;
    xp: number;
    level: number;
    dailyStreak: number;
    lastDaily: number;
    lastWeekly: number;
    lastWork: number;
    lastCrime: number;
    lastRob: number;
    lastDeposit: number;
    lastWithdraw: number;
    inventory: Record<string, number>;
    upgrades?: Record<string, boolean>;
    cooldowns: Record<string, number>;
    leveledUp?: boolean;
    [key: string]: unknown;
}

/** Economy settings read from BotConfig.economy (all optional, with fallbacks below). */
interface EconomyConfig {
    baseBankCapacity?: number;
    bankCapacityPerLevel?: number;
    dailyAmount?: number;
    workMin?: number;
    workMax?: number;
    startingBalance?: number;
    currency?: { name?: string };
    cooldowns?: Record<string, number>;
}

const ECONOMY_CONFIG: EconomyConfig = BotConfig.economy || {};
const BASE_BANK_CAPACITY = ECONOMY_CONFIG.baseBankCapacity || 10000;
const BANK_CAPACITY_PER_LEVEL = ECONOMY_CONFIG.bankCapacityPerLevel || 5000;

export function getEconomyKey(guildId: string, userId: string): string {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');
    
    if (!validGuildId || !validUserId) {
        throw new Error('Invalid guild ID or user ID');
    }
    
    return getEconomyStorageKey(validGuildId, validUserId);
}

export function getMaxBankCapacity(userData: EconomyData | null | undefined): number {
    if (!userData) return BASE_BANK_CAPACITY;
    
    const bankLevel = userData.bankLevel || 0;
    let capacity = BASE_BANK_CAPACITY + (bankLevel * BANK_CAPACITY_PER_LEVEL);

    const upgrades = userData.upgrades || {};
    const inventory = userData.inventory || {};

    if (upgrades['bank_upgrade_1']) {
        capacity = Math.floor(capacity * 1.5);
    }

    const bankNotes = inventory['bank_note'] || 0;
    capacity += (bankNotes * 10000);
    
    return capacity;
}

export async function getEconomyData(client: NexoClient, guildId: string, userId: string): Promise<EconomyData> {
    try {
        if (!client.db || typeof client.db.get !== 'function') {
            throw new Error('Database not available');
        }

        const key = getEconomyKey(guildId, userId);
        const data = await client.db.get(key, {});
        const defaults = {
            ...DEFAULT_ECONOMY_DATA,
            wallet: ECONOMY_CONFIG.startingBalance ?? DEFAULT_ECONOMY_DATA.wallet,
        };
        
        return normalizeEconomyData(data, defaults) as EconomyData;
    } catch (error) {
        logger.error(`Error getting economy data for user ${userId}`, error);
        return normalizeEconomyData({}, DEFAULT_ECONOMY_DATA) as EconomyData;
    }
}

export interface EconomyLeaderboardEntry {
    userId: string;
    wallet: number;
    bank: number;
    net_worth: number;
}

/** All stored accounts of a guild, richest (wallet + bank) first. Used by /eco eleaderboard and the web dashboard. */
export async function getEconomyLeaderboard(client: NexoClient, guildId: string): Promise<EconomyLeaderboardEntry[]> {
    const prefix = getEconomyPrefix(guildId);
    let allKeys = await client.db.list(prefix);
    if (!Array.isArray(allKeys)) {
        allKeys = [];
    }

    const entries: EconomyLeaderboardEntry[] = [];
    for (const key of allKeys) {
        const userData = await client.db.get<EconomyData>(key);
        if (userData) {
            const wallet = userData.wallet || 0;
            const bank = userData.bank || 0;
            entries.push({ userId: key.replace(prefix, ''), wallet, bank, net_worth: wallet + bank });
        }
    }

    return entries.sort((a, b) => b.net_worth - a.net_worth);
}

export async function setEconomyData(client: NexoClient, guildId: string, userId: string, data: EconomyData): Promise<boolean> {
    try {
        if (!client.db || typeof client.db.set !== 'function') {
            throw new Error('Database not available');
        }

        const key = getEconomyKey(guildId, userId);
        const normalized = normalizeEconomyData(data, DEFAULT_ECONOMY_DATA);
        await client.db.set(key, normalized);
        return true;
    } catch (error) {
        logger.error(`Error saving economy data for user ${userId}`, error);
        return false;
    }
}

export const addMoney = wrapServiceBoundary(async function addMoney(client: NexoClient, guildId: string, userId: string, amount: number, type = 'wallet') {
    const validAmount = validateNumber(amount, 'amount');
    if (validAmount === null || validAmount <= 0) {
        throw createError(
            'Invalid amount',
            ErrorTypes.VALIDATION,
            'Der Betrag muss eine positive Zahl sein.',
            { guildId, userId, amount, operation: 'addMoney' }
        );
    }

    if (type !== 'wallet' && type !== 'bank') {
        throw createError(
            'Invalid money type',
            ErrorTypes.VALIDATION,
            'Der Typ muss "wallet" oder "bank" sein.',
            { guildId, userId, type, operation: 'addMoney' }
        );
    }

    const userData = await getEconomyData(client, guildId, userId);

    if (type === 'bank') {
        const maxBank = getMaxBankCapacity(userData);
        if ((userData.bank || 0) + validAmount > maxBank) {
            throw createError(
                'Bank capacity exceeded',
                ErrorTypes.VALIDATION,
                `Bankkapazität überschritten. Aktuell: ${userData.bank || 0}, Maximum: ${maxBank}.`,
                { guildId, userId, current: userData.bank || 0, max: maxBank, operation: 'addMoney' }
            );
        }
        userData.bank = (userData.bank || 0) + validAmount;
    } else {
        userData.wallet = (userData.wallet || 0) + validAmount;
    }

    await setEconomyData(client, guildId, userId, userData);

    return {
        newBalance: type === 'bank' ? userData.bank : userData.wallet,
        ...(type === 'bank' ? { maxBank: getMaxBankCapacity(userData) } : {}),
    };
}, {
    service: 'economy',
    operation: 'addMoney',
    userMessage: 'Geld konnte nicht hinzugefügt werden. Bitte versuch es erneut.',
});

export const removeMoney = wrapServiceBoundary(async function removeMoney(client: NexoClient, guildId: string, userId: string, amount: number, type = 'wallet') {
    const validAmount = validateNumber(amount, 'amount');
    if (validAmount === null || validAmount <= 0) {
        throw createError(
            'Invalid amount',
            ErrorTypes.VALIDATION,
            'Der Betrag muss eine positive Zahl sein.',
            { guildId, userId, amount, operation: 'removeMoney' }
        );
    }

    if (type !== 'wallet' && type !== 'bank') {
        throw createError(
            'Invalid money type',
            ErrorTypes.VALIDATION,
            'Der Typ muss "wallet" oder "bank" sein.',
            { guildId, userId, type, operation: 'removeMoney' }
        );
    }

    const userData = await getEconomyData(client, guildId, userId);

    if (type === 'bank') {
        if ((userData.bank || 0) < validAmount) {
            throw createError(
                'Insufficient bank funds',
                ErrorTypes.VALIDATION,
                `Nicht genug Geld auf der Bank. Du hast ${userData.bank || 0}, brauchst aber ${validAmount}.`,
                { guildId, userId, current: userData.bank || 0, required: validAmount, operation: 'removeMoney' }
            );
        }
        userData.bank = (userData.bank || 0) - validAmount;
    } else {
        if ((userData.wallet || 0) < validAmount) {
            throw createError(
                'Insufficient wallet funds',
                ErrorTypes.VALIDATION,
                `Nicht genug Geld in der Geldbörse. Du hast ${userData.wallet || 0}, brauchst aber ${validAmount}.`,
                { guildId, userId, current: userData.wallet || 0, required: validAmount, operation: 'removeMoney' }
            );
        }
        userData.wallet = (userData.wallet || 0) - validAmount;
    }

    await setEconomyData(client, guildId, userId, userData);

    return {
        newBalance: type === 'bank' ? userData.bank : userData.wallet,
    };
}, {
    service: 'economy',
    operation: 'removeMoney',
    userMessage: 'Geld konnte nicht abgezogen werden. Bitte versuch es erneut.',
});