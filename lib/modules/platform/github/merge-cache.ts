import { isEmptyObject } from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { getCache } from '../../../util/cache/repository/index.ts';
import type { MergeRequestRecord } from './types.ts';

// GitHub keeps the result of an async merge request for 24 hours
const retentionHours = 24;

// After a completed automerge the repository job restarts with a freshly
// loaded repository cache, so the requests of the current job, such as refused
// ones that decide the next merge method, are also kept here
let jobRepository: string | undefined;
let jobRequests: Record<number, MergeRequestRecord> = {};

/**
 * Starts tracking the merge requests of a repository job. A restart of the job
 * for the same repository keeps the requests sent so far.
 */
export function initMergeRequests(repository: string): void {
  if (repository !== jobRepository) {
    jobRepository = repository;
    jobRequests = {};
  }
}

export function resetMergeRequests(): void {
  jobRepository = undefined;
  jobRequests = {};
}

function getCachedRequests(): Record<number, MergeRequestRecord> | undefined {
  return getCache().platform?.github?.mergeRequests;
}

function getOrCreateCachedRequests(): Record<number, MergeRequestRecord> {
  const repoCache = getCache();
  repoCache.platform ??= {};
  repoCache.platform.github ??= {};
  repoCache.platform.github.mergeRequests ??= {};
  return repoCache.platform.github.mergeRequests;
}

function isExpired(record: MergeRequestRecord): boolean {
  const cutoff = DateTime.utc().minus({ hours: retentionHours }).toISO();
  return record.requestedAt < cutoff;
}

/**
 * Returns the last async merge request Renovate sent for the PR, unless it is
 * older than GitHub keeps its result.
 */
export function getMergeRequest(prNo: number): MergeRequestRecord | undefined {
  const record = jobRequests[prNo] ?? getCachedRequests()?.[prNo];
  if (!record) {
    return undefined;
  }
  if (isExpired(record)) {
    clearMergeRequest(prNo);
    return undefined;
  }
  // Restores a request of this job that a restart dropped from the cache
  getOrCreateCachedRequests()[prNo] = record;
  return record;
}

export function setMergeRequest(
  prNo: number,
  record: MergeRequestRecord,
): void {
  jobRequests[prNo] = record;
  getOrCreateCachedRequests()[prNo] = record;
}

export function clearMergeRequest(prNo: number): void {
  delete jobRequests[prNo];
  delete getCachedRequests()?.[prNo];
}

/**
 * Returns the PRs for which a merge was requested during the current
 * repository job.
 */
export function getJobMergeRequests(): number[] {
  return Object.keys(jobRequests).map((prNo) => parseInt(prNo, 10));
}

export function hasMergeRequests(): boolean {
  return !isEmptyObject({ ...getCachedRequests(), ...jobRequests });
}

/**
 * Drops the requests that are older than GitHub keeps their result or whose
 * PR is no longer open.
 */
export function pruneMergeRequests(openPrs: Set<number>): void {
  const requests = { ...getCachedRequests(), ...jobRequests };
  for (const [prNo, record] of Object.entries(requests)) {
    const number = parseInt(prNo, 10);
    if (!openPrs.has(number) || isExpired(record)) {
      clearMergeRequest(number);
    }
  }
}
