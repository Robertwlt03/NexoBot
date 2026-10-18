// Reaction role panels (same storage, panel layout and rules as /reactroles setup + dashboard).

import express from 'express';
import { PermissionFlagsBits } from 'discord.js';
import type { Guild, GuildTextBasedChannel, Role } from 'discord.js';
import type { DashboardModule } from './index.js';
import type { ReactionRolePanel, ReactionRolesData } from '../dto/reactionroles.js';
import { DESCRIPTION_MAX, MAX_PANELS, MAX_ROLES, TITLE_MAX } from '../dto/reactionroles.js';
import { locals } from '../dashboard.js';
import { HttpError, badRequest, body, channel, role, str } from '../http.js';
import { getAllReactionRoleMessages } from '../../services/reactionRoleService.js';
import type { ReactionRoleMessage } from '../../services/reactionRoleService.js';
import {
  addRoleToPanel, deleteReactionRolePanel, editPanelText, fetchPanelMessage, postReactionRolePanel,
  reactionRoleProblem, removeRoleFromPanel, repostReactionRolePanel, type PanelActor, type SelectMenuPanel,
} from '../../services/reactionRolePanel.js';
import { botHasPermission } from '../../utils/permissionGuard.js';
import { NexoBotError } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import type { NexoClient } from '../../types/index.js';

/** Turns service errors into a 400 with their German user message instead of a 500. */
async function attempt<T>(work: Promise<T>, fallback: string): Promise<T> {
  try {
    return await work;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof NexoBotError && error.userMessage) throw badRequest(error.userMessage);
    logger.warn('Reaction role dashboard action failed:', error);
    throw badRequest(fallback);
  }
}

async function readPanels(client: NexoClient, guild: Guild): Promise<ReactionRolesData> {
  const stored = await getAllReactionRoleMessages(client, guild.id);
  // No message-id recovery here: with several panels in one channel a scan could pick another panel's message.
  const panels = await Promise.all(stored.map(async (panel): Promise<ReactionRolePanel> => {
    const channelExists = guild.channels.cache.has(panel.channelId);
    const message = channelExists ? await fetchPanelMessage(guild, panel) : null;
    const embed = message?.embeds[0];
    return {
      messageId: panel.messageId,
      channelId: panel.channelId,
      url: message?.url ?? null,
      title: embed?.title ?? '',
      description: embed?.description ?? '',
      roleIds: Array.isArray(panel.roles) ? panel.roles : Object.values(panel.roles),
      status: !channelExists ? 'channel_missing' : message ? 'ok' : 'deleted',
      legacy: !Array.isArray(panel.roles),
    };
  }));
  return { panels };
}

async function findPanel(client: NexoClient, guild: Guild, messageId: string): Promise<SelectMenuPanel> {
  const panel: ReactionRoleMessage | undefined = (await getAllReactionRoleMessages(client, guild.id)).find((p) => p.messageId === messageId);
  if (!panel) throw new HttpError(404, 'Dieses Panel gibt es nicht mehr.');
  if (!Array.isArray(panel.roles)) throw badRequest('Alte Reaktions-Panels kannst du hier nur löschen.');
  return panel as SelectMenuPanel;
}

/** A role that may be offered in a panel (same checks as the /reactroles dashboard). */
function panelRole(guild: Guild, value: unknown): Role {
  const id = role(guild, value, 'Rolle');
  if (!id) throw badRequest('Bitte wähle eine Rolle aus.');
  const found = guild.roles.cache.get(id)!;
  const problem = reactionRoleProblem(guild, found);
  if (problem) throw badRequest(`@${found.name}: ${problem}`);
  return found;
}

