// database.js — facade re-exporting split modules for backward compatibility

import { pgDb } from './postgresDatabase.js';
import { logger } from './logger.js';
import { BotConfig, getDefaultApplicationQuestions } from '../config/bot.js';
import type { NexoClient } from '../types/index.js';
import type { VerificationAuditRecord } from './postgresDatabase.js';
import { safeCard, type WelcomeCard } from '../shared/welcomeCard.js';

export {
    db,
    initializeDatabase,
    getFromDb,
    setInDb,
} from './database/wrapper.js';

export {
    getEconomyKey,
    getEconomyPrefix,
    getAFKKey,
    getWelcomeConfigKey,
    getUserLevelKey,
    getUserLevelPrefix,
    getApplicationRolesKey,
    getApplicationSettingsKey,
    getUserApplicationsKey,
    getApplicationKey,
    getJoinToCreateConfigKey,
    getWarningsKey,
    getWarningsPrefix,
    getUserNotesKey,
} from './database/keys.js';

export {
    getTicketData,
    getOpenTicketCountForUser,
    saveTicketData,
    incrementTicketCounter,
} from './database/tickets.js';

import { db, getFromDb, setInDb } from './database/wrapper.js';
import { unwrapReplitData } from './database/guildConfigStorage.js';
import {
    getApplicationRolesKey,
    getApplicationSettingsKey,
    getUserApplicationsKey,
    getApplicationKey,
    getJoinToCreateConfigKey,
    getWelcomeConfigKey,
} from './database/keys.js';

export async function insertVerificationAudit(record: VerificationAuditRecord): Promise<boolean> {
    try {
        if (!db.initialized) {
            await db.initialize();
        }

        if (db.isAvailable() && typeof pgDb.insertVerificationAudit === 'function') {
            return await pgDb.insertVerificationAudit(record);
        }

        const key = `verification:audit:${record.guildId}`;
        const existing = await getFromDb<VerificationAuditRecord[]>(key, []);
        const auditEntries = Array.isArray(existing) ? existing : [];
        const maxInMemoryAuditEntries = BotConfig?.verification?.maxInMemoryAuditEntries ?? 1000;

        auditEntries.push({
            ...record,
            createdAt: record.createdAt || new Date().toISOString()
        });

        if (auditEntries.length > maxInMemoryAuditEntries) {
            auditEntries.splice(0, auditEntries.length - maxInMemoryAuditEntries);
        }

        await setInDb(key, auditEntries);
        return true;
    } catch (error) {
        logger.error('Error storing verification audit:', error);
        return false;
    }
}

// Guild config access: import from services/config/guildConfig.js only.
// Low-level storage lives in ./database/guildConfigStorage.js

export { pgDb };

export const getColor = (path: string, fallback = "#000000"): string => {
    const parts = path.split(".");
    let current: unknown = BotConfig.embeds.colors;

    for (const part of parts) {
        if ((current as Record<string, unknown>)[part] === undefined) {
            logger.warn(`Color path '${path}' not found in config, using fallback`);
            return fallback;
        }
        current = (current as Record<string, unknown>)[part];
    }

    return typeof current === "string" ? current : fallback;
};

export interface WelcomeEmbedConfig {
    title?: string;
    description?: string;
    color?: string;
    thumbnail?: boolean;
    footer?: string;
    [key: string]: unknown;
}

export interface WelcomeLogConfig {
    enabled: boolean;
    channelId: string | null;
}

export interface WelcomeConfig {
    enabled: boolean;
    channelId: string | null;
    welcomeMessage: string;
    welcomeEmbed: WelcomeEmbedConfig;
    welcomePing: boolean;
    welcomeImage: string | null;
    goodbyeEnabled: boolean;
    goodbyeChannelId: string | null;
    leaveMessage: string;
    leaveEmbed: WelcomeEmbedConfig;
    dmMessage: string;
    goodbyePing: boolean;
    roleIds: string[];
    autoRoleDelay: number;
    joinLogs: WelcomeLogConfig;
    leaveLogs: WelcomeLogConfig;
    /** Image card attached to the welcome embed (dashboard designer); unset = none. */
    welcomeCard?: WelcomeCard;
    goodbyeCard?: WelcomeCard;
    [key: string]: unknown;
}

