import { partial } from '~test/util.ts';
import { reset as memCacheReset } from '../../../util/cache/memory/index.ts';
import {
  getCache,
  resetCache as repoCacheReset,
} from '../../../util/cache/repository/index.ts';
import type { LongCommitSha } from '../../../util/git/types.ts';
import { client as _client } from './client.ts';
import { GerritPrCache } from './pr-cache.ts';
import type { GerritChange, GerritRevisionInfo } from './types.ts';
import { REQUEST_DETAILS_FOR_PRS, mapGerritChangeToPr } from './utils.ts';

vi.mock('./client.ts');
const clientMock = vi.mocked(_client);

/**
 * Mock findChanges so it calls shouldFetchNextPage (the reconcile callback)
 * with the provided changes, simulating the real client behavior.
 */
function mockFindChanges(changes: GerritChange[]): void {
  clientMock.findChanges.mockImplementationOnce((_repo, config) => {
    config.shouldFetchNextPage?.(changes);
    return Promise.resolve(changes);
  });
}

function makeChange(overrides?: Partial<GerritChange>): GerritChange {
  return partial<GerritChange>({
    _number: 100,
    status: 'NEW',
    branch: 'main',
    subject: 'test change',
    created: '2025-04-14 16:33:37.000000000',
    updated: '2025-04-14 16:40:00.000000000',
    current_revision: 'abc123' as LongCommitSha,
    revisions: {
      abc123: partial<GerritRevisionInfo>({
        commit_with_footers: 'msg\n\nRenovate-Branch: renovate/dep-1',
      }),
    },
    ...overrides,
  });
}

