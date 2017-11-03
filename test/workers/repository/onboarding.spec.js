const onboarding = require('../../../lib/workers/repository/onboarding');
const manager = require('../../../lib/manager');
const logger = require('../../_fixtures/logger');
const defaultConfig = require('../../../lib/config/defaults').getConfig();

describe('lib/workers/repository/onboarding', () => {
  describe('getOnboardingStatus(config)', () => {
    let config;
    beforeEach(() => {
      config = { ...defaultConfig };
      jest.resetAllMocks();
      config.api = {
        commitFilesToBranch: jest.fn(),
        createPr: jest.fn(() => ({ displayNumber: 1 })),
        getFileList: jest.fn(() => []),
        findPr: jest.fn(),
        getFileContent: jest.fn(),
        getFileJson: jest.fn(() => ({})),
        getPr: jest.fn(() => {}),
        getCommitMessages: jest.fn(),
      };
      config.foundIgnoredPaths = true;
      config.logger = logger;
      config.detectedPackageFiles = true;
    });
    it('returns true if onboarding is false', async () => {
      config.onboarding = false;
      const res = await onboarding.getOnboardingStatus(config);
      expect(res.repoIsOnboarded).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(0);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('returns true if renovate config present', async () => {
      config.renovateJsonPresent = true;
      const res = await onboarding.getOnboardingStatus(config);
      expect(res.repoIsOnboarded).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(0);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('returns true if pr and pr is closed', async () => {
      config.api.findPr.mockReturnValueOnce({ isClosed: true });
      const res = await onboarding.getOnboardingStatus(config);
      expect(res.repoIsOnboarded).toEqual(true);
      expect(config.api.findPr.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('skips commit files and returns false if open pr', async () => {
      config.api.findPr.mockReturnValueOnce({ isClosed: false });
      const res = await onboarding.getOnboardingStatus(config);
      expect(res.repoIsOnboarded).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(0);
    });
    it('commits files and returns false if no pr', async () => {
      config.api.getFileList.mockReturnValueOnce(['package.json']);
      const res = await onboarding.getOnboardingStatus(config);
      expect(res.repoIsOnboarded).toEqual(false);
      expect(config.api.findPr.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0]).toMatchSnapshot();
    });
    it('throws if no packageFiles', async () => {
      manager.detectPackageFiles = jest.fn(() => []);
      let e;
      try {
        await onboarding.getOnboardingStatus(config);
      } catch (err) {
        e = err;
      }
      expect(e).toMatchSnapshot();
    });
  });
});
