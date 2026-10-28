// Moderation: read views for cases, warnings and user notes (same storage as /cases, /mod warnings and /usernotes).
// Punishments (ban, kick, timeout) stay in Discord on purpose.

import express from 'express';
import type { Request } from 'express';
import type { DashboardModule } from './index.js';
import type { CasesPage, NoteType, NotesPage, UserNoteDto, WarningsPage } from '../dto/moderation.js';
import { NOTE_MAX_LENGTH, NOTE_TYPE_LABELS } from '../dto/moderation.js';
import { locals } from '../dashboard.js';
import { HttpError, badRequest, body, str } from '../http.js';
import { ACTION_LABELS, getModerationCases } from '../../utils/moderation.js';
import { WarningService } from '../../services/moderation/warningService.js';
import { addUserNote, getGuildUserNotes, getUserNotes, saveUserNotes } from '../../services/moderation/userNotesService.js';
import { isSnowflake } from '../../utils/validation.js';
import { resolveNames } from '../moduleSupport.js';

const PAGE_SIZE = 25;
const ALL = 10_000;

function userId(value: unknown, field = 'Nutzer'): string {
  if (!isSnowflake(value)) throw badRequest(`${field}: gültige Nutzer-ID erwartet.`);
  return value;
}

const queryId = (req: Request, key: string, field: string) => {
  const value = req.query[key];
  return value === undefined || value === '' ? undefined : userId(value, field);
};

function paginate<T>(items: T[], req: Request): { items: T[]; total: number; page: number; pageSize: number } {
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1));
  return { items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: items.length, page, pageSize: PAGE_SIZE };
}

const noteType = (type: string): NoteType => (Object.hasOwn(NOTE_TYPE_LABELS, type) ? type as NoteType : 'neutral');

export const moderationModule: DashboardModule = {
  id: 'moderation',
  router: (client) => {
    const router = express.Router();

    // ---------- Cases ----------
    router.get('/cases', async (req, res) => {
      const { guild } = locals(res);
      const action = typeof req.query.action === 'string' && Object.hasOwn(ACTION_LABELS, req.query.action) ? req.query.action : undefined;
      const cases = await getModerationCases(guild.id, {
        userId: queryId(req, 'userId', 'Nutzer'),
        moderatorId: queryId(req, 'moderatorId', 'Moderator'),
        action,
        limit: ALL,
      });
      const { items, ...paging } = paginate(cases, req);
      const result: CasesPage = {
        ...paging,
        cases: items.map((entry) => ({
          caseId: entry.caseId,
          action: entry.action,
          actionLabel: ACTION_LABELS[entry.action] ?? entry.action,
          target: entry.target ?? null,
          targetUserId: entry.targetUserId ?? null,
          executor: entry.executor ?? null,
          moderatorId: entry.moderatorId ?? null,
          reason: entry.reason ?? null,
          duration: entry.duration == null ? null : String(entry.duration),
          createdAt: entry.createdAt,
        })),
        actions: Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
      };
      res.json(result);
    });

    // ---------- Warnings ----------
    router.get('/warnings', async (req, res) => {
      const { guild } = locals(res);
      const filterUser = queryId(req, 'userId', 'Nutzer');
      const warnings = (await WarningService.getGuildWarnings(guild.id, { moderatorId: queryId(req, 'moderatorId', 'Moderator'), limit: ALL }))
        .filter((warning) => !filterUser || warning.userId === filterUser);
      const { items, ...paging } = paginate(warnings, req);
      const names = await resolveNames(client, guild, items.flatMap((w) => [w.userId, w.moderatorId]), PAGE_SIZE * 2);
      const result: WarningsPage = {
        ...paging,
        warnings: items.map((w) => ({
          id: w.id,
          userId: w.userId,
          userName: names[w.userId],
          moderatorId: w.moderatorId,
          moderatorName: names[w.moderatorId],
          reason: w.reason,
          timestamp: w.timestamp,
        })),
      };
      res.json(result);
    });

    router.post('/warnings/remove', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const target = userId(input.userId);
      const warnings = await WarningService.getWarnings(guild.id, target);
      const warning = warnings.find((w) => w.id === input.warningId);
      if (!warning) {
        throw new HttpError(404, 'Diese Verwarnung wurde nicht gefunden. Vielleicht wurde sie bereits entfernt.');
      }
      await WarningService.removeWarning(guild.id, target, warning.id);
      res.json({ ok: true });
    });

    router.post('/warnings/clear', async (req, res) => {
      const { guild } = locals(res);
      res.json(await WarningService.clearWarnings(guild.id, userId(body(req.body).userId)));
    });

    // ---------- User notes ----------
    router.get('/notes', async (req, res) => {
      const { guild } = locals(res);
      const filterUser = queryId(req, 'userId', 'Nutzer');
      const byUser = filterUser
        ? new Map([[filterUser, await getUserNotes(guild.id, filterUser)]])
        : await getGuildUserNotes(guild.id);
      const notes = [...byUser.entries()]
        .flatMap(([id, list]) => list.map((note) => ({ ...note, userId: id })))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const { items, ...paging } = paginate(notes, req);
      const names = await resolveNames(client, guild, items.map((note) => note.userId), PAGE_SIZE * 2);
      const result: NotesPage = {
        ...paging,
        notes: items.map((note): UserNoteDto => ({
          id: note.id,
          userId: note.userId,
          userName: names[note.userId],
          content: note.content,
          type: noteType(note.type),
          author: note.author,
          timestamp: note.timestamp,
        })),
      };
      res.json(result);
    });

    router.post('/notes/add', async (req, res) => {
      const { guild, member } = locals(res);
      const input = body(req.body);
      const target = userId(input.userId);
      const content = str(input.content, 'Notiz', { min: 1, max: NOTE_MAX_LENGTH });
      const type = typeof input.type === 'string' && Object.hasOwn(NOTE_TYPE_LABELS, input.type) ? input.type : 'neutral';
      if (!(await client.users.fetch(target).catch(() => null))) throw badRequest('Diesen Nutzer gibt es nicht.');
      const notes = await addUserNote(guild.id, target, { content, type, author: member.user.tag, authorId: member.id });
      res.json({ count: notes.length });
    });

    router.post('/notes/remove', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const target = userId(input.userId);
      const notes = await getUserNotes(guild.id, target);
      const remaining = notes.filter((note) => note.id !== input.noteId);
      if (remaining.length === notes.length) throw new HttpError(404, 'Diese Notiz wurde nicht gefunden.');
      await saveUserNotes(guild.id, target, remaining);
      res.json({ count: remaining.length });
    });

    router.post('/notes/clear', async (req, res) => {
      const { guild } = locals(res);
      const target = userId(body(req.body).userId);
      const count = (await getUserNotes(guild.id, target)).length;
      await saveUserNotes(guild.id, target, []);
      res.json({ count });
    });

    return router;
  },
};
