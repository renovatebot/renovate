import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isNonEmptyArray } from '@sindresorhus/is';
import { GlobalConfig } from '../../../../lib/config/global.ts';
import type { AllConfig } from '../../../../lib/config/types.ts';
import {
  clearProblems,
  init as initLogger,
} from '../../../../lib/logger/index.ts';
import * as hostRules from '../../../../lib/util/host-rules.ts';
import { start } from '../../../../lib/workers/global/index.ts';
import { resetAllLimits } from '../../../../lib/workers/global/limits.ts';
import {
  GERRIT_ADMIN_PASSWORD,
  GERRIT_ADMIN_USERNAME,
  getBaseUrl,
} from './gerrit-container.ts';

let loggerReady = false;
let sharedBaseDir: string | undefined;

async function ensureLogger(): Promise<void> {
  if (loggerReady) {
    return;
  }
  process.env.LOG_LEVEL ??= 'warn';
  await initLogger();
  loggerReady = true;
}

async function getSharedBaseDir(): Promise<string> {
  sharedBaseDir ??= await mkdtemp(`${tmpdir()}/renovate-integration-`);
  return sharedBaseDir;
}

/**
 * Run Renovate in-process (same Node process as the test runner).
 * Avoids cold-start of a child process per call.
 */
export async function renovate(
  repositories?: string[] | null,
  overrides: AllConfig = {},
): Promise<void> {
  await ensureLogger();

  const config: AllConfig = {
    platform: 'gerrit',
    endpoint: `${getBaseUrl()}/`,
    username: GERRIT_ADMIN_USERNAME,
    password: GERRIT_ADMIN_PASSWORD,
    gitAuthor: 'Renovate Gerrit <renovate-gerrit@example.com>',
    baseDir: await getSharedBaseDir(),
    ...(isNonEmptyArray(repositories) ? { repositories } : {}),
    ...overrides,
  };

  const prevConfig = process.env.RENOVATE_CONFIG;
  const prevLogLevel = process.env.LOG_LEVEL;
  const prevArgv = process.argv;

  process.env.RENOVATE_CONFIG = JSON.stringify(config);
  process.env.LOG_LEVEL = 'warn';
  // Prevent vitest CLI args from being parsed as Renovate options/repos
  process.argv = [process.argv[0], 'renovate'];

  clearProblems();
  resetAllLimits();
  hostRules.clear();
  GlobalConfig.reset();

  try {
    const exitCode = await start();
    if (exitCode !== 0) {
      throw new Error(`Renovate exited with code ${exitCode}`);
    }
  } finally {
    if (prevConfig === undefined) {
      delete process.env.RENOVATE_CONFIG;
    } else {
      process.env.RENOVATE_CONFIG = prevConfig;
    }
    if (prevLogLevel === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = prevLogLevel;
    }
    process.argv = prevArgv;
  }
}
