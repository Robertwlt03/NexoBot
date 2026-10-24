// Discord OAuth2 (authorization code flow) for the dashboard login.

import { OAuth2Scopes, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import type { SessionGuild } from './session.js';

const API = 'https://discord.com/api/v10';
export const OAUTH_SCOPES = ['identify', 'guilds'];

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  refresh_token?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Permissions Nexo asks for when it is invited. */
const INVITE_PERMISSIONS = new PermissionsBitField([
  PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.UseExternalEmojis, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ViewAuditLog,
  PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MoveMembers,
]).bitfield.toString();

/**
 * Login URL. With `invite`, the same flow also adds Nexo to a server (Discord's bot authorization flow):
 * the user picks the server (or `guildId` preselects it) and comes back logged in, with `guild_id` on the callback.
 */
export function authorizeUrl(config: OAuthConfig, state: string, invite?: { guildId?: string }): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: [...OAUTH_SCOPES, ...(invite ? [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands] : [])].join(' '),
    state,
  });
  if (invite) {
    params.set('permissions', INVITE_PERMISSIONS);
    if (invite.guildId) {
      params.set('guild_id', invite.guildId);
      params.set('disable_guild_select', 'true');
    }
  } else {
    params.set('prompt', 'none');
  }
  return `https://discord.com/oauth2/authorize?${params}`;
}

async function discordFetch<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, init);
  if (!response.ok) {
    throw new Error(`Discord API ${path} failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function exchangeCode(config: OAuthConfig, code: string): Promise<string> {
  return (await exchangeCodeForTokens(config, code)).access_token;
}

/** The full token response (with refresh token), for flows that keep acting for the user (linked roles). */
export function exchangeCodeForTokens(config: OAuthConfig, code: string): Promise<TokenResponse> {
  return discordFetch<TokenResponse>('/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
  });
}

export function refreshTokens(config: Omit<OAuthConfig, 'redirectUri'>, refreshToken: string): Promise<TokenResponse> {
  return discordFetch<TokenResponse>('/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
}

/** Authorize URL for the linked-roles verification (identify + role_connections.write, always with consent). */
export function linkedRoleAuthorizeUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: 'identify role_connections.write', state, prompt: 'consent',
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

const bearer = (accessToken: string) => ({ headers: { Authorization: `Bearer ${accessToken}` } });

export function fetchUser(accessToken: string): Promise<DiscordUser> {
  return discordFetch<DiscordUser>('/users/@me', bearer(accessToken));
}

export function fetchUserGuilds(accessToken: string): Promise<SessionGuild[]> {
  return discordFetch<SessionGuild[]>('/users/@me/guilds', bearer(accessToken));
}

export async function revokeToken(config: OAuthConfig, accessToken: string): Promise<void> {
  await fetch(`${API}/oauth2/token/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, token: accessToken }),
  }).catch(() => undefined);
}

export function userAvatarUrl(user: { id: string; avatar: string | null }): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
  }
  // Default avatar index for the new username system.
  const index = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function guildIconUrl(guild: { id: string; icon: string | null }): string | null {
  return guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null;
}
