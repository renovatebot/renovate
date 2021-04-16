import { mock } from 'jest-mock-extended';
import { getName, git } from '../../../../test/util';
import { BranchConfig } from '../../types';
import { getControls } from './controls';

jest.mock('../../../util/git');

describe(getName(__filename), () => {
  describe('getControls', () => {
    let branchConfig: BranchConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      branchConfig = mock<BranchConfig>();
      branchConfig.branchName = 'branchName';
    });
    [true, false].forEach((modified) => {
      describe(`when the branch is ${modified ? '' : ' not'} modified`, () => {
        beforeEach(() => {
          git.isBranchModified.mockResolvedValue(modified);
        });
        it('has the correct contents', async () => {
          expect(await getControls(branchConfig)).toMatchSnapshot();
          expect(git.isBranchModified).toHaveBeenCalledTimes(1);
          expect(git.isBranchModified).toHaveBeenCalledWith(
            branchConfig.branchName
          );
        });
      });
    });
  });
});