function normalizeWelcomeConfig(raw: unknown = {}): WelcomeConfig {
    // Stored JSON of unknown shape; fields are normalized below.
    const base = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<WelcomeConfig>;

    const channelId = base.channelId ?? null;
    const goodbyeChannelId = base.goodbyeChannelId ?? null;

    const welcomeMessage = base.welcomeMessage ?? "Willkommen {user} auf {server}!";
    const leaveMessage = base.leaveMessage ?? "{user.tag} hat den Server verlassen.";

    const welcomeEmbed = base.welcomeEmbed ?? {
        title: "🎉 Willkommen!",
        description: "Willkommen {user} auf {server}!",
        color: getColor("success"),
        thumbnail: true,
        footer: "Willkommen auf {server}!"
    };

    const leaveEmbed = base.leaveEmbed ?? {
        title: "👋 Auf Wiedersehen",
        description: "{user.tag} hat den Server verlassen.",
        color: getColor("error"),
        thumbnail: true,
        footer: "Tschüss von {server}!"
    };

    const roleIds = Array.isArray(base.roleIds) ? base.roleIds : [];

    return {
        ...base,
        enabled: Boolean(base.enabled),
        channelId,
        welcomeMessage,
        welcomeEmbed,
        welcomePing: Boolean(base.welcomePing),
        welcomeImage: base.welcomeImage ?? null,
        goodbyeEnabled: Boolean(base.goodbyeEnabled),
        goodbyeChannelId,
        leaveMessage,
        leaveEmbed,
        dmMessage: base.dmMessage ?? "",
        goodbyePing: Boolean(base.goodbyePing),
        roleIds,
        autoRoleDelay: base.autoRoleDelay ?? 0,
        joinLogs: base.joinLogs ?? { enabled: false, channelId: null },
        leaveLogs: base.leaveLogs ?? { enabled: false, channelId: null },
        welcomeCard: safeCard(base.welcomeCard) ?? undefined,
        goodbyeCard: safeCard(base.goodbyeCard) ?? undefined
    };
}

export async function getWelcomeConfig(client: NexoClient, guildId: string): Promise<WelcomeConfig> {
    if (!client.db) {
        logger.warn('Database not available for getWelcomeConfig');
        return normalizeWelcomeConfig();
    }
    
    const key = getWelcomeConfigKey(guildId);
    try {
        const config = await client.db.get(key, {});
        const unwrapped = unwrapReplitData(config);
        return normalizeWelcomeConfig(unwrapped);
    } catch (error) {
        logger.error(`Error getting welcome config for guild ${guildId}:`, error);
        return normalizeWelcomeConfig();
    }
}

export async function saveWelcomeConfig(client: NexoClient, guildId: string, config: Partial<WelcomeConfig>): Promise<boolean> {
    const key = getWelcomeConfigKey(guildId);
    try {
        if (!client.db || typeof client.db.set !== 'function') {
            logger.error('Database client is not available for saveWelcomeConfig.');
            return false;
        }

        const existingConfig = await getWelcomeConfig(client, guildId);
        const mergedConfig = { ...existingConfig, ...config };
        
        await client.db.set(key, mergedConfig);
        return true;
    } catch (error) {
        logger.error(`Error saving welcome config for guild ${guildId}:`, error);
        return false;
    }
}

