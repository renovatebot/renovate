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
import { HttpStats } from '../../../../lib/util/stats.ts';
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

/** Gerrit-only HTTP traffic from Renovate's got layer for one `start()` run. */
export interface GerritHttpStats {
  /** Total HTTP requests whose host matches the Gerrit endpoint. */
  requests: number;
  /** Counts keyed by `METHOD pathname` (query string stripped). */
  paths: Record<string, number>;
}

/**
 * Collect HttpStats data points aimed at the integration Gerrit host.
 * Call immediately after `start()` — memCache is still populated for that repo.
 */
export function getGerritHttpStats(): GerritHttpStats {
  const gerritHost = new URL(getBaseUrl()).host;
  const paths: Record<string, number> = {};
  let requests = 0;

  for (const point of HttpStats.getDataPoints()) {
    let url: URL;
    try {
      url = new URL(point.url);
    } catch {
      continue;
    }
    if (url.host !== gerritHost) {
      continue;
    }
    requests += 1;
    const key = `${point.method.toUpperCase()} ${url.pathname}`;
    paths[key] = (paths[key] ?? 0) + 1;
  }

  return { requests, paths };
}

/** Run Renovate in-process via workers/global `start()`. */
export async function renovate(
  repositories?: string[],
  overrides: AllConfig = {},
): Promise<GerritHttpStats> {
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
    return getGerritHttpStats();
  } finally {
    delete process.env.RENOVATE_CONFIG;
    process.argv = prevArgv;
  }
}
