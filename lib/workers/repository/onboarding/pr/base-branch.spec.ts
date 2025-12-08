import { getBaseBranchDesc } from './base-branch';
import type { RenovateConfig } from '~test/util';
import { partial } from '~test/util';

describe('workers/repository/onboarding/pr/base-branch', () => {
  describe('getBaseBranchDesc()', () => {
    let config: RenovateConfig;

    beforeEach(() => {
      config = partial<RenovateConfig>();
    });

    it('returns empty if no baseBranch', () => {
      const res = getBaseBranchDesc(config);
      expect(res).toBeEmptyString();
    });

    it('describes baseBranch', () => {
      config.baseBranchPatterns = ['some-branch'];
      const res = getBaseBranchDesc(config);
      expect(res.trim()).toBe(
        'You have configured Renovate to use branch `some-branch` as base branch.',
      );
    });

    it('describes baseBranchPatterns', () => {
      config.baseBranchPatterns = ['some-branch', 'some-other-branch'];
      const res = getBaseBranchDesc(config);
      expect(res.trim()).toBe(
        'You have configured Renovate to use the following baseBranchPatterns: `some-branch`, `some-other-branch`.',
      );
    });
  });
});
