import { partial } from '~test/util.ts';
import * as hostRules from '../../util/host-rules.ts';
import type { Pr } from './types.ts';
import { findPrInList, getNewBranchName, repoFingerprint } from './util.ts';

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

    it.each`
      actual      | filterState | expected
      ${'open'}   | ${'all'}    | ${1}
      ${'closed'} | ${'all'}    | ${1}
      ${'merged'} | ${'all'}    | ${1}
      ${'open'}   | ${'open'}   | ${1}
      ${'closed'} | ${'open'}   | ${undefined}
      ${'merged'} | ${'open'}   | ${undefined}
      ${'open'}   | ${'closed'} | ${undefined}
      ${'closed'} | ${'closed'} | ${1}
      ${'merged'} | ${'closed'} | ${undefined}
      ${'open'}   | ${'!open'}  | ${undefined}
      ${'closed'} | ${'!open'}  | ${1}
      ${'merged'} | ${'!open'}  | ${1}
    `(
      'PR with state "$actual" filtered by "$filterState" === $expected',
      ({ actual, filterState, expected }) => {
        const pr = [
          partial<Pr>({
            number: 1,
            sourceBranch: 'renovate/some-branch',
            title: 'Update dependency foo',
            state: actual,
          }),
        ];

        const res = findPrInList(pr, {
          branchName: 'renovate/some-branch',
          state: filterState,
        });

        expect(res?.number).toBe(expected);
      },
    );

    it('finds a PR when state filter is omitted', () => {
      const res = findPrInList(prs, { branchName: 'renovate/some-branch' });
      expect(res?.number).toBe(1);
    });

    it('returns undefined when extraFilter rejects the match', () => {
      const res = findPrInList(
        prs,
        { branchName: 'renovate/some-branch' },
        () => false,
      );
      expect(res).toBeUndefined();
    });

    it('returns the PR when extraFilter accepts the match', () => {
      const res = findPrInList(
        prs,
        { branchName: 'renovate/some-branch' },
        () => true,
      );
      expect(res?.number).toBe(1);
    });
  });
});
