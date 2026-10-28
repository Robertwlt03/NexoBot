import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { ensureCommand, parseArgs, runCommand } from './cli.js';
import { getEnv } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function resolveLatestBackup(backupDir: string): Promise<string> {
  const entries = await readdir(backupDir, { withFileTypes: true });
  const dumpFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.dump'))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));

  if (dumpFiles.length === 0) {
    throw new Error(`No .dump backup files found in ${backupDir}`);
  }

  return path.join(backupDir, dumpFiles[0]);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const env = getEnv();
  const backupDir = path.resolve(String(args['backup-dir'] || env.BACKUP_DIR || path.join(process.cwd(), 'backups')));
  const targetUrl = args['target-url'] || env.POSTGRES_RESTORE_URL || env.POSTGRES_URL;

  if (!targetUrl) {
    throw new Error('Missing target database URL. Set POSTGRES_RESTORE_URL or POSTGRES_URL.');
  }

  if (!args.confirm) {
    throw new Error('Restore requires explicit confirmation. Re-run with --confirm.');
  }

  ensureCommand('pg_restore');
  ensureCommand('psql');

  const inputPath = args.input ? path.resolve(String(args.input)) : await resolveLatestBackup(backupDir);
  const dropSchema = args['drop-schema'] === true || args['drop-schema'] === 'true';

  logger.warn('Starting database restore', {
    event: 'restore.start',
    inputPath,
    targetUrl,
    dropSchema
  });

  if (dropSchema) {
    runCommand('psql', [
      '--dbname',
      String(targetUrl),
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
    ]);
  }

  runCommand('pg_restore', [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--dbname',
    String(targetUrl),
    inputPath
  ]);

  logger.info('Database restore completed', {
    event: 'restore.completed',
    inputPath,
    targetUrl
  });
}

run().catch((error) => {
  logger.error('Restore command failed', {
    event: 'restore.failed',
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});