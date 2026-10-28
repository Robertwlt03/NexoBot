// Leveling: settings (same storage as /level setup + /level dashboard), leaderboard, role sync and member level tools
// (same service functions as /levelset, /leveladd, /levelremove).

import express from 'express';
import { PermissionFlagsBits } from 'discord.js';
import type { Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import {
  LEVELING_LEADERBOARD_MAX, LEVELING_MAX_LEVEL, LEVELING_PAGE_SIZE,
  type LevelingLeaderboard, type LevelingMember, type LevelingSettings, type LevelRoleReward, type LevelRoleSyncResult,
} from '../dto/leveling.js';
import { locals } from '../dashboard.js';
import { badRequest, body, bool, channel, idList, int, role, str } from '../http.js';
import {
  addLevels, getLeaderboard, getLevelingConfig, getUserLevelData, removeLevels, saveLevelingConfig, setUserLevel,
  type LevelData,
} from '../../services/leveling/leveling.js';
import { reconcileLevelRoles } from '../../services/leveling/levelRoleSyncService.js';
import { botHasPermission } from '../../utils/permissionGuard.js';
import type { NexoClient } from '../../types/index.js';
import { fetchMember } from '../moduleSupport.js';

const DEFAULT_MESSAGE = '{user} ist auf Level {level} aufgestiegen!';

async function readSettings(client: NexoClient, guildId: string): Promise<LevelingSettings> {
  const cfg = await getLevelingConfig(client, guildId);
  return {
    enabled: cfg.enabled !== false,
    xpMin: cfg.xpRange?.min ?? cfg.xpPerMessage?.min ?? 15,
    xpMax: cfg.xpRange?.max ?? cfg.xpPerMessage?.max ?? 25,
    cooldownSeconds: cfg.xpCooldown ?? 60,
    announceLevelUp: cfg.announceLevelUp !== false,
    levelUpChannelId: cfg.levelUpChannel ?? null,
    levelUpMessage: cfg.levelUpMessage || DEFAULT_MESSAGE,
    roleRewards: Object.entries(cfg.roleRewards ?? {})
      .map(([level, roleId]) => ({ level: Number(level), roleId }))
      .sort((a, b) => a.level - b.level),
    ignoredChannels: cfg.ignoredChannels ?? [],
    ignoredRoles: cfg.ignoredRoles ?? [],
  };
}

function parseRewards(guild: Guild, value: unknown): LevelRoleReward[] {
  if (!Array.isArray(value)) throw badRequest('Rollen-Belohnungen: Liste erwartet.');
  if (value.length > 100) throw badRequest('Rollen-Belohnungen: höchstens 100 Einträge.');
  const seen = new Set<number>();
  return value.map((raw) => {
    const entry = body(raw);
    const level = int(entry.level, 'Rollen-Belohnung: Level', 1, 500);
    if (seen.has(level)) throw badRequest(`Für Level ${level} gibt es mehr als eine Rollen-Belohnung.`);
    seen.add(level);
    const roleId = role(guild, entry.roleId, `Rollen-Belohnung (Level ${level})`, { assignable: true });
    if (!roleId) throw badRequest(`Rollen-Belohnung (Level ${level}): Bitte wähle eine Rolle aus.`);
    return { level, roleId };
  });
}

function toMember(guild: Guild, userId: string, data: LevelData, fallbackName?: string): LevelingMember {
  const member = guild.members.cache.get(userId);
  return {
    userId,
    name: member?.displayName ?? fallbackName ?? userId,
    avatarUrl: member?.displayAvatarURL({ size: 64 }) ?? null,
    level: data.level,
    xp: data.xp,
    totalXp: data.totalXp,
  };
}


export const levelingModule: DashboardModule = {
  id: 'leveling',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild.id));
    });

    router.put('/', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const xpMin = int(input.xpMin, 'Minimale XP', 1, 500);
      const xpMax = int(input.xpMax, 'Maximale XP', 1, 500);
      if (xpMin > xpMax) throw badRequest('Die minimalen XP dürfen nicht größer sein als die maximalen XP.');
      const levelUpChannelId = channel(guild, input.levelUpChannelId, 'Level-up-Kanal');
      if (levelUpChannelId && !botHasPermission(guild.channels.cache.get(levelUpChannelId), ['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
        throw badRequest('Nexo braucht die Berechtigungen „Nachrichten senden“ und „Links einbetten“ im Level-up-Kanal.');
      }
      const settings: LevelingSettings = {
        enabled: bool(input.enabled, 'Leveling aktiv'),
        xpMin,
        xpMax,
        cooldownSeconds: int(input.cooldownSeconds, 'XP-Cooldown', 0, 3600),
        announceLevelUp: bool(input.announceLevelUp, 'Level-up-Ankündigungen'),
        levelUpChannelId,
        levelUpMessage: str(input.levelUpMessage, 'Level-up-Nachricht', { min: 1, max: 500 }),
        roleRewards: parseRewards(guild, input.roleRewards),
        ignoredChannels: idList(guild, input.ignoredChannels, 'Ignorierte Kanäle', 'channel'),
        ignoredRoles: idList(guild, input.ignoredRoles, 'Ignorierte Rollen', 'role'),
      };

      const existing = await getLevelingConfig(client, guild.id);
      await saveLevelingConfig(client, guild.id, {
        ...existing,
        // Saving here counts as set up, so `/level dashboard` works afterwards.
        configured: true,
        enabled: settings.enabled,
        xpRange: { min: settings.xpMin, max: settings.xpMax },
        xpCooldown: settings.cooldownSeconds,
        announceLevelUp: settings.announceLevelUp,
        levelUpChannel: settings.levelUpChannelId,
        levelUpMessage: settings.levelUpMessage,
        roleRewards: Object.fromEntries(settings.roleRewards.map((reward) => [String(reward.level), reward.roleId])),
        ignoredChannels: settings.ignoredChannels,
        ignoredRoles: settings.ignoredRoles,
      });
      res.json(await readSettings(client, guild.id));
    });

    router.get('/leaderboard', async (req, res) => {
      const { guild } = locals(res);
      const ranked = await getLeaderboard(client, guild.id, LEVELING_LEADERBOARD_MAX);
      const pages = Math.max(1, Math.ceil(ranked.length / LEVELING_PAGE_SIZE));
      const page = Math.min(Math.max(1, Math.floor(Number(req.query.page)) || 1), pages);
      const result: LevelingLeaderboard = {
        entries: ranked
          .slice((page - 1) * LEVELING_PAGE_SIZE, page * LEVELING_PAGE_SIZE)
          .map((entry) => ({ ...toMember(guild, entry.userId, entry, entry.username), rank: entry.rank })),
        page,
        pages,
        total: ranked.length,
      };
      res.json(result);
    });

    router.get('/members/:userId', async (req, res) => {
      const { guild } = locals(res);
      const member = await fetchMember(guild, req.params.userId);
      res.json(toMember(guild, member.id, await getUserLevelData(client, guild.id, member.id)));
    });

    router.post('/members/:userId', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const member = await fetchMember(guild, req.params.userId);
      let data: LevelData;
      if (input.action === 'set') {
        data = await setUserLevel(client, guild.id, member.id, int(input.amount, 'Level', 0, LEVELING_MAX_LEVEL));
      } else if (input.action === 'add') {
        data = await addLevels(client, guild.id, member.id, int(input.amount, 'Anzahl Level', 1, LEVELING_MAX_LEVEL));
      } else if (input.action === 'remove') {
        const amount = int(input.amount, 'Anzahl Level', 1, LEVELING_MAX_LEVEL);
        const current = await getUserLevelData(client, guild.id, member.id);
        if (current.level === 0) throw badRequest(`${member.user.tag} ist bereits auf Level 0, es können keine Level abgezogen werden.`);
        data = await removeLevels(client, guild.id, member.id, amount);
      } else {
        throw badRequest('Unbekannte Aktion.');
      }
      res.json(toMember(guild, member.id, data));
    });

    router.post('/actions/sync-roles', async (_req, res) => {
      const { guild } = locals(res);
      if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        throw badRequest('Nexo braucht die Berechtigung „Rollen verwalten“.');
      }
      const cfg = await getLevelingConfig(client, guild.id);
      if (cfg.enabled === false) throw badRequest('Das Levelsystem ist deaktiviert. Aktiviere es zuerst.');
      const summary = await reconcileLevelRoles(client, guild.id);
      const result: LevelRoleSyncResult = {
        rolesReAwarded: summary.rolesReAwarded,
        prunedRewardEntries: summary.prunedRewardEntries,
        errors: summary.errors,
      };
      res.json(result);
    });

    return router;
  },
};
