import { createHash } from 'node:crypto';
import is from '@sindresorhus/is';

import type { AllConfig } from '../../config/types';
import { logger } from '../../logger';
import { platform } from '../../modules/platform';
import { matchRegexOrGlobList } from '../../util/string-match';

// istanbul ignore next
function repoName(value: string | { repository: string }): string {
  return String(is.string(value) ? value : value.repository).toLowerCase();
}

export async function autodiscoverRepositories(
  config: AllConfig,
): Promise<AllConfig> {
  const { autodiscoverFilter } = config;
  if (config.platform === 'local') {
    if (config.repositories?.length) {
      logger.debug(
        { repositories: config.repositories },
        'Found repositories when in local mode',
      );
      throw new Error(
        'Invalid configuration: repositories list not supported when platform=local',
      );
    }
    config.repositories = ['local'];
    return config;
  }
  if (!config.autodiscover) {
    if (!config.repositories?.length) {
      logger.warn(
        'No repositories found - did you want to run with flag --autodiscover?',
      );
    }
    return config;
  }
  // Autodiscover list of repositories
  let discovered = await platform.getRepos({
    topics: config.autodiscoverTopics,
    sort: config.autodiscoverRepoSort,
    order: config.autodiscoverRepoOrder,
    includeMirrors: config.includeMirrors,
    namespaces: config.autodiscoverNamespaces,
    projects: config.autodiscoverProjects,
  });
  if (!discovered?.length) {
    // Soft fail (no error thrown) if no accessible repositories
    logger.debug('No repositories were autodiscovered');
    return config;
  }

  logger.debug(`Autodiscovered ${discovered.length} repositories`);
  logger.trace(
    { length: discovered.length, repositories: discovered },
    `Autodiscovered repositories`,
  );

  if (autodiscoverFilter) {
    logger.debug({ autodiscoverFilter }, 'Applying autodiscoverFilter');
    discovered = applyFilters(
      discovered,
      is.string(autodiscoverFilter) ? [autodiscoverFilter] : autodiscoverFilter,
    );

    if (!discovered.length) {
      // Soft fail (no error thrown) if no accessible repositories match the filter
      logger.debug('None of the discovered repositories matched the filter');
      return config;
    }
  }

  // Apply sharding if configured
  const {
    autodiscoverShardCount,
    autodiscoverShardSelector,
    autodiscoverShardSalt,
  } = config;
  if (
    autodiscoverShardCount &&
    autodiscoverShardSelector !== undefined &&
    autodiscoverShardSelector !== null
  ) {
    logger.debug(
      { autodiscoverShardCount, autodiscoverShardSelector },
      'Applying autodiscover sharding',
    );
    discovered = applyShard(discovered, {
      shards: autodiscoverShardCount,
      shard: autodiscoverShardSelector,
      salt: autodiscoverShardSalt,
    });
    if (!discovered.length) {
      logger.debug('No repositories remain after sharding');
      return { ...config, repositories: [] };
    }
  }

  logger.info(
    { length: discovered.length, repositories: discovered },
    `Autodiscovered repositories`,
  );

  // istanbul ignore if
  if (config.repositories?.length) {
    logger.debug(
      'Checking autodiscovered repositories against configured repositories',
    );
    for (const configuredRepo of config.repositories) {
      const repository = repoName(configuredRepo);
      let found = false;
      for (let i = discovered.length - 1; i > -1; i -= 1) {
        if (repository === repoName(discovered[i])) {
          found = true;
          logger.debug({ repository }, 'Using configured repository settings');
          // TODO: fix typings
          discovered[i] = configuredRepo as never;
        }
      }
      if (!found) {
        logger.warn(
          { repository },
          'Configured repository is in not in autodiscover list',
        );
      }
    }
  }
  return { ...config, repositories: discovered };
}

export function applyFilters(repos: string[], filters: string[]): string[] {
  return repos.filter((repo) => matchRegexOrGlobList(repo, filters));
}

type ShardSelector = string;

export function addToRange(
  picks: Set<number>,
  start: number,
  end: number,
  shards: number,
): void {
  const lo = Math.max(0, Math.min(start, end));
  const hi = Math.min(shards - 1, Math.max(start, end));
  for (let i = lo; i <= hi; i++) {
    if (Number.isInteger(i) && i >= 0 && i < shards) {
      picks.add(i);
    }
  }
}

export function addModularClass(
  picks: Set<number>,
  modulus: number,
  offset: number,
  shards: number,
): void {
  if (modulus <= 0) {
    return;
  }
  for (let i = 0; i < shards; i++) {
    if (i % modulus === offset % modulus) {
      picks.add(i);
    }
  }
}

export function addPlainInteger(
  picks: Set<number>,
  value: number,
  shards: number,
): void {
  if (Number.isInteger(value) && value >= 0 && value < shards) {
    picks.add(value);
  }
}

export function parseModularClass(
  part: string,
): { modulus: number; offset: number } | null {
  const match = /^\*\/(\d+)(?:\+(\d+))?$/.exec(part);
  if (!match) {
    return null;
  }
  const modulus = parseInt(match[1]);
  const offset = match[2] ? parseInt(match[2]) : 0;
  return { modulus, offset };
}

export function parseInterval(
  part: string,
): { start: number; end: number } | null {
  const match = /^(\d+)-(\d+)$/.exec(part);
  if (!match) {
    return null;
  }
  const start = parseInt(match[1]);
  const end = parseInt(match[2]);
  return { start, end };
}

export function parsePlainInteger(part: string): number | null {
  const match = /^\d+$/.exec(part);
  if (!match) {
    return null;
  }
  return parseInt(part);
}

export function expandShardSelector(
  sel: ShardSelector | undefined,
  shards: number,
): number[] {
  if (!sel || !shards || shards <= 0) {
    return [];
  }

  const picks = new Set<number>();

  for (const partRaw of sel.split(',')) {
    const part = partRaw.trim();
    if (!part) {
      continue;
    }

    // Try modular class: "*/k+o"
    const modularClass = parseModularClass(part);
    if (modularClass) {
      addModularClass(picks, modularClass.modulus, modularClass.offset, shards);
      continue;
    }

    // Try interval: "a-b"
    const interval = parseInterval(part);
    if (interval) {
      addToRange(picks, interval.start, interval.end, shards);
      continue;
    }

    // Try plain integer
    const plainInteger = parsePlainInteger(part);
    if (plainInteger !== null) {
      addPlainInteger(picks, plainInteger, shards);
    }
    // Unrecognised token → ignore
  }

  return [...picks].sort((x, y) => x - y);
}

export function applyShard(
  repos: string[],
  cfg: {
    shards?: number;
    shard?: ShardSelector;
    salt?: string;
  },
): string[] {
  const { shards, shard, salt } = cfg;
  if (!shards || shards <= 0 || shard === undefined || shard === null) {
    return repos;
  }
  const selected = new Set(expandShardSelector(shard, shards));
  if (selected.size === 0) {
    logger.debug(
      'No shards selected after parsing autodiscoverShardSelector; returning empty list.',
    );
    return [];
  }
  return repos.filter((fullName) => {
    const hash = createHash('sha256')
      .update(salt ?? '')
      .update(fullName)
      .digest();
    const mod = hash.readUInt32BE(0) % shards;
    return selected.has(mod);
  });
}
