import type { Pr } from '../types';
import * as prCache from './pr-cache';

describe('modules/platform/gerrit/pr-cache', () => {
  const repository = 'test/repo';
  const repository2 = 'other/repo';

  const mockPr1: Pr = {
    number: 1,
    state: 'open',
    sourceBranch: 'source-branch',
    targetBranch: 'target-branch',
    title: 'Test PR 1',
    createdAt: '2023-01-01T00:00:00Z',
  };

  const mockPr2: Pr = {
    number: 2,
    state: 'closed',
    sourceBranch: 'another-branch',
    targetBranch: 'target-branch',
    title: 'Test PR 2',
    createdAt: '2023-01-02T00:00:00Z',
  };

  const mockPr3: Pr = {
    number: 3,
    state: 'merged',
    sourceBranch: 'another-branch',
    targetBranch: 'another-target',
    title: 'Test PR 3',
    createdAt: '2023-01-03T00:00:00Z',
  };

  beforeEach(() => {
    prCache.reset();
  });

  describe('initialized', () => {
    it('returns false when cache is not initialized', () => {
      expect(prCache.initialized(repository)).toBe(false);
    });

    it('returns true when cache is initialized for the given repository', () => {
      prCache.set(repository, [mockPr1]);
      expect(prCache.initialized(repository)).toBe(true);
    });

    it('returns false when cache is initialized for a different repository', () => {
      prCache.set(repository, [mockPr1]);
      expect(prCache.initialized(repository2)).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets cache state', () => {
      prCache.set(repository, [mockPr1]);
      expect(prCache.initialized(repository)).toBe(true);

      prCache.reset();
      expect(prCache.initialized(repository)).toBe(false);
    });
  });

  describe('set', () => {
    it('initializes cache with PRs', () => {
      prCache.set(repository, [mockPr1, mockPr2]);
      const result = prCache.getAll(repository);
      expect(result).toHaveLength(2);
      expect(result).toEqual([mockPr1, mockPr2]);
    });

    it('replaces cache when repository changes', () => {
      prCache.set(repository, [mockPr1]);
      prCache.set(repository2, [mockPr2]);

      expect(prCache.getAll(repository)).toBeUndefined();
      expect(prCache.getAll(repository2)).toEqual([mockPr2]);
    });

    it('updates existing PRs when repository is the same', () => {
      prCache.set(repository, [mockPr1, mockPr2]);

      const updatedPr1 = { ...mockPr1, title: 'Updated PR 1' };
      prCache.set(repository, [updatedPr1]);

      const result = prCache.getAll(repository);
      expect(result).toHaveLength(2);
      expect(result?.[0].title).toBe('Updated PR 1');
      expect(result?.[1]).toEqual(mockPr2);
    });
  });

  describe('get', () => {
    it('returns undefined for non-initialized cache', () => {
      expect(prCache.get(repository, 1)).toBeUndefined();
    });

    it('returns null for non-existing PR', () => {
      prCache.set(repository, [mockPr1]);
      expect(prCache.get(repository, 999)).toBeNull();
    });

    it('returns PR by number', () => {
      prCache.set(repository, [mockPr1, mockPr2]);
      expect(prCache.get(repository, 2)).toEqual(mockPr2);
    });

    it('returns cloned PR object', () => {
      prCache.set(repository, [mockPr1]);
      const pr = prCache.get(repository, 1);
      expect(pr).toEqual(mockPr1);
      expect(pr).not.toBe(mockPr1); // Check if it's not the same object reference
    });

    it('returns undefined when repository is different', () => {
      prCache.set(repository, [mockPr1]);
      expect(prCache.get(repository2, 1)).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('returns undefined for non-initialized cache', () => {
      expect(prCache.getAll(repository)).toBeUndefined();
    });

    it('returns empty array when no PRs exist', () => {
      prCache.set(repository, []);
      expect(prCache.getAll(repository)).toEqual([]);
    });

    it('returns all PRs', () => {
      prCache.set(repository, [mockPr1, mockPr2, mockPr3]);
      expect(prCache.getAll(repository)).toEqual([mockPr1, mockPr2, mockPr3]);
    });

    it('returns cloned PRs', () => {
      prCache.set(repository, [mockPr1, mockPr2]);
      const prs = prCache.getAll(repository);
      expect(prs).toEqual([mockPr1, mockPr2]);
      expect(prs?.[0]).not.toBe(mockPr1); // Check if it's not the same object reference
    });

    it('returns undefined when repository is different', () => {
      prCache.set(repository, [mockPr1]);
      expect(prCache.getAll(repository2)).toBeUndefined();
    });
  });

  describe('find', () => {
    beforeEach(() => {
      prCache.set(repository, [mockPr1, mockPr2, mockPr3]);
    });

    it('returns undefined for non-initialized cache', () => {
      prCache.reset();
      expect(
        prCache.find(repository, { branchName: 'source-branch' }),
      ).toBeUndefined();
    });

    it('returns null when no PRs match the criteria with limit=1', () => {
      expect(
        prCache.find(repository, { branchName: 'non-existent-branch' }, 1),
      ).toBeNull();
    });

    it('returns empty array when no PRs match the criteria', () => {
      expect(
        prCache.find(repository, { branchName: 'non-existent-branch' }),
      ).toEqual([]);
    });

    it('filters by sourceBranch (branchName)', () => {
      expect(prCache.find(repository, { branchName: 'source-branch' })).toEqual(
        [mockPr1],
      );
      expect(
        prCache.find(repository, { branchName: 'another-branch' }),
      ).toEqual([mockPr2, mockPr3]);
    });

    it('filters by prTitle', () => {
      expect(
        prCache.find(repository, {
          branchName: 'source-branch',
          prTitle: 'Test PR 1',
        }),
      ).toEqual([mockPr1]);
    });

    it('filters by state', () => {
      expect(
        prCache.find(repository, { branchName: '', state: 'open' }),
      ).toEqual([mockPr1]);
      expect(
        prCache.find(repository, { branchName: '', state: 'closed' }),
      ).toEqual([mockPr2]);
      expect(
        prCache.find(repository, { branchName: '', state: '!open' }),
      ).toEqual([mockPr2, mockPr3]);
      expect(
        prCache.find(repository, { branchName: '', state: 'all' }),
      ).toEqual([mockPr1, mockPr2, mockPr3]);
    });

    it('filters by multiple criteria', () => {
      expect(
        prCache.find(repository, {
          branchName: 'another-branch',
          state: 'closed',
        }),
      ).toEqual([mockPr2]);
    });

    it('returns first match with limit=1', () => {
      const result = prCache.find(
        repository,
        {
          branchName: 'another-branch',
        },
        1,
      );
      expect(result).toEqual(mockPr2);
    });

    it('returns undefined when repository is different', () => {
      expect(
        prCache.find(repository2, { branchName: 'source-branch' }),
      ).toBeUndefined();
    });

    it('returns cloned PR objects', () => {
      const singlePr = prCache.find(
        repository,
        { branchName: 'source-branch', prTitle: 'Test PR 1' },
        1,
      ) as Pr;
      expect(singlePr).toEqual(mockPr1);
      expect(singlePr).not.toBe(mockPr1);

      const multiplePrs = prCache.find(repository, {
        branchName: '',
        state: 'open',
      }) as Pr[];
      expect(multiplePrs[0]).toEqual(mockPr1);
      expect(multiplePrs[0]).not.toBe(mockPr1);
    });
  });
});
