import { mock } from 'jest-mock-extended';
import { git } from '../../../../test/util';
import { BranchConfig } from '../../types';
import { getControls } from './controls';

jest.mock('../../../util/git');

describe('workers/pr/body/controls', () => {
  describe('getControls', () => {
    let branchConfig: BranchConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      branchConfig = mock<BranchConfig>();
      branchConfig.branchName = 'branchName';
    });
    describe(`when the branch is modified`, () => {
      beforeEach(() => {
        git.isBranchModified.mockResolvedValue(true);
      });
      it('has the correct contents', async () => {
        expect(await getControls(branchConfig)).toContain(
          `- [ ] <!-- rebase-check -->If you want to rebase/retry this PR, click this checkbox. ⚠ **Warning**: custom changes will be lost.`
        );
        expect(git.isBranchModified).toHaveBeenCalledTimes(1);
        expect(git.isBranchModified).toHaveBeenCalledWith(
          branchConfig.branchName
        );
      });
    });

    describe(`when the branch is not modified`, () => {
      beforeEach(() => {
        git.isBranchModified.mockResolvedValue(false);
      });
      it('has the correct contents', async () => {
        expect(await getControls(branchConfig)).toContain(
          `- [ ] <!-- rebase-check -->If you want to rebase/retry this PR, click this checkbox.`
        );
        expect(git.isBranchModified).toHaveBeenCalledTimes(1);
        expect(git.isBranchModified).toHaveBeenCalledWith(
          branchConfig.branchName
        );
      });
    });
  });
});
