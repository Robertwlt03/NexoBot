import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { logger } from '../utils/logger.js';
import { ensureCommand, parseArgs, pruneBackups, runCommand } from './cli.js';
import { getEnv } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { Pool } = pg;

function createTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

function buildDatabaseUrlWithName(databaseUrl: string, databaseName: string): string {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const env = getEnv();
  const sourceDatabaseUrl = env.POSTGRES_URL;
  if (!sourceDatabaseUrl) {
    throw new Error('Missing required environment variable: POSTGRES_URL');
  }

  const keepDrillDatabase = args['keep-db'] === true || args['keep-db'] === 'true';
  const retentionDays = Number.parseInt(String(args['retention-days'] || env.BACKUP_RETENTION_DAYS || '14'), 10);
  const backupDir = path.resolve(String(args['backup-dir'] || env.BACKUP_DIR || path.join(process.cwd(), 'backups')));

  ensureCommand('pg_dump');
  ensureCommand('pg_restore');

  await mkdir(backupDir, { recursive: true });

  const stamp = createTimestamp();
  const backupPath = path.join(backupDir, `restore-drill-${stamp}.dump`);
  const drillDatabaseName = `nexobot_restore_drill_${stamp}`;
  const maintenanceUrl = buildDatabaseUrlWithName(sourceDatabaseUrl, 'postgres');
  const drillDatabaseUrl = buildDatabaseUrlWithName(sourceDatabaseUrl, drillDatabaseName);

  const maintenancePool = new Pool({ connectionString: maintenanceUrl });

  logger.info('Starting restore drill', {
    event: 'restore_drill.start',
    drillDatabaseName
  });

  try {
    runCommand('pg_dump', [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--file',
      backupPath,
      sourceDatabaseUrl
    ]);

    const createClient = await maintenancePool.connect();
    try {
      await createClient.query(`CREATE DATABASE "${drillDatabaseName}" TEMPLATE template0`);
    } finally {
      createClient.release();
    }

    runCommand('pg_restore', [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--dbname',
      drillDatabaseUrl,
      backupPath
    ]);

    const verifyPool = new Pool({ connectionString: drillDatabaseUrl });
    try {
      const tableCount = await verifyPool.query<{ value: number }>(
        `SELECT COUNT(*)::int AS value FROM information_schema.tables WHERE table_schema = 'public'`
      );

      const migrationTableCount = await verifyPool.query<{ value: number }>(
        `SELECT COUNT(*)::int AS value FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations'`
      );

      if (tableCount.rows[0]?.value <= 0) {
        throw new Error('Restore drill verification failed: no public tables restored.');
      }

      if (migrationTableCount.rows[0]?.value <= 0) {
        throw new Error('Restore drill verification failed: schema_migrations table missing.');
      }
    } finally {
      await verifyPool.end();
    }

    logger.info('Restore drill completed successfully', {
      event: 'restore_drill.completed',
      drillDatabaseName,
      backupPath
    });
  } finally {
    if (!keepDrillDatabase) {
      const dropClient = await maintenancePool.connect();
      try {
        await dropClient.query(
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [drillDatabaseName]
        );
        await dropClient.query(`DROP DATABASE IF EXISTS "${drillDatabaseName}"`);
      } finally {
        dropClient.release();
      }
    }

    await maintenancePool.end();
    await pruneBackups(backupDir, retentionDays);
  }
}

run().catch((error) => {
  logger.error('Restore drill failed', {
    event: 'restore_drill.failed',
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});