import { mock } from 'jest-mock-extended';
import { BranchConfig } from '../../types';
import { getPrConfigDescription } from './config-description';

jest.mock('../../../util/git');

describe('workers/pr/body/config-description', () => {
  describe('getPrConfigDescription', () => {
    let branchConfig: BranchConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      branchConfig = mock<BranchConfig>();
      branchConfig.branchName = 'branchName';
    });

    it('handles stopUpdatingLabel correctly', async () => {
      branchConfig.stopUpdating = true;
      expect(await getPrConfigDescription(branchConfig)).toContain(
        `**Rebasing**: Never, or you tick the rebase/retry checkbox.`
      );
    });
  });
});
