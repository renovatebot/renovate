const defaultConfig = require('../../../../../lib/config/defaults').getConfig();
const {
  checkOnboardingBranch,
} = require('../../../../../lib/workers/repository/onboarding/branch');

jest.mock('../../../../../lib/workers/repository/onboarding/branch/rebase');

/** @type any */
const platform = global.platform;

describe('workers/repository/onboarding/branch', () => {
  describe('checkOnboardingBranch', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
        branchPrefix: 'renovate/',
      };
      platform.getFileList.mockReturnValue([]);
    });
    it('throws if no package files', async () => {
      await expect(checkOnboardingBranch(config)).rejects.toThrow();
    });
    it('throws if fork', async () => {
      config.isFork = true;
      await expect(checkOnboardingBranch(config)).rejects.toThrow();
    });
    it('handles skipped onboarding combined with requireConfig = false', async () => {
      config.requireConfig = false;
      config.onboarding = false;
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('handles skipped onboarding, requireConfig=true, and a config file', async () => {
      config.requireConfig = true;
      config.onboarding = false;
      platform.getFileList.mockReturnValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('handles skipped onboarding, requireConfig=true, and no config file', async () => {
      config.requireConfig = true;
      config.onboarding = false;
      platform.getFileList.mockReturnValueOnce(['package.json']);
      platform.getFile.mockReturnValueOnce('{}');
      const onboardingResult = checkOnboardingBranch(config);
      await expect(onboardingResult).rejects.toThrow('disabled');
    });
    it('detects repo is onboarded via file', async () => {
      platform.getFileList.mockReturnValueOnce(['renovate.json']);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('detects repo is onboarded via package.json config', async () => {
      platform.getFileList.mockReturnValueOnce(['package.json']);
      platform.getFile.mockReturnValueOnce('{"renovate":{}}');
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('detects repo is onboarded via PR', async () => {
      config.requireConfig = false;
      platform.findPr.mockReturnValue(true);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('throws if no required config', async () => {
      config.requireConfig = true;
      platform.findPr.mockReturnValue(true);
      platform.getPrList.mockReturnValueOnce([
        { branchName: 'renovate/something', state: 'open' },
      ]);
      await expect(checkOnboardingBranch(config)).rejects.toThrow();
    });
    it('creates onboarding branch with greenkeeper migration', async () => {
      platform.getFileList.mockReturnValue(['package.json']);
      const pJsonContent = JSON.stringify({
        name: 'some-name',
        version: '0.0.1',
        greenkeeper: {
          label: 'greenkeeper',
          branchName: 'greenkeeper--',
          ignore: ['foo', 'bar'],
        },
      });
      platform.getFile.mockReturnValue(pJsonContent);
      await checkOnboardingBranch(config);
      expect(
        platform.commitFilesToBranch.mock.calls[0][1][0].contents
      ).toMatchSnapshot();
    });
    it('updates onboarding branch', async () => {
      platform.getFileList.mockReturnValue(['package.json']);
      platform.findPr.mockReturnValueOnce(null);
      platform.getBranchPr.mockReturnValueOnce({});
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(false);
      expect(res.branchList).toEqual(['renovate/configure']);
      expect(platform.setBaseBranch).toHaveBeenCalledTimes(1);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(0);
    });
    it('updates onboarding branch with branchPrefix', async () => {
      platform.getFileList.mockReturnValue(['package.json']);
      platform.findPr.mockReturnValueOnce(null);
      platform.getBranchPr.mockReturnValueOnce({});
      config.branchPrefix = 'customprefix/';
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(false);
      expect(res.branchList).toEqual([`${config.branchPrefix}configure`]);
      expect(platform.setBaseBranch).toHaveBeenCalledTimes(1);
      expect(platform.commitFilesToBranch).toHaveBeenCalledTimes(0);
    });
  });
});