function assertCanPost(guild: Guild, channelId: string) {
  const target = guild.channels.cache.get(channelId);
  if (!botHasPermission(target, ['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
    throw badRequest(`Ich habe keine Berechtigung, Nachrichten in #${target?.name ?? 'Kanal'} zu senden.`);
  }
}

function assertManageRoles(guild: Guild) {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw badRequest('Ich brauche die Berechtigung „Rollen verwalten“, um Reaktionsrollen einzurichten.');
  }
}

function actorOf(res: express.Response): PanelActor {
  const { user } = locals(res).member;
  return { id: user.id, tag: user.tag };
}

function panelText(input: Record<string, unknown>) {
  return {
    title: str(input.title, 'Titel', { min: 1, max: TITLE_MAX }),
    description: str(input.description, 'Beschreibung', { min: 1, max: DESCRIPTION_MAX }),
  };
}

export const reactionrolesModule: DashboardModule = {
  id: 'reactionroles',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readPanels(client, locals(res).guild));
    });

    router.post('/', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const channelId = channel(guild, input.channelId, 'Kanal');
      if (!channelId) throw badRequest('Bitte wähle einen Kanal aus.');
      const { title, description } = panelText(input);
      if (!Array.isArray(input.roleIds) || input.roleIds.length === 0) throw badRequest('Du musst mindestens eine gültige Rolle angeben.');
      if (input.roleIds.length > MAX_ROLES) throw badRequest(`Du kannst höchstens ${MAX_ROLES} Rollen pro Reaktionsrollen-Nachricht hinzufügen.`);
      if (new Set(input.roleIds).size !== input.roleIds.length) throw badRequest('Eine Rolle wurde mehrfach ausgewählt.');
      const roles = input.roleIds.map((id) => panelRole(guild, id));

      assertManageRoles(guild);
      assertCanPost(guild, channelId);
      if ((await getAllReactionRoleMessages(client, guild.id)).length >= MAX_PANELS) {
        throw badRequest(`Dein Server hat das Maximum von ${MAX_PANELS} Reaktionsrollen-Panels erreicht. Lösche ein bestehendes Panel, um ein neues zu erstellen.`);
      }

      const target = guild.channels.cache.get(channelId) as GuildTextBasedChannel;
      await attempt(postReactionRolePanel(client, target, { title, description, roles }, actorOf(res)), 'Das Panel konnte nicht gepostet werden.');
      res.json(await readPanels(client, guild));
    });

    router.patch('/:messageId', async (req, res) => {
      const { guild } = locals(res);
      const { title, description } = panelText(body(req.body));
      const panel = await findPanel(client, guild, req.params.messageId);
      const message = await fetchPanelMessage(guild, panel);
      if (!message?.embeds[0]) throw badRequest('Die Panel-Nachricht existiert nicht mehr. Poste das Panel zuerst neu.');
      await editPanelText(guild, panel, message, title, description);
      res.json(await readPanels(client, guild));
    });

    router.post('/:messageId/roles', async (req, res) => {
      const { guild } = locals(res);
      const panel = await findPanel(client, guild, req.params.messageId);
      const added = panelRole(guild, body(req.body).roleId);
      if (panel.roles.length >= MAX_ROLES) throw badRequest(`Dieses Panel hat bereits das Maximum von ${MAX_ROLES} Rollen.`);
      if (panel.roles.includes(added.id)) throw badRequest(`@${added.name} ist bereits in diesem Panel.`);
      await attempt(addRoleToPanel(client, guild, panel, added.id), 'Die Rolle konnte nicht hinzugefügt werden.');
      res.json(await readPanels(client, guild));
    });

    router.delete('/:messageId/roles/:roleId', async (req, res) => {
      const { guild } = locals(res);
      const panel = await findPanel(client, guild, req.params.messageId);
      if (!panel.roles.includes(req.params.roleId)) throw badRequest('Diese Rolle ist nicht in diesem Panel.');
      await attempt(removeRoleFromPanel(client, guild, panel, req.params.roleId), 'Die Rolle konnte nicht entfernt werden.');
      res.json(await readPanels(client, guild));
    });

    router.post('/:messageId/repost', async (req, res) => {
      const { guild } = locals(res);
      const panel = await findPanel(client, guild, req.params.messageId);
      if (!guild.channels.cache.has(panel.channelId)) throw badRequest('Der eingestellte Panel-Kanal existiert nicht mehr.');
      assertCanPost(guild, panel.channelId);
      const old = await fetchPanelMessage(guild, panel);
      await attempt(repostReactionRolePanel(guild, panel, client, guild.id, old?.embeds[0]), 'Das Panel konnte nicht neu gepostet werden.');
      await old?.delete().catch(() => {});
      res.json(await readPanels(client, guild));
    });

    router.delete('/:messageId', async (req, res) => {
      const { guild } = locals(res);
      const panel = (await getAllReactionRoleMessages(client, guild.id)).find((p) => p.messageId === req.params.messageId);
      if (!panel) throw new HttpError(404, 'Dieses Panel gibt es nicht mehr.');
      const message = await fetchPanelMessage(guild, panel);
      const title = message?.embeds[0]?.title ?? 'dieses Panel';
      await attempt(deleteReactionRolePanel(client, guild, panel, message, title, actorOf(res)), 'Das Panel konnte nicht gelöscht werden.');
      res.json(await readPanels(client, guild));
    });

    return router;
  },
};