export async function updateWelcomeConfig(client: NexoClient, guildId: string, updates: Partial<WelcomeConfig>): Promise<WelcomeConfig> {
    try {
        const currentConfig = await getWelcomeConfig(client, guildId);
        const updatedConfig = { ...currentConfig, ...updates };
        
        await saveWelcomeConfig(client, guildId, updatedConfig);
        return updatedConfig;
    } catch (error) {
        logger.error(`Error updating welcome config for guild ${guildId}:`, error);
        throw error;
    }
}

export interface ApplicationRole {
    roleId: string;
    name: string;
    enabled?: boolean;
    [key: string]: unknown;
}

export async function getApplicationRoles(client: NexoClient, guildId: string): Promise<ApplicationRole[]> {
    try {
        if (!client.db || typeof client.db.get !== "function") {
            logger.error("Database client is not available for getApplicationRoles.");
            return [];
        }

        const key = getApplicationRolesKey(guildId);
        const roles = await client.db.get<ApplicationRole[]>(key, []);
        const unwrappedRoles = unwrapReplitData(roles);
        return Array.isArray(unwrappedRoles) ? unwrappedRoles : [];
    } catch (error) {
        logger.error(`Error getting application roles for guild ${guildId}:`, error);
        return [];
    }
}

export async function saveApplicationRoles(client: NexoClient, guildId: string, roles: ApplicationRole[]): Promise<boolean> {
    try {
        if (!client.db || typeof client.db.set !== "function") {
            logger.error("Database client is not available for saveApplicationRoles.");
            return false;
        }

        const key = getApplicationRolesKey(guildId);
        await client.db.set(key, roles);
        return true;
    } catch (error) {
        logger.error(`Error saving application roles for guild ${guildId}:`, error);
        return false;
    }
}

export interface ApplicationSettings {
    enabled: boolean;
    applicationChannelId: string | null;
    logChannelId: string | null;
    questions: string[];
    roles: {
        admin: string | null;
        reviewer: string | null;
        accepted: string | null;
        denied: string | null;
    };
    requiredRoles: string[];
    deniedRoles: string[];
    minAccountAge: number;
    maxApplications: number;
    cooldown: number;
    allowMultipleApplications: boolean;
    requireVerification: boolean;
    customWelcomeMessage: string;
    pendingApplicationRetentionDays: number;
    reviewedApplicationRetentionDays: number;
    [key: string]: unknown;
}

function buildApplicationSettingsDefaults(): ApplicationSettings {
    return {
        enabled: false,
        applicationChannelId: null,
        logChannelId: null,
        questions: getDefaultApplicationQuestions(),
        roles: {
            admin: null,
            reviewer: null,
            accepted: null,
            denied: null
        },
        requiredRoles: [],
        deniedRoles: [],
        minAccountAge: 0,
        maxApplications: 1,
        cooldown: BotConfig.applications?.applicationCooldown ?? 7,
        allowMultipleApplications: false,
        requireVerification: false,
        customWelcomeMessage: "",
        pendingApplicationRetentionDays: 30,
        reviewedApplicationRetentionDays: BotConfig.applications?.deleteApprovedAfter ?? 14,
    };
}

export async function getApplicationSettings(client: NexoClient, guildId: string): Promise<ApplicationSettings> {
    if (!client.db) {
        logger.warn('Database not available for getApplicationSettings');
        return buildApplicationSettingsDefaults();
    }
    
    const key = getApplicationSettingsKey(guildId);
    try {
        const settings = await client.db.get<Partial<ApplicationSettings>>(key, {});
        const unwrapped = unwrapReplitData(settings);
        
        const defaultSettings = buildApplicationSettingsDefaults();
        
        return { ...defaultSettings, ...unwrapped };
    } catch (error) {
        logger.error(`Error getting application settings for guild ${guildId}:`, error);
        return buildApplicationSettingsDefaults();
    }
}

interface ApplicationRetentionDays {
    pendingDays: number;
    reviewedDays: number;
}

