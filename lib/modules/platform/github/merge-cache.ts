import { DateTime } from 'luxon';
import { getCache } from '../../../util/cache/repository/index.ts';
import type { PendingMerge } from './types.ts';

function getPendingMerges(): Record<number, PendingMerge> {
  const repoCache = getCache();
  repoCache.platform ??= {};
  repoCache.platform.github ??= {};
  repoCache.platform.github.pendingMerges ??= {};
  return repoCache.platform.github.pendingMerges;
}

/**
 * Returns the async merge request Renovate sent for the PR in an earlier run
 * and whose result was still pending.
 */
export function getPendingMerge(prNo: number): PendingMerge | undefined {
  return getPendingMerges()[prNo];
}

export function setPendingMerge(prNo: number, uuid: string): void {
  getPendingMerges()[prNo] = { uuid, requestedAt: DateTime.utc().toISO() };
}

export function clearPendingMerge(prNo: number): void {
  delete getPendingMerges()[prNo];
}
