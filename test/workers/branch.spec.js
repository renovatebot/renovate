const branchWorker = require('../../lib/workers/branch');
const yarnHelper = require('../../lib/helpers/yarn');
const defaultConfig = require('../../lib/config/defaults').getConfig();
const packageJsonHelper = require('../../lib/helpers/package-json');

jest.mock('../../lib/helpers/yarn');
jest.mock('../../lib/helpers/package-json');

describe('workers/branch', () => {
  describe('getParentBranch(branchName, config)', () => {
    let config;
    const branchName = 'foo';
    beforeEach(() => {
      config = {
        api: {
          branchExists: jest.fn(() => true),
          getBranchPr: jest.fn(),
        },
      };
    });
    it('returns undefined if branch does not exist', async () => {
      config.api.branchExists.mockReturnValue(false);
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(undefined);
    });
    it('returns branchName if no PR', async () => {
      config.api.getBranchPr.mockReturnValue(null);
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(branchName);
    });
    it('returns false if does not need rebaseing', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: false,
      });
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(branchName);
    });
    it('returns false if unmergeable and cannot rebase', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: false,
      });
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(branchName);
    });
    it('returns true if unmergeable and can rebase', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: true,
        canRebase: true,
      });
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(undefined);
    });
    it('returns false if stale but not configured to rebase', async () => {
      config.api.getBranchPr.mockReturnValue({
        isUnmergeable: false,
        isStale: true,
        canRebase: true,
      });
      config.rebaseStalePrs = false;
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(branchName);
    });
    it('returns false if stale but cannot rebase', async () => {
      config.api.getBranchPr.mockReturnValueOnce({
        isUnmergeable: false,
        isStale: true,
        canRebase: false,
      });
      config.rebaseStalePrs = true;
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(branchName);
    });
    it('returns true if stale and can rebase', async () => {
      config.api.getBranchPr.mockReturnValueOnce({
        isUnmergeable: false,
        isStale: true,
        canRebase: true,
      });
      config.rebaseStalePrs = true;
      expect(await branchWorker.getParentBranch(branchName, config)).toBe(undefined);
    });
  });
  describe('getYarnLockFile(packageJson, config)', () => {
    let api;
    beforeEach(() => {
      api = {
        getFileContent: jest.fn(),
      };
    });
    it('returns null if no existing yarn.lock', async () => {
      api.getFileContent.mockReturnValueOnce(false);
      expect(await branchWorker.getYarnLockFile('package.json', '', api)).toBe(null);
    });
    it('returns yarn.lock file', async () => {
      api.getFileContent.mockReturnValueOnce('Existing yarn.lock');
      api.getFileContent.mockReturnValueOnce(null); // npmrc
      api.getFileContent.mockReturnValueOnce(null); // yarnrc
      yarnHelper.generateLockFile.mockReturnValueOnce('New yarn.lock');
      const yarnLockFile = {
        name: 'yarn.lock',
        contents: 'New yarn.lock',
      };
      expect(await branchWorker.getYarnLockFile('package.json', '', api)).toMatchObject(yarnLockFile);
    });
  });
  describe('ensureBranch(config)', () => {
    let config;
    beforeEach(() => {
      packageJsonHelper.setNewValue = jest.fn();
      branchWorker.getParentBranch = jest.fn();
      branchWorker.getYarnLockFile = jest.fn();
      config = Object.assign({}, defaultConfig);
      config.api = {};
      config.api.getFileContent = jest.fn();
      config.api.commitFilesToBranch = jest.fn();
      config.api.getFileContent.mockReturnValueOnce('old content');
      config.depName = 'dummy';
      config.currentVersion = '1.0.0';
      config.newVersion = '1.1.0';
    });
    it('returns if new content matches old', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('old content');
      await branchWorker.ensureBranch([config]);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(branchWorker.getYarnLockFile.mock.calls.length).toBe(0);
    });
    it('commits one file if no yarn lock found', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      await branchWorker.ensureBranch([config]);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(branchWorker.getYarnLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(1);
    });
    it('commits two files if yarn lock found', async () => {
      branchWorker.getParentBranch.mockReturnValueOnce('dummy branch');
      branchWorker.getYarnLockFile.mockReturnValueOnce('non null response');
      packageJsonHelper.setNewValue.mockReturnValueOnce('new content');
      await branchWorker.ensureBranch([config]);
      expect(branchWorker.getParentBranch.mock.calls.length).toBe(1);
      expect(packageJsonHelper.setNewValue.mock.calls.length).toBe(1);
      expect(branchWorker.getYarnLockFile.mock.calls.length).toBe(1);
      expect(config.api.commitFilesToBranch.mock.calls[0][1].length).toBe(2);
    });
  });
});