function getApplicationRetentionDays(settings: Partial<ApplicationSettings> = {}): ApplicationRetentionDays {
    const pendingRaw = Number(settings.pendingApplicationRetentionDays);
    const reviewedRaw = Number(settings.reviewedApplicationRetentionDays);

    const pendingDays = Number.isFinite(pendingRaw) ? Math.min(Math.max(pendingRaw, 1), 3650) : 30;
    const reviewedDays = Number.isFinite(reviewedRaw) ? Math.min(Math.max(reviewedRaw, 1), 3650) : 14;

    return { pendingDays, reviewedDays };
}

function isApplicationExpired(application: Application | null, retentionDays: ApplicationRetentionDays, now = Date.now()): boolean {
    if (!application || typeof application !== 'object') {
        return false;
    }

    const createdAt = Number(application.createdAt) || now;
    const updatedAt = Number(application.updatedAt) || createdAt;
    const reviewedAt = application.reviewedAt ? Number(new Date(application.reviewedAt)) : null;
    const status = typeof application.status === 'string' ? application.status.toLowerCase() : 'pending';

    const ageMsFromCreated = now - createdAt;
    const ageMsFromReviewed = now - (reviewedAt || updatedAt || createdAt);
    const pendingRetentionMs = retentionDays.pendingDays * 24 * 60 * 60 * 1000;
    const reviewedRetentionMs = retentionDays.reviewedDays * 24 * 60 * 60 * 1000;

    if (status === 'pending') {
        return ageMsFromCreated > pendingRetentionMs;
    }

    if (status === 'approved' || status === 'denied') {
        return ageMsFromReviewed > reviewedRetentionMs;
    }

    return ageMsFromCreated > pendingRetentionMs;
}

export async function deleteApplication(
    client: NexoClient,
    guildId: string,
    applicationId: string,
    userIdHint: string | null = null,
): Promise<boolean> {
    const key = getApplicationKey(guildId, applicationId);

    try {
        const existing = unwrapReplitData(await client.db.get<Application>(key, null));
        const userId = userIdHint || existing?.userId || null;

        await client.db.delete(key);

        if (userId) {
            const userKey = getUserApplicationsKey(guildId, userId);
            const userApplications = await client.db.get<string[]>(userKey, []);
            const unwrapped = unwrapReplitData(userApplications);
            const ids = Array.isArray(unwrapped) ? unwrapped : [];
            const filtered = ids.filter(id => id !== applicationId);
            await client.db.set(userKey, filtered);
        }

        return true;
    } catch (error) {
        logger.error(`Error deleting application ${applicationId} in guild ${guildId}:`, error);
        return false;
    }
}

export async function cleanupExpiredApplications(client: NexoClient, guildId: string): Promise<{ removed: number; scanned: number }> {
    try {
        if (!client.db || typeof client.db.list !== 'function') {
            return { removed: 0, scanned: 0 };
        }

        const settings = await getApplicationSettings(client, guildId);
        const retentionDays = getApplicationRetentionDays(settings);
        const prefix = `guild:${guildId}:applications:`;
        let keys = await client.db.list(prefix);

        if (!Array.isArray(keys)) {
            if (typeof keys === 'object' && keys !== null) {
                keys = Object.keys(keys).filter(key => key.startsWith(prefix));
            } else {
                return { removed: 0, scanned: 0 };
            }
        }

        const applicationKeyPattern = new RegExp(`^guild:${guildId}:applications:[^:]+$`);
        const applicationKeys = keys.filter(key => applicationKeyPattern.test(key));

        const now = Date.now();
        let removed = 0;

        for (const key of applicationKeys) {
            const app = unwrapReplitData(await client.db.get<Application>(key, null));
            if (!app) {
                continue;
            }

            if (isApplicationExpired(app, retentionDays, now)) {
                const deleted = await deleteApplication(client, guildId, app.id, app.userId);
                if (deleted) {
                    removed += 1;
                }
            }
        }

        return { removed, scanned: applicationKeys.length };
    } catch (error) {
        logger.error(`Error cleaning expired applications for guild ${guildId}:`, error);
        return { removed: 0, scanned: 0 };
    }
}

