const defaultConfig = require('../../../../../lib/config/defaults').getConfig();
const {
  rebaseOnboardingBranch,
} = require('../../../../../lib/workers/repository/onboarding/branch/rebase');

describe('workers/repository/onboarding/branch/rebase', () => {
  describe('rebaseOnboardingBranch()', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        ...defaultConfig,
      };
    });
    it('does nothing if branch is up to date', async () => {
      platform.getBranchPr.mockReturnValueOnce({ number: 1 });
      platform.getPr.mockReturnValueOnce({ isStale: false });
      await rebaseOnboardingBranch(config);
      expect(platform.commitFilesToBranch.mock.calls).toHaveLength(0);
    });
    it('rebases unmodified branch', async () => {
      platform.getBranchPr.mockReturnValueOnce({ number: 1 });
      platform.getPr.mockReturnValueOnce({ isStale: true, canRebase: true });
      await rebaseOnboardingBranch(config);
      expect(platform.commitFilesToBranch.mock.calls).toHaveLength(1);
    });
    it('rebases modified branch', async () => {
      platform.getBranchPr.mockReturnValueOnce({ number: 1 });
      platform.getPr.mockReturnValueOnce({ isStale: true, canRebase: false });
      platform.getPrFiles.mockReturnValueOnce(['renovate.json']);
      await rebaseOnboardingBranch(config);
      expect(platform.commitFilesToBranch.mock.calls).toHaveLength(1);
    });
    it('does not rebase modified branch with additional files', async () => {
      platform.getBranchPr.mockReturnValueOnce({ number: 1 });
      platform.getPr.mockReturnValueOnce({ isStale: true, canRebase: false });
      platform.getPrFiles.mockReturnValueOnce([
        'renovate.json',
        'package.json',
      ]);
      await rebaseOnboardingBranch(config);
      expect(platform.commitFilesToBranch.mock.calls).toHaveLength(0);
    });
  });
});
