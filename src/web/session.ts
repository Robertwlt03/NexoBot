// Dashboard sessions: a random id in an HMAC-signed, HttpOnly cookie; the data lives in the DB (temp_data, with TTL).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { db } from '../utils/database/wrapper.js';

export const SESSION_COOKIE = 'nexo_session';
export const STATE_COOKIE = 'nexo_oauth_state';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  /** Permission bitfield as decimal string (from Discord's /users/@me/guilds). */
  permissions: string;
}

export interface DashboardSession {
  id: string;
  userId: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  accessToken: string;
  guilds: SessionGuild[];
  guildsFetchedAt: number;
}

const sessionKey = (id: string) => `temp:dashboard:session:${id}`;

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

function sign(value: string, secret: string): string {
  return `${value}.${createHmac('sha256', secret).update(value).digest('base64url')}`;
}

/** Returns the original value when the signature is valid, otherwise null. */
export function unsign(signed: string, secret: string): string | null {
  const dot = signed.lastIndexOf('.');
  if (dot <= 0) {
    return null;
  }
  const value = signed.slice(0, dot);
  const expected = Buffer.from(sign(value, secret));
  const actual = Buffer.from(signed);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? value : null;
}

export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

export function setCookie(res: Response, name: string, value: string, options: { maxAgeSeconds: number; secure: boolean }) {
  res.append('Set-Cookie', [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/dashboard',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${options.maxAgeSeconds}`,
    options.secure ? 'Secure' : '',
  ].filter(Boolean).join('; '));
}

export function setSignedCookie(res: Response, name: string, value: string, secret: string, options: { maxAgeSeconds: number; secure: boolean }) {
  setCookie(res, name, sign(value, secret), options);
}

export function readSignedCookie(req: Request, name: string, secret: string): string | null {
  const raw = readCookie(req, name);
  return raw ? unsign(raw, secret) : null;
}

export async function saveSession(session: DashboardSession): Promise<void> {
  await db.set(sessionKey(session.id), session, SESSION_TTL_SECONDS);
}

export async function loadSession(id: string): Promise<DashboardSession | null> {
  return db.get<DashboardSession>(sessionKey(id), null);
}

export async function deleteSession(id: string): Promise<void> {
  await db.delete(sessionKey(id));
}
