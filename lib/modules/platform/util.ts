import { hash } from '../../util/hash.ts';
import type { FindPRConfig, Pr } from './types.ts';

export function repoFingerprint(
  repoId: number | string,
  endpoint: string | undefined,
): string {
  const input = endpoint ? `${endpoint}::${repoId}` : `${repoId}`;
  const fingerprint = hash(input);
  return fingerprint;
}

export function getNewBranchName(branchName?: string): string | undefined {
  if (branchName && !branchName.startsWith('refs/heads/')) {
    return `refs/heads/${branchName}`;
  }
  return branchName;
}

/**
 * Checks whether a PR's actual state satisfies a `FindPRConfig.state` filter.
 * `expected` follows Renovate's PR state filter convention: `'all'` (or unset)
 * matches everything, a leading `!` negates an exact match, and anything else
 * requires an exact match.
 */
export function matchesState(
  actual: string,
  expected: FindPRConfig['state'] = 'all',
): boolean {
  if (!expected || expected === 'all') {
    return true;
  }
  if (expected.startsWith('!')) {
    return actual !== expected.substring(1);
  }
  return actual === expected;
}

/**
 * Finds the PR in `prs` matching the branch/title/state of `config`, using
 * the same core filter shared by most platforms: exact branch name match,
 * case-insensitive title match (when `prTitle` is set), and `matchesState`.
 * Callers with platform-specific extra conditions (e.g. source repo checks)
 * should apply those separately rather than using this helper.
 */
export function findPrInList<T extends Pr>(
  prs: T[],
  { branchName, prTitle, state }: FindPRConfig,
): T | undefined {
  return prs.find(
    (p) =>
      p.sourceBranch === branchName &&
      (!prTitle || p.title.toUpperCase() === prTitle.toUpperCase()) &&
      matchesState(p.state, state),
  );
}
