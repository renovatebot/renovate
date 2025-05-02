import { clone } from '../../../util/clone';
import type { FindPRConfig, Pr } from '../types';

let cache: Map<number, Pr> | undefined;
let currentRepository: string | undefined;

export function initialized(repository: string): boolean {
  return cache !== undefined && currentRepository === repository;
}

// Only used in tests, in production savePrsToCache will reset the cache once
// the repository changes
export function reset(): void {
  currentRepository = undefined;
  cache = undefined;
}

export function set(repository: string, prs: Pr[]): void {
  if (cache === undefined || currentRepository !== repository) {
    cache = new Map(prs.map((pr) => [pr.number, clone(pr)]));
    currentRepository = repository;
    return;
  }
  for (const pr of prs) {
    cache.set(pr.number, clone(pr));
  }
}

export function get(
  repository: string,
  prNumber: number,
): Pr | null | undefined {
  if (cache === undefined || currentRepository !== repository) {
    return undefined;
  }
  const pr = cache.get(prNumber);
  return pr ? clone(pr) : null;
}

export function getAll(repository: string): Pr[] | undefined {
  if (cache === undefined || currentRepository !== repository) {
    return undefined;
  }
  if (cache.size === 0) {
    return [];
  }
  return Array.from(cache.values()).map((pr) => clone(pr));
}

export function find(
  repository: string,
  config: FindPRConfig,
  limit?: number,
): Pr[] | Pr | null | undefined {
  if (cache === undefined || currentRepository !== repository) {
    return undefined;
  }
  const matches: Pr[] = [];
  for (const pr of cache.values()) {
    if (config.branchName && pr.sourceBranch !== config.branchName) {
      continue;
    } else if (config.targetBranch && pr.targetBranch !== config.targetBranch) {
      continue;
    } else if (config.prTitle && pr.title !== config.prTitle) {
      continue;
    } else if (
      config.state !== undefined &&
      config.state !== 'all' &&
      pr.state !== config.state &&
      !(config.state === '!open' && pr.state !== 'open')
    ) {
      continue;
    }
    if (limit === 1) {
      return clone(pr);
    }
    matches.push(pr);
  }
  if (limit === 1) {
    return null;
  }
  return Array.from(matches.values()).map((pr) => clone(pr));
}
