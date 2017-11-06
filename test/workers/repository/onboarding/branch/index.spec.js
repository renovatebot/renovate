const logger = require('../../../../_fixtures/logger');
const defaultConfig = require('../../../../../lib/config/defaults').getConfig();
const {
  checkOnboardingBranch,
} = require('../../../../../lib/workers/repository/onboarding/branch');

describe('workers/repository/onboarding/branch', () => {
  describe('checkOnboardingBranch', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
        logger,
        api: {
          commitFilesToBranch: jest.fn(),
          findPr: jest.fn(),
          getFileList: jest.fn(() => []),
          setBaseBranch: jest.fn(),
        },
      };
    });
    it('throws if no package files', async () => {
      let e;
      try {
        await checkOnboardingBranch(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
    it('throws if fork', async () => {
      config.isFork = true;
      let e;
      try {
        await checkOnboardingBranch(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
    });
    it('detects repo is onboarded via file', async () => {
      config.api.getFileList.mockReturnValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('detects repo is onboarded via PR', async () => {
      config.api.findPr.mockReturnValue(true);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('creates onboaring branch', async () => {
      config.api.getFileList.mockReturnValue(['package.json']);
      config.api.commitFilesToBranch = jest.fn();
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(false);
      expect(res.branchList).toEqual(['renovate/configure']);
      expect(config.api.setBaseBranch.mock.calls).toHaveLength(1);
    });
  });
});
