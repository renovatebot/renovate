import { baseBranchesEqualsDefault } from './common';

describe('workers/repository/process/common', () => {
  describe('baseBranchesIsDefault()', () => {
    it('unit tests baseBranchesIsDefault', () => {
      expect(
        baseBranchesEqualsDefault({
          baseBranches: ['main'],
          defaultBranch: 'main',
        })
      ).toBeTrue();

      expect(
        baseBranchesEqualsDefault({
          baseBranches: ['main', 'dev'],
          defaultBranch: 'main',
        })
      ).toBeFalse();

      expect(
        baseBranchesEqualsDefault({ baseBranches: [], defaultBranch: 'main' })
      ).toBeFalse();

      expect(
        baseBranchesEqualsDefault({
          baseBranches: ['dev'],
          defaultBranch: 'main',
        })
      ).toBeFalse();

      expect(baseBranchesEqualsDefault({ baseBranches: ['dev'] })).toBeFalse();

      expect(baseBranchesEqualsDefault({ defaultBranch: 'main' })).toBeFalse();
    });
  });
});
