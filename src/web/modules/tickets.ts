// Ticket system: same flat guild config keys as /ticket setup and /ticket dashboard, panel via services/ticketPanel.

import express from 'express';
import { PermissionFlagsBits } from 'discord.js';
import type { Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import type { OpenTicket, TicketOverview, TicketSettings } from '../dto/tickets.js';
import { OPEN_TICKET_LIMIT } from '../dto/tickets.js';
import { locals } from '../dashboard.js';
import { HttpError, badRequest, body, bool, channel, int, role, str } from '../http.js';
import { getGuildConfig, updateGuildConfig } from '../../services/config/guildConfig.js';
import {
  DEFAULT_TICKET_BUTTON_LABEL, DEFAULT_TICKET_PANEL_MESSAGE, deleteTicketSystem, persistTicketPanelMessageId,
  repostTicketPanel, updateLiveTicketPanel,
} from '../../services/ticketPanel.js';
import { getTicketPanelStatus } from '../../utils/panelStatus.js';
import { getGuildTicketStats, listGuildTickets } from '../../utils/database/tickets.js';
import { PRIORITY_MAP } from '../../utils/helpers.js';
import type { NexoClient } from '../../types/index.js';

async function readSettings(client: NexoClient, guildId: string): Promise<TicketSettings> {
  const config = await getGuildConfig(client, guildId);
  return {
    panelChannelId: config.ticketPanelChannelId ?? null,
    panelMessage: config.ticketPanelMessage || DEFAULT_TICKET_PANEL_MESSAGE,
    buttonLabel: config.ticketButtonLabel || DEFAULT_TICKET_BUTTON_LABEL,
    openCategoryId: config.ticketCategoryId ?? null,
    closedCategoryId: config.ticketClosedCategoryId ?? null,
    staffRoleId: config.ticketStaffRoleId ?? null,
    maxTicketsPerUser: config.maxTicketsPerUser || 3,
    dmOnClose: config.dmOnClose !== false,
    logsChannelId: config.ticketLogsChannelId ?? null,
    transcriptChannelId: config.ticketTranscriptChannelId ?? null,
  };
}

function displayName(guild: Guild, client: NexoClient, userId: string): string {
  const member = guild.members.cache.get(userId);
  return member?.displayName ?? client.users.cache.get(userId)?.username ?? userId;
}

/** Nexo must be able to post the panel embed with its button into the channel. */
function assertCanPost(guild: Guild, channelId: string) {
  const target = guild.channels.cache.get(channelId);
  const me = guild.members.me;
  if (!target || !me) throw badRequest('Der Panel-Kanal existiert nicht mehr. Wähl einen neuen aus.');
  const missing = me.permissionsIn(target).missing([
    PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
  ]);
  if (missing.length > 0) {
    throw badRequest(`Nexo kann in #${target.name} nicht posten. Gib Nexo dort „Kanal ansehen“, „Nachrichten senden“ und „Links einbetten“.`);
  }
}

export const ticketsModule: DashboardModule = {
  id: 'tickets',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild.id));
    });

    router.put('/', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const settings: TicketSettings = {
        panelChannelId: channel(guild, input.panelChannelId, 'Panel-Kanal'),
        panelMessage: str(input.panelMessage, 'Panel-Nachricht', { min: 1, max: 2000 }),
        buttonLabel: str(input.buttonLabel, 'Button-Beschriftung', { min: 1, max: 80 }),
        openCategoryId: channel(guild, input.openCategoryId, 'Kategorie offene Tickets', 'category'),
        closedCategoryId: channel(guild, input.closedCategoryId, 'Kategorie geschlossene Tickets', 'category'),
        staffRoleId: role(guild, input.staffRoleId, 'Team-Rolle'),
        maxTicketsPerUser: int(input.maxTicketsPerUser, 'Max. Tickets pro Nutzer', 1, 10),
        dmOnClose: bool(input.dmOnClose, 'DM beim Schließen'),
        logsChannelId: channel(guild, input.logsChannelId, 'Ticket-Log-Kanal'),
        transcriptChannelId: channel(guild, input.transcriptChannelId, 'Transkript-Kanal'),
      };

      const before = await getGuildConfig(client, guild.id);
      const config = await updateGuildConfig(client, guild.id, {
        ticketPanelChannelId: settings.panelChannelId,
        // A new channel means the old panel message id no longer applies.
        ...(settings.panelChannelId !== (before.ticketPanelChannelId ?? null) ? { ticketPanelMessageId: null } : {}),
        ticketPanelMessage: settings.panelMessage,
        ticketButtonLabel: settings.buttonLabel,
        ticketCategoryId: settings.openCategoryId,
        ticketClosedCategoryId: settings.closedCategoryId,
        ticketStaffRoleId: settings.staffRoleId,
        maxTicketsPerUser: settings.maxTicketsPerUser,
        dmOnClose: settings.dmOnClose,
        ticketLogsChannelId: settings.logsChannelId,
        ticketTranscriptChannelId: settings.transcriptChannelId,
      });

      if (before.ticketPanelMessage !== config.ticketPanelMessage || before.ticketButtonLabel !== config.ticketButtonLabel) {
        await updateLiveTicketPanel(client, guild, config);
      }
      res.json(await readSettings(client, guild.id));
    });

    router.get('/overview', async (_req, res) => {
      const { guild } = locals(res);
      const config = await getGuildConfig(client, guild.id);
      const [panelStatus, stats, tickets] = await Promise.all([
        getTicketPanelStatus(client, guild, config),
        getGuildTicketStats(guild.id),
        listGuildTickets(guild.id),
      ]);
      if (panelStatus.recoveredId) {
        await persistTicketPanelMessageId(client, guild.id, config, panelStatus.recoveredId);
      }

      const openTickets: OpenTicket[] = tickets
        .filter((ticket) => ticket.status === 'open')
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, OPEN_TICKET_LIMIT)
        .map((ticket) => {
          const priority = ticket.priority && ticket.priority !== 'none' ? PRIORITY_MAP[ticket.priority] : undefined;
          return {
            channelId: ticket.id,
            channelName: guild.channels.cache.get(ticket.id)?.name ?? null,
            userId: ticket.userId,
            userName: displayName(guild, client, ticket.userId),
            claimedByName: ticket.claimedBy ? displayName(guild, client, ticket.claimedBy) : null,
            priority: priority ? { level: ticket.priority as string, label: priority.label } : null,
            reason: ticket.reason ?? null,
            createdAt: ticket.createdAt,
          };
        });

      const overview: TicketOverview = {
        panel: {
          state: panelStatus.exists ? 'active' : panelStatus.reason ?? 'no_channel',
          url: panelStatus.message?.url ?? null,
        },
        stats,
        openTickets,
      };
      res.json(overview);
    });

    // Posts the panel when it is missing (same as "Panel neu posten" in /ticket dashboard).
    router.post('/actions/post-panel', async (_req, res) => {
      const { guild } = locals(res);
      const config = await getGuildConfig(client, guild.id);
      if (!config.ticketPanelChannelId) throw badRequest('Wähl zuerst einen Panel-Kanal aus und speichere.');
      const status = await getTicketPanelStatus(client, guild, config);
      if (status.exists) {
        if (status.recoveredId) await persistTicketPanelMessageId(client, guild.id, config, status.recoveredId);
        throw badRequest('Das Ticket-Panel ist in diesem Kanal bereits aktiv.');
      }
      assertCanPost(guild, config.ticketPanelChannelId);
      const message = await repostTicketPanel(client, guild, config).catch(() => {
        throw new HttpError(502, 'Das Panel konnte nicht gesendet werden. Prüf Nexos Berechtigungen im Panel-Kanal.');
      });
      res.json({ url: message.url });
    });

    // "System löschen": removes the panel, all stored tickets and the ticket configuration.
    router.post('/actions/delete-system', async (_req, res) => {
      const { guild } = locals(res);
      const config = await getGuildConfig(client, guild.id);
      await deleteTicketSystem(client, guild.id, config);
      res.json(await readSettings(client, guild.id));
    });

    return router;
  },
};
