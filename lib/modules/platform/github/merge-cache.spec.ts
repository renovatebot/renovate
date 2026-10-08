import { DateTime, Settings } from 'luxon';
import { getCache, resetCache } from '../../../util/cache/repository/index.ts';
import {
  clearMergeRequest,
  getJobMergeRequests,
  getMergeRequest,
  hasMergeRequests,
  initMergeRequests,
  pruneMergeRequests,
  resetMergeRequests,
  setMergeRequest,
} from './merge-cache.ts';
import type { MergeRequestRecord } from './types.ts';

describe('modules/platform/github/merge-cache', () => {
  const now = Settings.now;

  function record(requestedAt = DateTime.utc().toISO()): MergeRequestRecord {
    return { uuid: 'uuid-1', requestedAt, mergeAction: 'direct_merge' };
  }

  beforeEach(() => {
    resetCache();
    resetMergeRequests();
    initMergeRequests('some/repo');
  });

  afterEach(() => {
    Settings.now = now;
  });

  it('returns undefined if no merge was requested', () => {
    expect(getMergeRequest(1)).toBeUndefined();
    expect(hasMergeRequests()).toBeFalse();
    expect(getCache().platform).toBeUndefined();
  });

  it('stores and clears a merge request', () => {
    const request = record();

    setMergeRequest(1, request);

    expect(getMergeRequest(1)).toEqual(request);
    expect(getJobMergeRequests()).toEqual([1]);
    expect(hasMergeRequests()).toBeTrue();

    clearMergeRequest(1);

    expect(getMergeRequest(1)).toBeUndefined();
    expect(getJobMergeRequests()).toEqual([]);
  });

  it('keeps other GitHub cache data', () => {
    getCache().platform = { github: { issuesCache: {} } };
    const request = record();

    setMergeRequest(1, request);

    expect(getCache().platform?.github).toEqual({
      issuesCache: {},
      mergeRequests: { 1: request },
    });
  });

  it('keeps the requests of the job when the repository cache is reloaded', () => {
    const request = record();
    setMergeRequest(1, request);
    resetCache();
    initMergeRequests('some/repo');

    expect(getMergeRequest(1)).toEqual(request);
    expect(getCache().platform?.github?.mergeRequests).toEqual({ 1: request });
  });

  it('forgets the requests of the job for another repository', () => {
    setMergeRequest(1, record());
    resetCache();
    initMergeRequests('other/repo');

    expect(getMergeRequest(1)).toBeUndefined();
  });

  it('reads requests of earlier runs from the repository cache', () => {
    const request = record();
    getCache().platform = { github: { mergeRequests: { 1: request } } };

    expect(getMergeRequest(1)).toEqual(request);
    expect(getJobMergeRequests()).toEqual([]);
  });

  it('drops a request older than GitHub keeps its result', () => {
    Settings.now = () => Date.parse('2026-10-08T12:00:00Z');
    getCache().platform = {
      github: {
        mergeRequests: { 1: record('2026-10-07T11:59:59.000Z') },
      },
    };

    expect(getMergeRequest(1)).toBeUndefined();
    expect(getCache().platform?.github?.mergeRequests).toEqual({});
  });

  it('prunes expired requests and requests of PRs that are no longer open', () => {
    Settings.now = () => Date.parse('2026-10-08T12:00:00Z');
    const fresh = record('2026-10-08T11:00:00.000Z');
    getCache().platform = {
      github: {
        mergeRequests: { 1: fresh, 2: record('2026-10-07T11:00:00.000Z') },
      },
    };
    setMergeRequest(3, fresh);

    pruneMergeRequests(new Set([1, 2]));

    expect(getCache().platform?.github?.mergeRequests).toEqual({ 1: fresh });
    expect(getJobMergeRequests()).toEqual([]);
  });
});
