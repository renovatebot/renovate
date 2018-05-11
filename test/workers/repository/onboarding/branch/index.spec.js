const defaultConfig = require('../../../../../lib/config/defaults').getConfig();
const {
  checkOnboardingBranch,
} = require('../../../../../lib/workers/repository/onboarding/branch');

jest.mock('../../../../../lib/workers/repository/onboarding/branch/rebase');

describe('workers/repository/onboarding/branch', () => {
  describe('checkOnboardingBranch', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
      };
      platform.getFileList.mockReturnValue([]);
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
    it('detects onboarding is skipped', async () => {
      config.onboarding = false;
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
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
      platform.findPr.mockReturnValue(true);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('detects repo is onboarded via PR and merged', async () => {
      config.requireConfig = true;
      platform.findPr.mockReturnValue(true);
      platform.getPrList.mockReturnValueOnce([
        { branchName: 'renovate/something', state: 'merged' },
      ]);
      const res = await checkOnboardingBranch(config);
      expect(res.repoIsOnboarded).toBe(true);
    });
    it('throws if no required config', async () => {
      config.requireConfig = true;
      platform.findPr.mockReturnValue(true);
      platform.getPrList.mockReturnValueOnce([
        { branchName: 'renovate/something', state: 'open' },
      ]);
      let e;
      try {
        await checkOnboardingBranch(config);
      } catch (err) {
        e = err;
      }
      expect(e).toBeDefined();
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
      expect(platform.setBaseBranch.mock.calls).toHaveLength(1);
      expect(platform.commitFilesToBranch.mock.calls).toHaveLength(0);
    });
  });
});