export async function saveApplicationSettings(client: NexoClient, guildId: string, settings: Partial<ApplicationSettings>): Promise<boolean> {
    const key = getApplicationSettingsKey(guildId);
    try {
        const existingSettings = await getApplicationSettings(client, guildId);
        const mergedSettings = { ...existingSettings, ...settings };
        
        await client.db.set(key, mergedSettings);
        return true;
    } catch (error) {
        logger.error(`Error saving application settings for guild ${guildId}:`, error);
        return false;
    }
}

function getApplicationRoleSettingsKey(guildId: string, roleId: string): string {
    return `guild:${guildId}:applications:role:${roleId}:settings`;
}

export interface ApplicationRoleSettings {
    questions?: string[] | null;
    logChannelId?: string | null;
    [key: string]: unknown;
}

export async function getApplicationRoleSettings(client: NexoClient, guildId: string, roleId: string): Promise<ApplicationRoleSettings> {
    try {
        if (!client.db || typeof client.db.get !== "function") {
            return { questions: null, logChannelId: null };
        }

        const key = getApplicationRoleSettingsKey(guildId, roleId);
        const settings = await client.db.get<ApplicationRoleSettings>(key, {});
        return unwrapReplitData(settings) || { questions: null, logChannelId: null };
    } catch (error) {
        logger.error(`Error getting application role settings for ${guildId}:${roleId}:`, error);
        return { questions: null, logChannelId: null };
    }
}

export async function saveApplicationRoleSettings(
    client: NexoClient,
    guildId: string,
    roleId: string,
    settings: ApplicationRoleSettings,
): Promise<boolean> {
    try {
        if (!client.db || typeof client.db.set !== "function") {
            logger.error("Database client is not available for saveApplicationRoleSettings.");
            return false;
        }

        const key = getApplicationRoleSettingsKey(guildId, roleId);
        await client.db.set(key, settings);
        return true;
    } catch (error) {
        logger.error(`Error saving application role settings for ${guildId}:${roleId}:`, error);
        return false;
    }
}

export async function deleteApplicationRoleSettings(client: NexoClient, guildId: string, roleId: string): Promise<boolean> {
    try {
        if (!client.db || typeof client.db.delete !== "function") {
            logger.error("Database client is not available for deleteApplicationRoleSettings.");
            return false;
        }

        const key = getApplicationRoleSettingsKey(guildId, roleId);
        await client.db.delete(key);
        return true;
    } catch (error) {
        logger.error(`Error deleting application role settings for ${guildId}:${roleId}:`, error);
        return false;
    }
}

export interface ApplicationAnswer {
    question: string;
    answer: string;
}

/** Fields supplied when a user submits an application. */
export interface ApplicationInput {
    guildId: string;
    userId: string;
    roleId?: string;
    roleName?: string;
    answers?: ApplicationAnswer[];
    [key: string]: unknown;
}

/** Stored application record (`guild:{guildId}:applications:{applicationId}`). */
export interface Application extends ApplicationInput {
    id: string;
    status: string;
    createdAt: number;
    updatedAt: number;
    reviewedBy: string | null;
    reviewedAt: string | null;
    notes: unknown[];
}

export async function createApplication(client: NexoClient, application: ApplicationInput): Promise<Application> {
    const { guildId, userId } = application;
    const applicationId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const key = getApplicationKey(guildId, applicationId);
    
    const newApplication: Application = {
        ...application,
        id: applicationId,
status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewedBy: null,
        reviewedAt: null,
        notes: []
    };
    
    try {
        if (!client.db || typeof client.db.set !== "function") {
            logger.error("Database client is not available for createApplication.");
            throw new Error("Database not available");
        }

        await client.db.set(key, newApplication);
        
        const userKey = getUserApplicationsKey(guildId, userId);
        const userApplications = await client.db.get<string[]>(userKey, []);
        const unwrappedApplications = unwrapReplitData(userApplications);
        
        const applicationsArray = Array.isArray(unwrappedApplications) ? unwrappedApplications : [];
        applicationsArray.push(applicationId);
        
        await client.db.set(userKey, applicationsArray);
        if (process.env.NODE_ENV !== 'production') {
            logger.debug(`Successfully created application ${applicationId} for user ${userId}`);
        }
        
        return newApplication;
    } catch (error) {
        logger.error(`Error creating application for user ${userId} in guild ${guildId}:`, error);
        throw error;
    }
}

