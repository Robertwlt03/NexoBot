import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { ensureCommand, parseArgs, pruneBackups } from './cli.js';
import { getEnv, type Env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function assertEnv(name: keyof Env): string {
  const value = getEnv()[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = assertEnv('POSTGRES_URL');
  const env = getEnv();
  const retentionDays = Number.parseInt(String(args['retention-days'] || env.BACKUP_RETENTION_DAYS || '14'), 10);
  const backupDir = path.resolve(String(args['backup-dir'] || env.BACKUP_DIR || path.join(process.cwd(), 'backups')));

  ensureCommand('pg_dump');
  await mkdir(backupDir, { recursive: true });

  const outputPath = args.output
    ? path.resolve(String(args.output))
    : path.join(backupDir, `nexobot-backup-${createTimestamp()}.dump`);

  const dumpArgs = [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--file',
    outputPath,
    databaseUrl
  ];

  logger.info('Starting PostgreSQL backup', {
    event: 'backup.start',
    outputPath
  });

  const result = spawnSync('pg_dump', dumpArgs, {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`pg_dump failed: ${result.stderr || result.stdout || 'Unknown error'}`);
  }

  await pruneBackups(backupDir, retentionDays);

  logger.info('PostgreSQL backup completed', {
    event: 'backup.completed',
    outputPath,
    retentionDays
  });

  process.stdout.write(`${outputPath}\n`);
}

run().catch((error) => {
  logger.error('Backup command failed', {
    event: 'backup.failed',
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});