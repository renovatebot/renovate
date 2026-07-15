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
  GERRIT_RENOVATE_GIT_AUTHOR,
  GERRIT_RENOVATE_PASSWORD,
  GERRIT_RENOVATE_USERNAME,
  getBaseUrl,
} from './gerrit-container.ts';

let loggerReady = false;
let baseDir: string | undefined;

/** Run Renovate in-process via workers/global `start()`. */
export async function renovate(
  repositories?: string[],
  overrides: AllConfig = {},
): Promise<void> {
  if (!loggerReady) {
    process.env.LOG_LEVEL ??= 'warn';
    await initLogger();
    loggerReady = true;
  }

  baseDir ??= await mkdtemp(`${tmpdir()}/renovate-integration-`);

  const config: AllConfig = {
    platform: 'gerrit',
    endpoint: `${getBaseUrl()}/`,
    username: GERRIT_RENOVATE_USERNAME,
    password: GERRIT_RENOVATE_PASSWORD,
    gitAuthor: GERRIT_RENOVATE_GIT_AUTHOR,
    githubTokenWarn: false,
    baseDir,
    ...(isNonEmptyArray(repositories) ? { repositories } : {}),
    ...overrides,
  };

  const prevArgv = process.argv;
  process.env.RENOVATE_CONFIG = JSON.stringify(config);
  process.env.LOG_LEVEL = 'warn';
  // Vitest args must not be parsed as Renovate CLI options/repos
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
    delete process.env.RENOVATE_CONFIG;
    process.argv = prevArgv;
  }
}