export async function getApplication(client: NexoClient, guildId: string, applicationId: string): Promise<Application | null> {
    const key = getApplicationKey(guildId, applicationId);
    try {
        await cleanupExpiredApplications(client, guildId);
        const application = await client.db.get<Application>(key, null);
        return unwrapReplitData(application);
    } catch (error) {
        logger.error(`Error getting application ${applicationId} in guild ${guildId}:`, error);
        return null;
    }
}

export async function updateApplication(
    client: NexoClient,
    guildId: string,
    applicationId: string,
    updates: Partial<Application>,
): Promise<Application> {
    const key = getApplicationKey(guildId, applicationId);
    try {
        const existingApplication = await getApplication(client, guildId, applicationId);
        if (!existingApplication) {
            throw new Error(`Application ${applicationId} not found`);
        }
        
        const updatedApplication: Application = {
            ...existingApplication,
            ...updates,
            updatedAt: Date.now()
        };
        
        await client.db.set(key, updatedApplication);
        return updatedApplication;
    } catch (error) {
        logger.error(`Error updating application ${applicationId} in guild ${guildId}:`, error);
        throw error;
    }
}

export async function getUserApplications(client: NexoClient, guildId: string, userId: string): Promise<Application[]> {
    const userKey = getUserApplicationsKey(guildId, userId);
    try {
        if (!client.db || typeof client.db.get !== "function") {
            logger.error("Database client is not available for getUserApplications.");
            return [];
        }

        await cleanupExpiredApplications(client, guildId);

        const applicationIds = await client.db.get<string[]>(userKey, []);
        const unwrappedIds = unwrapReplitData(applicationIds);
        
        const idsArray = Array.isArray(unwrappedIds) ? unwrappedIds : [];
        
        const applicationPromises = idsArray.map(id => 
            getApplication(client, guildId, id)
        );
        
        const applications = await Promise.all(applicationPromises);
        return applications.filter((app): app is Application => Boolean(app));
    } catch (error) {
        logger.error(`Error getting applications for user ${userId} in guild ${guildId}:`, error);
        return [];
    }
}

export interface ApplicationFilters {
    status?: string;
    userId?: string;
    limit?: number;
    offset?: number;
}

export async function getApplications(client: NexoClient, guildId: string, filters: ApplicationFilters = {}): Promise<Application[]> {
    const {
        status,
        userId,
        limit = 50,
        offset = 0
    } = filters;
    
    try {
        if (!client.db || typeof client.db.list !== "function") {
            logger.error("Database client is not available for getApplications.");
            return [];
        }

        await cleanupExpiredApplications(client, guildId);

        const prefix = `guild:${guildId}:applications:`;
        let keys = await client.db.list(prefix);
        
        if (!Array.isArray(keys)) {
            if (typeof keys === 'object' && keys !== null) {
                const keyArray = Object.keys(keys).filter(key => key.startsWith(prefix));
                keys = keyArray;
            } else {
                return [];
            }
        }
        
        const applicationKeyPattern = new RegExp(`^guild:${guildId}:applications:[^:]+$`);
        const applicationKeys = keys.filter(key => applicationKeyPattern.test(key));
        
        const applicationPromises = applicationKeys.map(key => client.db.get<Application>(key));
        let applications = (await Promise.all(applicationPromises))
            .map(unwrapReplitData)
            .filter((app): app is Application => Boolean(app));
        
        if (status) {
            applications = applications.filter(app => app.status === status);
        }
        
        if (userId) {
            applications = applications.filter(app => app.userId === userId);
        }
        
        applications.sort((a, b) => b.createdAt - a.createdAt);
        
        return applications.slice(offset, offset + limit);
    } catch (error) {
        logger.error(`Error getting applications for guild ${guildId}:`, error);
        return [];
    }
}

