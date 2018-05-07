const defaultConfig = require('../../../../../lib/config/defaults').getConfig();

const {
  getBaseBranchDesc,
} = require('../../../../../lib/workers/repository/onboarding/pr/base-branch');

describe('workers/repository/onboarding/pr/base-branch', () => {
  describe('getBaseBranchDesc()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
      };
    });
    it('returns empty if no baseBranch', () => {
      const res = getBaseBranchDesc(config);
      expect(res).toEqual('');
    });
    it('describes baseBranch', () => {
      config.baseBranch = 'some-branch';
      const res = getBaseBranchDesc(config);
      expect(res).toMatchSnapshot();
    });
  });
});
