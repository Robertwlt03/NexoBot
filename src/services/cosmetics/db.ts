// Database access for the Bernis economy. Everything lives in PostgreSQL; in degraded (in-memory) mode the economy
// is off: bot hooks silently skip and the dashboard answers 503.

import type pg from 'pg';
import { db } from '../../utils/database/wrapper.js';
import { pgConfig } from '../../config/database/postgres.js';
import { HttpError } from '../../web/http.js';

export const T = pgConfig.tables;
export const NO_DB_MESSAGE = 'Die Berni-Wirtschaft braucht die Datenbank.';

export type Queryable = pg.Pool | pg.PoolClient;

export function cosmeticsPool(): pg.Pool | null {
  return db.connectionType === 'postgresql' ? db.db?.pool ?? null : null;
}

export function requirePool(): pg.Pool {
  const pool = cosmeticsPool();
  if (!pool) throw new HttpError(503, NO_DB_MESSAGE);
  return pool;
}

/** Runs `fn` in a transaction (rolled back when it throws). */
export async function withTx<R>(fn: (client: pg.PoolClient) => Promise<R>): Promise<R> {
  const client = await requirePool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
