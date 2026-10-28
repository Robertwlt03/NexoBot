// constants.js

export const DEFAULT_ECONOMY_DATA = {
    wallet: 0,
    bank: 0,
    bankLevel: 0,
    xp: 0,
    level: 1,
    lastDaily: 0,
    lastWork: 0,
    lastCrime: 0,
    lastRob: 0,
    lastMine: 0,
    lastGamble: 0,
    lastFish: 0,
    dailyStreak: 0,
    lastWeekly: 0,
    lastDeposit: 0,
    lastWithdraw: 0,
    inventory: {},
    upgrades: {},
    cooldowns: {}
};

export const DEFAULT_GUILD_CONFIG = {
    enabledCommands: {},
    birthdayChannelId: null,
    premiumRoleId: null,
    modRole: null,
    adminRole: null,
    welcomeChannel: null,
    autoRole: null,
    logging: {
        enabled: false,
        channels: { audit: null, applications: null, reports: null },
        ignore: { users: [], channels: [] },
        enabledEvents: {},
    },
    verification: {
        enabled: false
    }
};