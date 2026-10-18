// Discord OAuth2 (authorization code flow) for the dashboard login.

import type { SessionGuild } from './session.js';

const API = 'https://discord.com/api/v10';
export const OAUTH_SCOPES = ['identify', 'guilds'];

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function authorizeUrl(config: OAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPES.join(' '),
    state,
    prompt: 'none',
  });
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
  const token = await discordFetch<TokenResponse>('/oauth2/token', {
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
  return token.access_token;
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
