// Verification panel + AutoVerify (same storage, panel and rules as /verification and its in-Discord dashboards).

import express from 'express';
import type { Guild } from 'discord.js';
import type { DashboardModule } from './index.js';
import type { AutoVerifyCriteria, VerificationSettings } from '../dto/verification.js';
import { ACCOUNT_AGE_MAX, ACCOUNT_AGE_MIN } from '../dto/verification.js';
import { locals } from '../dashboard.js';
import { badRequest, body, bool, channel, int, role, str } from '../http.js';
import { getGuildConfig, setGuildConfig } from '../../services/config/guildConfig.js';
import { getWelcomeConfig } from '../../utils/database.js';
import { getVerificationPanelStatus } from '../../utils/panelStatus.js';
import { botHasPermission } from '../../utils/permissionGuard.js';
import { botConfig } from '../../config/bot.js';
import {
  deleteVerificationPanel, repostVerificationPanel, updateLiveVerificationPanel,
} from '../../services/verificationPanel.js';
import type { AutoVerifyConfig, VerificationConfig } from '../../services/verificationService.js';
import type { NexoClient } from '../../types/index.js';

const CRITERIA: AutoVerifyCriteria[] = ['account_age', 'server_size', 'none'];
const DEFAULT_AGE = botConfig.verification.autoVerify?.defaultAccountAgeDays ?? 7;

// Same texts as /verification setup and /verification autoverify setup.
const VERIFICATION_BLOCKED = 'Du kannst das Verifizierungssystem nicht aktivieren, solange AutoVerify oder eine Auto-Rolle eingerichtet ist. Deaktiviere diese zuerst.';
const AUTOVERIFY_BLOCKED = 'Du kannst AutoVerify nicht aktivieren, solange die Verifizierung oder eine Auto-Rolle eingerichtet ist. Deaktiviere diese zuerst.';
const CHANNEL_PERMS = 'Ich brauche die Berechtigungen „Kanal ansehen“, „Nachrichten senden“ und „Links einbetten“ im Verifizierungskanal.';

async function autoRoleConfigured(client: NexoClient, guildId: string, autoRole: string | null | undefined) {
  const welcome = await getWelcomeConfig(client, guildId);
  return Boolean(autoRole) || (Array.isArray(welcome.roleIds) && welcome.roleIds.length > 0);
}

async function saveVerification(client: NexoClient, guildId: string, cfg: VerificationConfig) {
  const latest = await getGuildConfig(client, guildId);
  latest.verification = cfg;
  await setGuildConfig(client, guildId, latest);
}

async function readSettings(client: NexoClient, guild: Guild): Promise<VerificationSettings> {
  const config = await getGuildConfig(client, guild.id);
  const cfg = config.verification;
  const av = cfg?.autoVerify;
  const known = (id: string | null | undefined) => (id && guild.roles.cache.has(id) ? id : null);

  let panel: VerificationSettings['panel'] = { status: 'none', url: null };
  if (cfg?.channelId && cfg.enabled) {
    const status = await getVerificationPanelStatus(client, guild, cfg);
    if (status.recoveredId) {
      cfg.messageId = status.recoveredId;
      await saveVerification(client, guild.id, cfg);
    }
    panel = status.exists
      ? { status: 'ok', url: status.message?.url ?? null }
      : { status: status.reason === 'channel_missing' ? 'channel_missing' : status.reason === 'panel_deleted' ? 'deleted' : 'none', url: null };
  }

  const roleId = known(cfg?.roleId);
  return {
    enabled: cfg?.enabled === true,
    channelId: cfg?.channelId && guild.channels.cache.has(cfg.channelId) ? cfg.channelId : null,
    roleId,
    message: cfg?.message || botConfig.verification.defaultMessage,
    buttonText: cfg?.buttonText || botConfig.verification.defaultButtonText,
    autoVerify: {
      enabled: av?.enabled === true,
      criteria: av?.criteria ?? 'none',
      accountAgeDays: av?.accountAgeDays ?? DEFAULT_AGE,
      roleId: known(av?.roleId),
    },
    panel,
    verifiedCount: roleId ? guild.roles.cache.get(roleId)?.members.size ?? 0 : 0,
    autoRoleConfigured: await autoRoleConfigured(client, guild.id, config.autoRole),
  };
}

function assertChannelPermissions(guild: Guild, channelId: string) {
  if (!botHasPermission(guild.channels.cache.get(channelId), ['ViewChannel', 'SendMessages', 'EmbedLinks'])) {
    throw badRequest(CHANNEL_PERMS);
  }
}

