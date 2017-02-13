const branchWorker = require('../../lib/workers/branch');

describe('workers/branch', () => {
  describe('useBaseBranch(branchName, config)', () => {
    let config;
    beforeEach(() => {
      config = {
        api: {
          getBranchPr: jest.fn(),
        },
      };
    });
    it('returns false if no PR', async () => {
      config.api.getBranchPr.mockReturnValue(null);
      expect(await branchWorker.useBaseBranch('', config)).toBe(false);
    });
    it('returns false if does not need rebaseing', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: false,
      });
      expect(await branchWorker.useBaseBranch('', config)).toBe(false);
    });
    it('returns false if unmergeable and cannot rebase', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: false,
      });
      expect(await branchWorker.useBaseBranch('', config)).toBe(false);
    });
    it('returns true if unmergeable and can rebase', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: true,
      });
      expect(await branchWorker.useBaseBranch('', config)).toBe(true);
    });
    it('returns false if stale but not configured to rebase', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: false,
        isStale: true,
        canRebase: true,
      });
      config.rebaseStalePrs = false;
      expect(await branchWorker.useBaseBranch('', config)).toBe(false);
    });
    it('returns false if stale but cannot rebase', async () => {
      config.api.getBranchPr.mockReturnValueOnce({
        isUnmergeable: false,
        isStale: true,
        canRebase: false,
      });
      config.rebaseStalePrs = true;
      expect(await branchWorker.useBaseBranch('', config)).toBe(false);
    });
    it('returns true if stale and can rebase', async () => {
      config.api.getBranchPr.mockReturnValueOnce({
        isUnmergeable: false,
        isStale: true,
        canRebase: true,
      });
      config.rebaseStalePrs = true;
      expect(await branchWorker.useBaseBranch('', config)).toBe(true);
    });
  });
  describe('getYarnLockFile(packageJson, config)', () => {
    let config;
    beforeEach(() => {
      config = {
        packageFile: 'package.json',
        api: {
          getFileContent: jest.fn(),
        },
      };
    });
    it('returns null if no existing yarn.lock', async () => {
      config.api.getFileContent.mockReturnValueOnce(false);
      expect(await branchWorker.getYarnLockFile('', config)).toBe(null);
    });
  });
});
