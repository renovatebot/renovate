const branchWorker = require('../../lib/workers/branch');

describe('workers/branch', () => {
  describe('useBaseBranch(branchName, config)', () => {
    let config;
    // const branchName = 'renovate/foo';
    beforeEach(() => {
      config = {
        api: {
          getBranchPr: jest.fn(),
        },
      };
    });
    it('returns false if no PR', async () => {
      config.api.getBranchPr.mockReturnValueOnce(null);
      expect(await branchWorker.useBaseBranch('', config)).toBe(false);
    });
    /*
    it('returns false if unmergeable and cannot rebase', () => {
      const pr = {
        isUnmergeable: true,
        canRebase: false,
      };
      branchWorker.useBaseBranch(pr, {}).should.eql(false);
    });
    it('returns true if unmergeable and can rebase', () => {
      const pr = {
        isUnmergeable: true,
        canRebase: true,
      };
      branchWorker.useBaseBranch(pr, {}).should.eql(true);
    });
    it('returns false if stale but not configured to rebase', () => {
      const pr = {
        isStale: true,
        canRebase: true,
      };
      config.rebaseStalePrs = false;
      branchWorker.useBaseBranch(pr, config).should.eql(false);
    });
    it('returns false if stale but cannot rebase', () => {
      const pr = {
        isStale: true,
        canRebase: false,
      };
      config.rebaseStalePrs = true;
      branchWorker.useBaseBranch(pr, config).should.eql(false);
    });
    it('returns true if stale and rebase stale configured', () => {
      const pr = {
        isStale: true,
        canRebase: true,
      };
      config.rebaseStalePrs = true;
      branchWorker.useBaseBranch(pr, config).should.eql(true);
    });
    */
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