export interface JoinToCreateChannelOptions {
    nameTemplate: string;
    userLimit: number;
    bitrate: number;
}

export interface TemporaryChannelInfo {
    ownerId: string;
    triggerChannelId: string;
    createdAt: number;
    [key: string]: unknown;
}

export interface JoinToCreateConfig {
    enabled: boolean;
    triggerChannels: string[];
    categoryId: string | null;
    channelNameTemplate: string;
    userLimit: number;
    bitrate: number;
    temporaryChannels: Record<string, TemporaryChannelInfo>;
    channelOptions?: Record<string, JoinToCreateChannelOptions>;
    [key: string]: unknown;
}

export async function getJoinToCreateConfig(client: NexoClient, guildId: string): Promise<JoinToCreateConfig> {
    if (!client.db) {
        logger.warn('Database not available for getJoinToCreateConfig');
        return {
            enabled: false,
            triggerChannels: [],
            categoryId: null,
            channelNameTemplate: "Raum von {username}",
            userLimit: 0,
            bitrate: 64000,
            temporaryChannels: {}
        };
    }
    
    const key = getJoinToCreateConfigKey(guildId);
    try {
        const config = await client.db.get<Partial<JoinToCreateConfig>>(key, {});
        const unwrapped = unwrapReplitData(config);
        
        return {
            enabled: unwrapped.enabled || false,
            triggerChannels: unwrapped.triggerChannels || [],
            categoryId: unwrapped.categoryId || null,
            channelNameTemplate: unwrapped.channelNameTemplate || "Raum von {username}",
            userLimit: unwrapped.userLimit || 0,
            bitrate: unwrapped.bitrate || 64000,
            temporaryChannels: unwrapped.temporaryChannels || {},
            ...unwrapped
        };
    } catch (error) {
        logger.error(`Error getting Join to Create config for guild ${guildId}:`, error);
        return {
            enabled: false,
            triggerChannels: [],
            categoryId: null,
            channelNameTemplate: "Raum von {username}",
            userLimit: 0,
            bitrate: 64000,
            temporaryChannels: {}
        };
    }
}

export async function saveJoinToCreateConfig(client: NexoClient, guildId: string, config: Partial<JoinToCreateConfig>): Promise<boolean> {
    const key = getJoinToCreateConfigKey(guildId);
    try {
        const existingConfig = await getJoinToCreateConfig(client, guildId);
        const mergedConfig = { ...existingConfig, ...config };
        
        await client.db.set(key, mergedConfig);
        return true;
    } catch (error) {
        logger.error(`Error saving Join to Create config for guild ${guildId}:`, error);
        return false;
    }
}

export async function updateJoinToCreateConfig(
    client: NexoClient,
    guildId: string,
    updates: Partial<JoinToCreateConfig>,
): Promise<JoinToCreateConfig> {
    try {
        const currentConfig = await getJoinToCreateConfig(client, guildId);
        const updatedConfig = { ...currentConfig, ...updates };
        
        await saveJoinToCreateConfig(client, guildId, updatedConfig);
        return updatedConfig;
    } catch (error) {
        logger.error(`Error updating Join to Create config for guild ${guildId}:`, error);
        throw error;
    }
}