describe('modules/platform/gerrit/pr-cache', () => {
  beforeEach(() => {
    memCacheReset();
    repoCacheReset();
  });

  describe('getPrs()', () => {
    it('fetches and caches PRs on first call', async () => {
      const change = makeChange();
      mockFindChanges([change]);

      const prs = await GerritPrCache.getPrs('test/repo');

      expect(prs).toEqual([mapGerritChangeToPr(change)]);
      expect(clientMock.findChanges).toHaveBeenCalledExactlyOnceWith(
        'test/repo',
        expect.objectContaining({
          branchName: '',
          state: 'all',
          pageLimit: 100,
          requestDetails: REQUEST_DETAILS_FOR_PRS,
        }),
      );
    });

    it('uses memory cache on subsequent calls', async () => {
      mockFindChanges([makeChange()]);

      const prs1 = await GerritPrCache.getPrs('test/repo');

      // Second call also sets up mock, but it should not be consumed
      mockFindChanges([]);
      const prs2 = await GerritPrCache.getPrs('test/repo');

      // Same results returned from cache
      expect(prs2).toEqual(prs1);
    });

    it('uses incremental page size when cache exists', async () => {
      const change = makeChange();
      mockFindChanges([change]);

      // First call populates cache
      await GerritPrCache.getPrs('test/repo');

      // Reset memCache to force re-sync, but repo cache still has items
      memCacheReset();

      mockFindChanges([]);
      await GerritPrCache.getPrs('test/repo');

      expect(clientMock.findChanges).toHaveBeenCalledTimes(2);
      expect(clientMock.findChanges.mock.calls[1]).toEqual([
        'test/repo',
        expect.objectContaining({
          pageLimit: 20,
        }),
      ]);
    });

    it('sorts PRs by updatedAt descending', async () => {
      const older = makeChange({
        _number: 1,
        updated: '2025-04-14 10:00:00.000000000',
      });
      const newer = makeChange({
        _number: 2,
        updated: '2025-04-14 12:00:00.000000000',
      });
      mockFindChanges([older, newer]);

      const prs = await GerritPrCache.getPrs('test/repo');

      expect(prs[0].number).toBe(2);
      expect(prs[1].number).toBe(1);
    });
  });

  describe('setPr()', () => {
    it('adds a PR to the cache', async () => {
      mockFindChanges([]);

      // First init the cache
      await GerritPrCache.getPrs('test/repo');

      const pr = mapGerritChangeToPr(makeChange({ _number: 200 }))!;
      await GerritPrCache.setPr('test/repo', pr);

      const prs = await GerritPrCache.getPrs('test/repo');
      expect(prs).toEqual([pr]);
    });

    it('updates an existing PR in the cache', async () => {
      const change = makeChange({ _number: 100 });
      mockFindChanges([change]);

      await GerritPrCache.getPrs('test/repo');

      const updatedPr = mapGerritChangeToPr(
        makeChange({
          _number: 100,
          subject: 'updated title',
          updated: '2025-04-15 10:00:00.000000000',
        }),
      )!;
      await GerritPrCache.setPr('test/repo', updatedPr);

      const prs = await GerritPrCache.getPrs('test/repo');
      expect(prs).toHaveLength(1);
      expect(prs[0].title).toBe('updated title');
    });
  });

  describe('reconcile()', () => {
    it('stops when hitting an unchanged cached change', async () => {
      const change = makeChange({
        _number: 100,
        updated: '2025-04-14 16:40:00.000000000',
      });
      mockFindChanges([change]);

      // First call populates the cache
      await GerritPrCache.getPrs('test/repo');

      // Reset memCache so it re-syncs
      memCacheReset();

      // This time, shouldFetchNextPage will be called with the same change
      // reconcile should return false since the change hasn't been updated
      clientMock.findChanges.mockImplementationOnce((_repo, config) => {
        const shouldContinue = config.shouldFetchNextPage!([change]);
        expect(shouldContinue).toBeFalse();
        return Promise.resolve([change]);
      });

      await GerritPrCache.getPrs('test/repo');
    });

    it('continues when changes are new or updated', async () => {
      mockFindChanges([]);

      // First call with empty cache
      await GerritPrCache.getPrs('test/repo');
      memCacheReset();

      const newChange = makeChange({
        _number: 200,
        updated: '2025-04-15 10:00:00.000000000',
      });
      clientMock.findChanges.mockImplementationOnce((_repo, config) => {
        const shouldContinue = config.shouldFetchNextPage!([newChange]);
        expect(shouldContinue).toBeTrue();
        return Promise.resolve([newChange]);
      });

      await GerritPrCache.getPrs('test/repo');
    });

    it('skips changes where mapGerritChangeToPr returns null', async () => {
      // A change without Renovate-Branch footer will return null from mapGerritChangeToPr
      const changeWithoutBranch = makeChange({
        _number: 300,
        current_revision: 'def456' as LongCommitSha,
        revisions: {
          def456: partial<GerritRevisionInfo>({
            commit_with_footers: 'no branch footer here',
          }),
        },
      });
      mockFindChanges([changeWithoutBranch]);

      const prs = await GerritPrCache.getPrs('test/repo');
      expect(prs).toHaveLength(0);
    });
  });

  describe('forceRefresh()', () => {
    it('clears cache and re-fetches all changes', async () => {
      const change1 = makeChange({ _number: 100 });
      mockFindChanges([change1]);

      // Populate cache
      await GerritPrCache.getPrs('test/repo');

      // Force refresh should clear and re-fetch
      const change2 = makeChange({ _number: 200 });
      // Two calls: one from init (memCache cleared), one from sync(true)
      mockFindChanges([change2]);
      mockFindChanges([change2]);

      await GerritPrCache.forceRefresh('test/repo');

      const prs = await GerritPrCache.getPrs('test/repo');
      expect(prs).toHaveLength(1);
      expect(prs[0].number).toBe(200);
    });
  });

  describe('repo cache persistence', () => {
    it('persists data to repo cache', async () => {
      const change = makeChange();
      mockFindChanges([change]);

      await GerritPrCache.getPrs('test/repo');

      const cache = getCache();
      expect(cache.platform).toMatchObject({
        gerrit: {
          pullRequestsCache: {
            items: {
              100: expect.objectContaining({ number: 100 }),
            },
          },
        },
      });
    });
  });

  describe('updateItems() sorting edge cases', () => {
    it('handles PRs without updatedAt', async () => {
      clientMock.findChanges.mockResolvedValueOnce([]);
      await GerritPrCache.getPrs('test/repo');

      const pr1 = mapGerritChangeToPr(makeChange({ _number: 1 }))!;
      const pr2 = mapGerritChangeToPr(makeChange({ _number: 2 }))!;
      pr1.updatedAt = undefined as never;

      await GerritPrCache.setPr('test/repo', pr1);
      await GerritPrCache.setPr('test/repo', pr2);

      const prs = await GerritPrCache.getPrs('test/repo');
      expect(prs).toHaveLength(2);
    });
  });
});
