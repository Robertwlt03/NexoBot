// Helpers shared by the backup, restore and restore-drill scripts.

import { spawnSync } from 'node:child_process';
import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../utils/logger.js';

export type CliArgs = Record<string, string | true>;

/** `--key value`, `--key=value` and bare `--flag` (true). */
export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split('=');
    if (typeof inlineValue !== 'undefined') {
      args[rawKey] = inlineValue;
      continue;
    }

    const nextToken = argv[index + 1];
    if (!nextToken || nextToken.startsWith('--')) {
      args[rawKey] = true;
      continue;
    }

    args[rawKey] = nextToken;
    index += 1;
  }

  return args;
}

export function ensureCommand(command: string): void {
  const result = spawnSync(command, ['--version'], {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`${command} is required but was not found in PATH.`);
  }
}

/** Runs the command and returns its stdout; throws with stderr when it fails. */
export function runCommand(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32'
  });

  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout || 'Unknown error'}`);
  }
  return result.stdout;
}

/** Deletes `.dump` files older than `retentionDays` (nothing when it is not a positive number). */
export async function pruneBackups(backupDir: string, retentionDays: number): Promise<void> {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return;
  }

  const entries = await readdir(backupDir, { withFileTypes: true });
  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
  let removed = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.dump')) {
      continue;
    }

    const fullPath = path.join(backupDir, entry.name);
    const fileStats = await stat(fullPath);
    if (fileStats.mtimeMs < cutoff) {
      await unlink(fullPath);
      removed += 1;
    }
  }

  if (removed > 0) {
    logger.info(`Pruned ${removed} old backup file(s)`, {
      event: 'backup.prune.completed',
      removed,
      retentionDays
    });
  }
}
