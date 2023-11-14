import { RenovateConfig, partial } from '../../../../../test/util';
import { getBaseBranchDesc } from './base-branch';

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
      config.baseBranches = ['some-branch'];
      const res = getBaseBranchDesc(config);
      expect(res.trim()).toBe(
        'You have configured Renovate to use branch `some-branch` as base branch.',
      );
    });

    it('describes baseBranches', () => {
      config.baseBranches = ['some-branch', 'some-other-branch'];
      const res = getBaseBranchDesc(config);
      expect(res.trim()).toBe(
        'You have configured Renovate to use the following baseBranches: `some-branch`, `some-other-branch`.',
      );
    });
  });
});
