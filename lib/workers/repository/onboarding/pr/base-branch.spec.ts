import { RenovateConfig, getConfig } from '../../../../../test/util';

import { getBaseBranchDesc } from './base-branch';

describe('workers/repository/onboarding/pr/base-branch', () => {
  describe('getBaseBranchDesc()', () => {
    let config: RenovateConfig;
    beforeEach(() => {
      jest.resetAllMocks();
      config = getConfig();
    });
    it('returns empty if no baseBranch', () => {
      const res = getBaseBranchDesc(config);
      expect(res).toEqual('');
    });
    it('describes baseBranch', () => {
      config.baseBranches = ['some-branch'];
      const res = getBaseBranchDesc(config);
      expect(res).toMatchSnapshot();
    });
    it('describes baseBranches', () => {
      config.baseBranches = ['some-branch', 'some-other-branch'];
      const res = getBaseBranchDesc(config);
      expect(res).toMatchSnapshot();
    });
  });
});
