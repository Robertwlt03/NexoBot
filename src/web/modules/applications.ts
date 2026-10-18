// Applications: same storage as /app-admin and its in-Discord dashboard; create/delete/review via applicationService.

import express from 'express';
import type { Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import type {
  ApplicationEntry, ApplicationList, ApplicationRoleConfig, ApplicationSettingsDto, ReviewResult,
} from '../dto/applications.js';
import {
  APPLICATION_NAME_MAX_LENGTH, APPLICATIONS_PAGE_SIZE, MAX_QUESTIONS, QUESTION_MAX_LENGTH, REVIEW_REASON_MAX_LENGTH,
} from '../dto/applications.js';
import { locals } from '../dashboard.js';
import { HttpError, badRequest, body, bool, channel, idList, int, optionalStr, role, str } from '../http.js';
import ApplicationService, {
  createApplicationRole, deleteApplicationRole, reviewApplicationWithEffects,
} from '../../services/applicationService.js';
import {
  getApplication, getApplicationRoleSettings, getApplicationRoles, getApplications, getApplicationSettings,
  saveApplicationRoles, saveApplicationRoleSettings, type Application,
} from '../../utils/database.js';
import { getGuildConfig } from '../../services/config/guildConfig.js';
import { resolveLogChannel, setLogChannel } from '../../services/loggingService.js';
import { getDefaultApplicationQuestions } from '../../config/bot.js';
import type { NexoClient } from '../../types/index.js';

/** Upper bound of applications loaded for the review list (storage has no count query). */
const LIST_SCAN_LIMIT = 1000;

async function readSettings(client: NexoClient, guildId: string): Promise<ApplicationSettingsDto> {
  const [settings, roles, guildConfig] = await Promise.all([
    getApplicationSettings(client, guildId),
    getApplicationRoles(client, guildId),
    getGuildConfig(client, guildId),
  ]);
  const roleConfigs: ApplicationRoleConfig[] = await Promise.all(roles.map(async (entry) => {
    const roleSettings = await getApplicationRoleSettings(client, guildId, entry.roleId);
    return {
      roleId: entry.roleId,
      name: entry.name,
      enabled: entry.enabled !== false,
      questions: roleSettings.questions?.length ? roleSettings.questions : null,
      logChannelId: roleSettings.logChannelId ?? null,
    };
  }));
  const managerRoles = Array.isArray(settings.managerRoles) ? settings.managerRoles : [];
  return {
    enabled: settings.enabled === true,
    logChannelId: resolveLogChannel(guildConfig, 'applications') || settings.logChannelId || null,
    managerRoleIds: managerRoles.filter((id): id is string => typeof id === 'string'),
    questions: settings.questions?.length ? settings.questions : getDefaultApplicationQuestions(),
    pendingRetentionDays: settings.pendingApplicationRetentionDays ?? 30,
    reviewedRetentionDays: settings.reviewedApplicationRetentionDays ?? 14,
    roles: roleConfigs,
  };
}

function questions(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw badRequest(`${field}: Liste erwartet.`);
  const list = value.map((entry, index) => str(entry, `${field}: Frage ${index + 1}`, { min: 1, max: QUESTION_MAX_LENGTH }));
  if (list.length === 0) throw badRequest(`${field}: Mindestens eine Frage ist erforderlich.`);
  if (list.length > MAX_QUESTIONS) throw badRequest(`${field}: höchstens ${MAX_QUESTIONS} Fragen.`);
  return list;
}

function userName(guild: Guild, client: NexoClient, userId: string, fallback?: unknown): string {
  return guild.members.cache.get(userId)?.displayName
    ?? client.users.cache.get(userId)?.username
    ?? (typeof fallback === 'string' && fallback ? fallback : userId);
}

function toEntry(guild: Guild, client: NexoClient, app: Application): ApplicationEntry {
  const reviewer = typeof app.reviewer === 'string' ? app.reviewer : app.reviewedBy;
  return {
    id: app.id,
    userId: app.userId,
    userName: userName(guild, client, app.userId, app.username),
    avatarUrl: guild.members.cache.get(app.userId)?.displayAvatarURL({ size: 64 }) ?? (typeof app.avatar === 'string' ? app.avatar : null),
    roleId: app.roleId ?? null,
    roleName: app.roleName ?? 'Unbekannte Rolle',
    status: app.status,
    createdAt: app.createdAt,
    reviewedAt: app.reviewedAt ?? null,
    reviewerName: reviewer ? userName(guild, client, reviewer) : null,
    reviewMessage: typeof app.reviewMessage === 'string' ? app.reviewMessage : null,
    answers: (app.answers ?? []).map(({ question, answer }) => ({ question, answer })),
  };
}

export const applicationsModule: DashboardModule = {
  id: 'applications',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild.id));
    });

    router.put('/', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const enabled = bool(input.enabled, 'Bewerbungen aktiv');
      const logChannelId = channel(guild, input.logChannelId, 'Log-Kanal');
      const managerRoles = idList(guild, input.managerRoleIds, 'Manager-Rollen', 'role', 25);
      const globalQuestions = questions(input.questions, 'Globale Fragen');
      const pendingDays = int(input.pendingRetentionDays, 'Aufbewahrung offen (Tage)', 1, 3650);
      const reviewedDays = int(input.reviewedRetentionDays, 'Aufbewahrung geprüft (Tage)', 1, 3650);

      const storedRoles = await getApplicationRoles(client, guild.id);
      if (!Array.isArray(input.roles)) throw badRequest('Bewerbungen: Liste erwartet.');
      const roleUpdates = new Map(input.roles.map((raw) => {
        const entry = body(raw);
        const stored = storedRoles.find((r) => r.roleId === entry.roleId);
        if (!stored) throw badRequest('Eine Bewerbung existiert nicht mehr. Lade die Seite neu.');
        return [stored.roleId, {
          enabled: bool(entry.enabled, `${stored.name}: Aktiv`),
          questions: entry.questions === null ? null : questions(entry.questions, stored.name),
          logChannelId: channel(guild, entry.logChannelId, `${stored.name}: Log-Kanal`),
        }];
      }));

      const current = await readSettings(client, guild.id);
      await ApplicationService.updateSettings(client, guild.id, {
        enabled,
        managerRoles,
        questions: globalQuestions,
        pendingApplicationRetentionDays: pendingDays,
        reviewedApplicationRetentionDays: reviewedDays,
        ...(logChannelId !== current.logChannelId ? { logChannelId } : {}),
      });
      if (logChannelId !== current.logChannelId) {
        await setLogChannel(client, guild.id, 'applications', logChannelId);
      }

      await saveApplicationRoles(client, guild.id, storedRoles.map((stored) => {
        const update = roleUpdates.get(stored.roleId);
        return update ? { ...stored, enabled: update.enabled } : stored;
      }));
      await Promise.all([...roleUpdates].map(async ([roleId, update]) => {
        const roleSettings = await getApplicationRoleSettings(client, guild.id, roleId);
        await saveApplicationRoleSettings(client, guild.id, roleId, {
          ...roleSettings, questions: update.questions, logChannelId: update.logChannelId,
        });
      }));

      res.json(await readSettings(client, guild.id));
    });

    // Same flow as /app-admin setup.
    router.post('/roles', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const roleId = role(guild, input.roleId, 'Rolle', { assignable: true });
      if (!roleId) throw badRequest('Bitte wähl eine Rolle aus.');
      const name = str(input.name, 'Name der Bewerbung', { min: 1, max: APPLICATION_NAME_MAX_LENGTH });
      const roleQuestions = questions(input.questions, 'Fragen');

      const existing = await getApplicationRoles(client, guild.id);
      if (existing.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) {
        throw badRequest(`Es gibt schon eine Bewerbung mit dem Namen „${name}“.`);
      }
      const created = await createApplicationRole(client, guild, { roleId, name, questions: roleQuestions });
      if (created.error === 'role_missing') throw badRequest('Die ausgewählte Rolle wurde nicht gefunden.');
      if (created.error === 'duplicate') throw badRequest('Für diese Rolle gibt es schon eine Bewerbung.');
      res.json(await readSettings(client, guild.id));
    });

    router.delete('/roles/:roleId', async (req, res) => {
      const { guild } = locals(res);
      const result = await deleteApplicationRole(client, guild.id, req.params.roleId);
      if (!result) throw new HttpError(404, 'Diese Bewerbung existiert nicht mehr.');
      res.json({ deletedApplications: result.deletedApplications });
    });

    router.get('/submissions', async (req, res) => {
      const { guild } = locals(res);
      const status = typeof req.query.status === 'string' && ['pending', 'approved', 'denied'].includes(req.query.status)
        ? req.query.status
        : undefined;
      const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
      const all = await getApplications(client, guild.id, { status, limit: LIST_SCAN_LIMIT });
      const list: ApplicationList = {
        items: all.slice((page - 1) * APPLICATIONS_PAGE_SIZE, page * APPLICATIONS_PAGE_SIZE).map((app) => toEntry(guild, client, app)),
        total: all.length,
        page,
        pageSize: APPLICATIONS_PAGE_SIZE,
      };
      res.json(list);
    });

    // Same side effects as /app-admin review: status, DM to the applicant, log message, role on approve.
    router.post('/submissions/:id/review', async (req, res) => {
      const { guild, member } = locals(res);
      const input = body(req.body);
      if (input.action !== 'approve' && input.action !== 'deny') throw badRequest('Aktion muss „approve“ oder „deny“ sein.');
      const approve = input.action === 'approve';
      const reason = optionalStr(input.reason, 'Grund', REVIEW_REASON_MAX_LENGTH) ?? 'Kein Grund angegeben.';

      const application = await getApplication(client, guild.id, req.params.id);
      if (!application) throw new HttpError(404, 'Bewerbung nicht gefunden.');
      if (application.status !== 'pending') throw badRequest('Diese Bewerbung wurde bereits bearbeitet.');
      if (approve) role(guild, application.roleId, 'Bewerbungsrolle', { assignable: true });

      const result = await reviewApplicationWithEffects(client, guild, application, { approve, reason, reviewerId: member.id });
      const response: ReviewResult = {
        application: toEntry(guild, client, result.application),
        dmSent: result.dmSent,
        roleAssigned: result.roleAssigned,
      };
      res.json(response);
    });

    return router;
  },
};
