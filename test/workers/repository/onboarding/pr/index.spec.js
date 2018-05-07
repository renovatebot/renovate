const defaultConfig = require('../../../../../lib/config/defaults').getConfig();

const {
  ensureOnboardingPr,
} = require('../../../../../lib/workers/repository/onboarding/pr');

describe('workers/repository/onboarding/pr', () => {
  describe('ensureOnboardingPr()', () => {
    let config;
    let packageFiles;
    let branches;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
        errors: [],
        warnings: [],
        description: [],
      };
      packageFiles = [{ packageFile: 'package.json' }];
      branches = [];
      platform.createPr.mockReturnValue({});
    });
    let createPrBody;
    it('creates PR', async () => {
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(platform.createPr.mock.calls).toHaveLength(1);
      createPrBody = platform.createPr.mock.calls[0][2];
    });
    it('returns if PR does not need updating', async () => {
      platform.getBranchPr.mockReturnValue({
        title: 'Configure Renovate',
        body: createPrBody,
      });
      await ensureOnboardingPr(config, packageFiles, branches);
      expect(platform.createPr.mock.calls).toHaveLength(0);
      expect(platform.updatePr.mock.calls).toHaveLength(0);
    });
    it('updates PR', async () => {
      config.baseBranch = 'some-branch';
      platform.getBranchPr.mockReturnValue({
        title: 'Configure Renovate',
        body: createPrBody,
      });
      await ensureOnboardingPr(config, [], branches);
      expect(platform.createPr.mock.calls).toHaveLength(0);
      expect(platform.updatePr.mock.calls).toHaveLength(1);
    });
  });
});
