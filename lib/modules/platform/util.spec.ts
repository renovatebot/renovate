import { partial } from '~test/util.ts';
import * as hostRules from '../../util/host-rules.ts';
import type { Pr } from './types.ts';
import {
  findPrInList,
  getNewBranchName,
  matchesState,
  repoFingerprint,
} from './util.ts';

describe('modules/platform/util', () => {
  beforeEach(() => hostRules.clear());

  describe('repoFingerprint', () => {
    it.each`
      repoId       | endpoint                | fingerprint
      ${'some-id'} | ${null}                 | ${'361b1bf27a0c0ef8fa5d270f588aa5747ba9497b16de64a44f186253295bc80a3891ecfee768f5c88734a6a738eacca69ccca7e50b16529cfc50dca77226a760'}
      ${'some-id'} | ${'https://github.com'} | ${'423e527a4f88a1b6aae8b70e72a4ae80b44fe83f11b90851f5bc654f39a3272c76b57d7ad30cabd727c04c254a3e7ea16109d05e398a228701ac805460344815'}
    `(
      '("$repoId", "$endpoint") === $fingerprint',
      ({ repoId, endpoint, fingerprint }) => {
        expect(repoFingerprint(repoId, endpoint)).toBe(fingerprint);
      },
    );
  });

  describe('getNewBranchName', () => {
    it('should add refs/heads', () => {
      const res = getNewBranchName('testBB');
      expect(res).toBe(`refs/heads/testBB`);
    });

    it('should be the same', () => {
      const res = getNewBranchName('refs/heads/testBB');
      expect(res).toBe(`refs/heads/testBB`);
    });
  });

  describe('matchesState', () => {
    it.each`
      actual      | expected   | result
      ${'open'}   | ${'all'}   | ${true}
      ${'closed'} | ${'all'}   | ${true}
      ${'closed'} | ${'!open'} | ${true}
      ${'merged'} | ${'!open'} | ${true}
      ${'open'}   | ${'!open'} | ${false}
      ${'open'}   | ${'open'}  | ${true}
      ${'closed'} | ${'open'}  | ${false}
    `(
      'matchesState("$actual", "$expected") === $result',
      ({ actual, expected, result }) => {
        expect(matchesState(actual, expected)).toBe(result);
      },
    );

    it('defaults expected to "all"', () => {
      expect(matchesState('open')).toBeTrue();
    });
  });

  describe('findPrInList', () => {
    const prs = [
      partial<Pr>({
        number: 1,
        sourceBranch: 'renovate/some-branch',
        title: 'Update dependency foo',
        state: 'open',
      }),
      partial<Pr>({
        number: 2,
        sourceBranch: 'renovate/other-branch',
        title: 'Update dependency bar',
        state: 'closed',
      }),
    ];

    it('finds a PR by branch name', () => {
      const res = findPrInList(prs, { branchName: 'renovate/other-branch' });
      expect(res?.number).toBe(2);
    });

    it('matches title case-insensitively', () => {
      const res = findPrInList(prs, {
        branchName: 'renovate/some-branch',
        prTitle: 'update dependency FOO',
      });
      expect(res?.number).toBe(1);
    });

    it('returns undefined when title does not match', () => {
      const res = findPrInList(prs, {
        branchName: 'renovate/some-branch',
        prTitle: 'unrelated title',
      });
      expect(res).toBeUndefined();
    });

    it('filters by state', () => {
      const res = findPrInList(prs, {
        branchName: 'renovate/other-branch',
        state: 'open',
      });
      expect(res).toBeUndefined();
    });

    it('returns undefined when branch does not match', () => {
      const res = findPrInList(prs, { branchName: 'renovate/missing-branch' });
      expect(res).toBeUndefined();
    });
  });
});