async function postPanel(guild: Guild, cfg: VerificationConfig): Promise<string> {
  try {
    return (await repostVerificationPanel(guild, cfg)).id;
  } catch {
    throw badRequest('Das Verifizierungs-Panel konnte nicht gepostet werden. Prüfe Kanal und Berechtigungen.');
  }
}

export const verificationModule: DashboardModule = {
  id: 'verification',
  router: (client) => {
    const router = express.Router();

    router.get('/', async (_req, res) => {
      res.json(await readSettings(client, locals(res).guild));
    });

    router.put('/', async (req, res) => {
      const { guild } = locals(res);
      const input = body(req.body);
      const avInput = body(input.autoVerify);

      const enabled = bool(input.enabled, 'Verifizierung');
      const channelId = channel(guild, input.channelId, 'Verifizierungskanal');
      const roleId = role(guild, input.roleId, 'Verifizierungsrolle', { assignable: enabled });
      const message = str(input.message, 'Verifizierungsnachricht', { min: 1, max: 2000 });
      const buttonText = str(input.buttonText, 'Button-Text', { min: 1, max: 80 });

      const avEnabled = bool(avInput.enabled, 'AutoVerify');
      const criteria = avInput.criteria as AutoVerifyCriteria;
      if (!CRITERIA.includes(criteria)) throw badRequest('Bitte wähle ein gültiges Kriterium.');
      const accountAgeDays = criteria === 'account_age'
        ? int(avInput.accountAgeDays, 'Account-Alter (Tage)', ACCOUNT_AGE_MIN, ACCOUNT_AGE_MAX)
        : null;
      const avRoleId = role(guild, avInput.roleId, 'AutoVerify-Rolle', { assignable: avEnabled });

      if (enabled && !channelId) throw badRequest('Verifizierung: Bitte wähle einen Kanal aus.');
      if (enabled && !roleId) throw badRequest('Verifizierung: Bitte wähle eine Rolle aus.');
      if (avEnabled && !avRoleId) throw badRequest('AutoVerify: Bitte wähle eine Rolle aus.');

      const config = await getGuildConfig(client, guild.id);
      const previous = config.verification;
      const wasEnabled = previous?.enabled === true;
      const avWasEnabled = previous?.autoVerify?.enabled === true;
      const hasAutoRole = await autoRoleConfigured(client, guild.id, config.autoRole);
      if (enabled && !wasEnabled && (avEnabled || hasAutoRole)) throw badRequest(VERIFICATION_BLOCKED);
      if (avEnabled && !avWasEnabled && (enabled || hasAutoRole)) throw badRequest(AUTOVERIFY_BLOCKED);

      // Stored record may carry extra keys (e.g. autoVerify.configuredVia); keep them.
      const autoVerify: AutoVerifyConfig = {
        ...previous?.autoVerify,
        enabled: avEnabled,
        criteria,
        accountAgeDays,
        roleId: avRoleId,
      };
      const next: VerificationConfig = {
        ...previous,
        enabled,
        channelId,
        messageId: previous?.messageId ?? null,
        roleId: roleId ?? undefined,
        message,
        buttonText,
        autoVerify,
      };

      // Panel side effects, as in the in-Discord dashboard: post on enable / channel change, edit on text change, delete on disable.
      const channelChanged = previous?.channelId !== channelId;
      if (enabled && channelId && (!wasEnabled || channelChanged)) {
        assertChannelPermissions(guild, channelId);
        if (previous) await deleteVerificationPanel(guild, previous);
        next.messageId = await postPanel(guild, next);
      } else if (enabled && (previous?.message !== message || previous?.buttonText !== buttonText)) {
        await updateLiveVerificationPanel(guild, next);
      } else if (!enabled && wasEnabled && previous) {
        await deleteVerificationPanel(guild, previous);
      }

      await saveVerification(client, guild.id, next);
      res.json(await readSettings(client, guild));
    });

    router.post('/actions/repost', async (_req, res) => {
      const { guild } = locals(res);
      const cfg = (await getGuildConfig(client, guild.id)).verification;
      if (!cfg?.enabled || !cfg.channelId) throw badRequest('Aktiviere zuerst die Verifizierung und wähle einen Kanal.');
      if (!guild.channels.cache.get(cfg.channelId)) {
        throw badRequest('Der eingerichtete Verifizierungskanal existiert nicht mehr. Lege einen neuen Kanal fest.');
      }
      assertChannelPermissions(guild, cfg.channelId);
      await deleteVerificationPanel(guild, cfg);
      cfg.messageId = await postPanel(guild, cfg);
      await saveVerification(client, guild.id, cfg);
      res.json(await readSettings(client, guild));
    });

    return router;
  },
};