export async function addJoinToCreateTrigger(
    client: NexoClient,
    guildId: string,
    channelId: string,
    options: Partial<JoinToCreateChannelOptions> = {},
): Promise<boolean> {
    try {
        const config = await getJoinToCreateConfig(client, guildId);
        
        if (config.triggerChannels.includes(channelId)) {
            return false;
        }
        
        config.triggerChannels.push(channelId);
        config.enabled = config.triggerChannels.length > 0;
        
        if (Object.keys(options).length > 0) {
            if (!config.channelOptions) {
                config.channelOptions = {};
            }
            config.channelOptions[channelId] = {
                nameTemplate: options.nameTemplate || config.channelNameTemplate,
                userLimit: options.userLimit || config.userLimit,
                bitrate: options.bitrate || config.bitrate
            };
        }
        
        return await saveJoinToCreateConfig(client, guildId, config);
    } catch (error) {
        logger.error(`Error adding Join to Create trigger for guild ${guildId}:`, error);
        return false;
    }
}

export async function removeJoinToCreateTrigger(client: NexoClient, guildId: string, channelId: string): Promise<boolean> {
    try {
        const config = await getJoinToCreateConfig(client, guildId);
        
        const index = config.triggerChannels.indexOf(channelId);
        if (index === -1) {
            return false;
        }
        
        config.triggerChannels.splice(index, 1);
        config.enabled = config.triggerChannels.length > 0;
        
        if (config.channelOptions && config.channelOptions[channelId]) {
            delete config.channelOptions[channelId];
        }
        
        return await saveJoinToCreateConfig(client, guildId, config);
    } catch (error) {
        logger.error(`Error removing Join to Create trigger for guild ${guildId}:`, error);
        return false;
    }
}

export async function registerTemporaryChannel(
    client: NexoClient,
    guildId: string,
    channelId: string,
    ownerId: string,
    triggerChannelId: string,
): Promise<boolean> {
    try {
        const config = await getJoinToCreateConfig(client, guildId);
        
        config.temporaryChannels[channelId] = {
            ownerId,
            triggerChannelId,
            createdAt: Date.now()
        };
        
        return await saveJoinToCreateConfig(client, guildId, config);
    } catch (error) {
        logger.error(`Error registering temporary channel for guild ${guildId}:`, error);
        return false;
    }
}

export async function unregisterTemporaryChannel(client: NexoClient, guildId: string, channelId: string): Promise<boolean> {
    try {
        const config = await getJoinToCreateConfig(client, guildId);
        
        if (config.temporaryChannels[channelId]) {
            delete config.temporaryChannels[channelId];
            return await saveJoinToCreateConfig(client, guildId, config);
        }
        
        return false;
    } catch (error) {
        logger.error(`Error unregistering temporary channel for guild ${guildId}:`, error);
        return false;
    }
}

export async function getTemporaryChannelInfo(
    client: NexoClient,
    guildId: string,
    channelId: string,
): Promise<TemporaryChannelInfo | null> {
    try {
        const config = await getJoinToCreateConfig(client, guildId);
        return config.temporaryChannels[channelId] || null;
    } catch (error) {
        logger.error(`Error getting temporary channel info for guild ${guildId}:`, error);
        return null;
    }
}

export interface ChannelNameVariables {
    username?: string;
    userTag?: string;
    displayName?: string;
    guildName?: string;
    channelName?: string;
}

export function formatChannelName(template: string, variables: ChannelNameVariables): string {
    let formatted = template;
    
    const replacements = {
        '{username}': variables.username || 'Nutzer',
        '{user_tag}': variables.userTag || 'Nutzer#0000',
        '{display_name}': variables.displayName || 'Nutzer',
        '{guild_name}': variables.guildName || 'Server',
        '{channel_name}': variables.channelName || 'Sprachkanal'
    };
    
    for (const [placeholder, value] of Object.entries(replacements)) {
        formatted = formatted.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    
    formatted = formatted.replace(/[^\w\s-]/g, '').trim();
formatted = formatted.substring(0, 100);
    
    return formatted || 'Sprachkanal';
}